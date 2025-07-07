package handlers

import (
	"astrm/backend/app"
	"astrm/backend/models"
	"astrm/backend/services/plugins"
	"fmt"
	"gorm.io/gorm"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

// isValidProxyPath 检查代理路径是否有效
func isValidProxyPath(path string) bool {
	// 路径必须存在且以/开头
	if path == "" || !strings.HasPrefix(path, "/") {
		return false
	}

	// 不允许仅为根路径
	if path == "/" {
		return false
	}

	// 检查路径是否含有特殊字符
	invalidChars := []string{" ", "?", "#", "\t", "\n"}
	for _, char := range invalidChars {
		if strings.Contains(path, char) {
			return false
		}
	}

	// 最大长度检查
	if len(path) > 100 {
		return false
	}

	return true
}

// SetupProxyRoutes 配置反向代理路由
func SetupProxyRoutes(r *gin.Engine) {
	// 初始加载所有启用的代理配置
	var proxies []models.Proxy
	result := models.DB.Where("enabled = ?", true).Find(&proxies)
	if result.Error != nil {
		log.Printf("加载代理配置失败: %v", result.Error)
		return
	}

	// 为每个代理配置设置路由
	for _, proxy := range proxies {
		setupProxy(r, proxy)
	}
}

// setupProxy 为单个代理配置设置路由
func setupProxy(r *gin.Engine, conf models.Proxy) {
	// 使用验证函数检查路径
	if !isValidProxyPath(conf.Path) {
		log.Printf("错误: 代理路径无效 [%s]，跳过设置", conf.Path)
		return
	}

	// 额外检查路径是否为空或仅为根路径
	if conf.Path == "" || conf.Path == "/" {
		log.Printf("错误: 代理路径不能为空或仅为根路径 [%s]，跳过设置", conf.Path)
		return
	}

	// 检查目标URL是否有效
	if !strings.HasPrefix(conf.TargetURL, "http"+"://") && !strings.HasPrefix(conf.TargetURL, "https://") {
		log.Printf("错误: 目标URL格式无效 [%s]，跳过设置", conf.TargetURL)
		return
	}

	// 检查特殊冲突路径
	if conf.Path == "/api" || strings.HasPrefix(conf.Path, "/api/") {
		log.Printf("警告: 代理路径 '%s' 可能与API路由冲突，建议更改路径", conf.Path)
		// 继续执行，但发出警告
	}

	if conf.Path == "/assets" || strings.HasPrefix(conf.Path, "/assets/") {
		log.Printf("警告: 代理路径 '%s' 与静态资源路径冲突，建议更改路径", conf.Path)
	}
	target, err := url.Parse(conf.TargetURL)
	if err != nil {
		log.Printf("解析目标URL失败 [%s]: %v", conf.Path, err)
		return
	}

	// 提前编译插件的正则表达式以提升性能
	type compiledPlugin struct {
		plugin plugins.Plugin
		regex  *regexp.Regexp
		config string
	}
	var compiledPlugins []compiledPlugin
	for _, pConfig := range conf.Plugins {
		plugin, exists := plugins.Get(pConfig.Name)
		if !exists {
			log.Printf("警告: 代理 '%s' 配置了未注册的插件 '%s', 已跳过", conf.Name, pConfig.Name)
			continue
		}
		re, err := regexp.Compile(pConfig.Regex)
		if err != nil {
			log.Printf("警告: 代理 '%s' 的插件 '%s' 正则表达式无效 '%s', 已跳过: %v", conf.Name, pConfig.Name, pConfig.Regex, err)
			continue
		}
		compiledPlugins = append(compiledPlugins, compiledPlugin{plugin, re, pConfig.Config})
	}
	handler := func(c *gin.Context) {
		// 1. 执行 BeforeProxy 钩子
		fullURL := c.Request.URL.String()
		for _, cp := range compiledPlugins {
			if cp.regex.MatchString(fullURL) {
				handled, err := cp.plugin.BeforeProxy(c, cp.config)
				if err != nil {
					log.Printf("错误: 插件 '%s' 在代理 '%s' 的 BeforeProxy 钩子中执行失败: %v", cp.plugin.Name(), conf.Name, err)
					c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "插件执行失败"})
					return
				}
				if handled {
					// 插件已完全处理该请求（例如重定向），终止后续流程
					return
				}
			}
		}
		// 为每次请求创建一个新的 ReverseProxy 实例，以确保 Director 和 ModifyResponse 是线程安全的
		proxy := httputil.NewSingleHostReverseProxy(target)

		// 2. 设置标准的 Director
		proxy.Director = func(req *http.Request) {
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.Host = target.Host

			if conf.StripPrefix {
				req.URL.Path = strings.TrimPrefix(req.URL.Path, conf.Path)
				if req.URL.Path == "" {
					req.URL.Path = "/"
				}
			}
		}

		// 3. 使用 ModifyResponse 执行 AfterProxy 钩子
		proxy.ModifyResponse = func(resp *http.Response) error {
			// 使用响应对象中的请求URL进行匹配
			respURL := resp.Request.URL.String()
			for _, cp := range compiledPlugins {
				if cp.regex.MatchString(respURL) {
					if err := cp.plugin.AfterProxy(resp, cp.config); err != nil {
						// 只记录错误，不中断响应
						log.Printf("错误: 插件 '%s' 在代理 '%s' 的 AfterProxy 钩子中执行失败: %v", cp.plugin.Name(), conf.Name, err)
					}
				}
			}
			return nil
		}

		proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
			log.Printf("反向代理错误 [%s -> %s]: %v", conf.Path, conf.TargetURL, err)
			http.Error(w, "反向代理错误", http.StatusBadGateway)
		}

		// 4. 执行代理
		proxy.ServeHTTP(c.Writer, c.Request)
	}

	// 注册路由
	if len(conf.Path) >= 2 {
		pathForWildcard := strings.TrimSuffix(conf.Path, "/")
		r.Any(pathForWildcard, handler)
		r.Any(pathForWildcard+"/*path", handler)
	}
	log.Printf("代理路由已设置: %s -> %s (加载了 %d 个插件)", conf.Path, conf.TargetURL, len(compiledPlugins))
}

// RefreshProxies 刷新代理配置
func RefreshProxies(r *gin.Engine) {
	// 添加defer处理可能的panic
	defer func() {
		if r := recover(); r != nil {
			log.Printf("警告: 刷新代理配置时发生panic: %v", r)
		}
	}()

	log.Printf("开始刷新所有代理路由...")
	// 获取当前启用的代理配置
	var proxies []models.Proxy
	if err := models.DB.Where("enabled = ?", true).Find(&proxies).Error; err != nil {
		log.Printf("刷新代理配置时数据库查询失败: %v", err)
		return
	}

	app.RefreshEngine(r)
	log.Printf("所有路由已刷新，当前有 %d 个活跃代理配置", len(proxies))
}

func GetAvailablePlugins(c *gin.Context) {
	c.JSON(http.StatusOK, plugins.GetAvailablePlugins())
}

// ListProxies 获取所有代理配置
func ListProxies(c *gin.Context) {
	var proxies []models.Proxy

	// 过滤参数
	enabled := c.DefaultQuery("enabled", "")
	search := c.DefaultQuery("search", "")

	// 分页参数
	page := c.DefaultQuery("page", "1")
	pageSize := c.DefaultQuery("pageSize", "10")

	// 排序参数
	sortBy := c.DefaultQuery("sortBy", "created_at")
	sortOrder := c.DefaultQuery("sortOrder", "desc")

	// 构建查询
	db := models.DB.Model(&models.Proxy{})

	// 应用过滤
	if enabled != "" {
		isEnabled := enabled == "true"
		db = db.Where("enabled = ?", isEnabled)
	}

	if search != "" {
		search = "%" + search + "%"
		db = db.Where("name LIKE ? OR path LIKE ? OR target_url LIKE ?", search, search, search)
	}

	// 计算总数
	var total int64
	db.Count(&total)

	// 排序和分页
	result := db.Order(sortBy + " " + sortOrder).Scopes(paginate(page, pageSize)).Find(&proxies)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  proxies,
		"total": total,
		"page":  page,
	})
}

// RefreshAllProxies 手动刷新所有代理配置
func RefreshAllProxies(c *gin.Context) {
	router, exists := c.Get("router")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法获取router实例"})
		return
	}

	// 获取engine实例并刷新所有路由
	engine := router.(*gin.Engine)
	log.Printf("手动触发刷新所有代理路由")
	RefreshProxies(engine)

	c.JSON(http.StatusOK, gin.H{"message": "所有代理配置已刷新"})

	engine = router.(*gin.Engine)
	// 刷新所有代理配置
	RefreshProxies(engine)

	c.JSON(http.StatusOK, gin.H{"message": "所有代理配置已刷新"})
}

// GetProxy 获取指定代理配置
func GetProxy(c *gin.Context) {
	id := c.Param("id")
	var proxy models.Proxy
	if err := models.DB.First(&proxy, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "代理配置未找到"})
		return
	}

	c.JSON(http.StatusOK, proxy)
}

// CreateProxy 创建新代理配置
func CreateProxy(c *gin.Context) {
	var proxy models.Proxy

	if err := c.ShouldBindJSON(&proxy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 验证路径格式
	if !isValidProxyPath(proxy.Path) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "代理路径格式无效"})
		return
	}

	// 确保路径以/开头
	if !strings.HasPrefix(proxy.Path, "/") {
		proxy.Path = "/" + proxy.Path
	}

	// 检查路径是否已存在
	var count int64
	models.DB.Model(&models.Proxy{}).Where("path = ?", proxy.Path).Count(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "代理路径已存在"})
		return
	}

	// 检查目标URL格式
	if !strings.HasPrefix(proxy.TargetURL, "http"+"://") && !strings.HasPrefix(proxy.TargetURL, "https://") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "目标URL必须以http://或https://开头"})
		return
	}

	// GORM 会自动创建 proxy 和它所包含的 plugins
	if result := models.DB.Create(&proxy); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	// 总是刷新所有代理路由，而不仅仅是设置新的代理
	router, exists := c.Get("router")
	if exists {
		engine := router.(*gin.Engine)
		log.Printf("新代理配置已创建: %s，刷新所有路由", proxy.Path)
		RefreshProxies(engine)
	} else {
		log.Printf("警告: 无法从上下文获取router实例，代理路由可能未设置")
		// 继续执行，因为数据库记录已创建
	}

	c.JSON(http.StatusCreated, proxy)
}

// UpdateProxy 更新代理配置
func UpdateProxy(c *gin.Context) {
	id := c.Param("id")

	var inputData models.Proxy
	if err := c.ShouldBindJSON(&inputData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var existingProxy models.Proxy
	err := models.DB.Transaction(func(tx *gorm.DB) error {

		if err := tx.First(&existingProxy, "id = ?", id).Error; err != nil {
			return err // 找不到记录
		}

		// 更新代理的主体字段
		existingProxy.Name = inputData.Name
		existingProxy.Description = inputData.Description
		existingProxy.Path = inputData.Path
		existingProxy.TargetURL = inputData.TargetURL
		existingProxy.Enabled = inputData.Enabled
		existingProxy.StripPrefix = inputData.StripPrefix
		existingProxy.Plugins = inputData.Plugins
		return tx.Save(&existingProxy).Error
	})

	if err != nil {
		// ... 错误处理 ...
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 始终刷新代理配置，无论是否更改了路径或状态
	router, exists := c.Get("router")
	if exists {
		engine := router.(*gin.Engine)
		log.Printf("代理配置已更新: %s，刷新所有路由", inputData.Path)
		RefreshProxies(engine)
	} else {
		log.Printf("警告: 无法从上下文获取router实例，代理路由可能未完全刷新")
		// 继续执行而不是中断，因为数据库更新已经完成
	}
	c.JSON(http.StatusOK, existingProxy)
}

// DeleteBatchProxies 批量删除代理配置
func DeleteBatchProxies(c *gin.Context) {
	var request struct {
		IDs []string `json:"ids"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求参数"})
		return
	}

	if len(request.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供要删除的代理ID"})
		return
	}

	// 删除代理配置
	result := models.DB.Delete(&models.Proxy{}, "id IN ?", request.IDs)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	// 刷新代理配置
	router, exists := c.Get("router")
	if exists {
		engine := router.(*gin.Engine)
		log.Printf("已批量删除 %d 个代理配置，刷新所有路由", len(request.IDs))
		RefreshProxies(engine)
	} else {
		log.Printf("警告: 无法从上下文获取router实例，代理路由可能未完全刷新")
	}

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("已删除 %d 个代理配置", result.RowsAffected)})
}

// DeleteProxy 删除代理配置
func DeleteProxy(c *gin.Context) {
	id := c.Param("id")

	// 获取代理配置信息（用于刷新路由）
	var proxy models.Proxy
	if err := models.DB.First(&proxy, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "代理配置未找到"})
		return
	}

	// 删除代理配置
	result := models.DB.Delete(&models.Proxy{}, "id = ?", id)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	// 完全刷新所有代理配置
	router, exists := c.Get("router")
	if exists {
		engine := router.(*gin.Engine)
		log.Printf("代理配置已删除: %s，刷新所有路由", proxy.Path)
		RefreshProxies(engine)
	} else {
		log.Printf("警告: 无法从上下文获取router实例，代理路由可能未完全刷新")
		// 继续执行
	}

	c.JSON(http.StatusOK, gin.H{"message": "代理配置已删除"})
}
