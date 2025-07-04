package handlers

import (
	"astrm/backend/middlewares"
	"astrm/backend/models"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
)

var proxyCache = make(map[string]*httputil.ReverseProxy)

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
func setupProxy(r *gin.Engine, proxyConf models.Proxy) {
	// 使用验证函数检查路径
	if !isValidProxyPath(proxyConf.Path) {
		log.Printf("错误: 代理路径无效 [%s]，跳过设置", proxyConf.Path)
		return
	}

	// 额外检查路径是否为空或仅为根路径
	if proxyConf.Path == "" || proxyConf.Path == "/" {
		log.Printf("错误: 代理路径不能为空或仅为根路径 [%s]，跳过设置", proxyConf.Path)
		return
	}

	// 检查目标URL是否有效
	if !strings.HasPrefix(proxyConf.TargetURL, "http://") && !strings.HasPrefix(proxyConf.TargetURL, "https://") {
		log.Printf("错误: 目标URL格式无效 [%s]，跳过设置", proxyConf.TargetURL)
		return
	}

	// 检查特殊冲突路径
	if proxyConf.Path == "/api" || strings.HasPrefix(proxyConf.Path, "/api/") {
		log.Printf("警告: 代理路径 '%s' 可能与API路由冲突，建议更改路径", proxyConf.Path)
		// 继续执行，但发出警告
	}

	if proxyConf.Path == "/assets" || strings.HasPrefix(proxyConf.Path, "/assets/") {
		log.Printf("警告: 代理路径 '%s' 与静态资源路径冲突，建议更改路径", proxyConf.Path)
	}
	target, err := url.Parse(proxyConf.TargetURL)
	if err != nil {
		log.Printf("解析目标URL失败 [%s]: %v", proxyConf.Path, err)
		return
	}

	// 创建反向代理
	proxy := httputil.NewSingleHostReverseProxy(target)

	// 自定义Director函数，修改请求
	origDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		// 如果启用了StripPrefix
		if proxyConf.StripPrefix && strings.HasPrefix(req.URL.Path, proxyConf.Path) {
			req.URL.Path = strings.TrimPrefix(req.URL.Path, proxyConf.Path)
			// 避免空路径
			if req.URL.Path == "" {
				req.URL.Path = "/"
			}
		}

		// 确保Host头被设置为目标服务器的地址
		req.Host = target.Host

		// 保留原始请求的Host头部信息
		req.Header.Set("X-Forwarded-Host", req.Header.Get("Host"))
		req.Header.Set("X-Forwarded-Proto", req.URL.Scheme)
		req.Header.Set("X-Forwarded-For", req.RemoteAddr)

		// 运行原始Director函数
		origDirector(req)
	}

	// 自定义ModifyResponse函数处理响应
	proxy.ModifyResponse = func(resp *http.Response) error {
		// 处理重定向，确保重定向URL保持正确的代理路径
		if resp.StatusCode >= 300 && resp.StatusCode <= 399 {
			location := resp.Header.Get("Location")
			if location != "" {
				// 如果重定向到绝对路径
				if strings.HasPrefix(location, "http") {
					locationURL, err := url.Parse(location)
					if err == nil && locationURL.Host == target.Host {
						// 重定向到同一主机，需要重写为代理路径
						locationPath := locationURL.Path
						if !proxyConf.StripPrefix {
							// 如果没有移除前缀，直接使用原路径
							resp.Header.Set("Location", proxyConf.Path+locationPath)
						} else {
							// 如果移除了前缀，需要添加代理路径前缀
							resp.Header.Set("Location", proxyConf.Path+locationPath)
						}
					}
				} else if strings.HasPrefix(location, "/") {
					// 相对于根路径的重定向
					if !proxyConf.StripPrefix {
						resp.Header.Set("Location", location)
					} else {
						resp.Header.Set("Location", proxyConf.Path+location)
					}
				}
			}
		}
		return nil
	}

	// 添加错误处理
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("反向代理错误 [%s -> %s]: %v", proxyConf.Path, proxyConf.TargetURL, err)
		http.Error(w, "反向代理错误", http.StatusBadGateway)
	}

	// 缓存代理实例
	proxyCache[proxyConf.Path] = proxy

	// 添加路由 - 同时处理根路径和子路径
	// 确保路径至少包含两个字符（如 /a）以避免Gin内部的索引越界问题
	if len(proxyConf.Path) >= 2 {
		// 处理代理路径，确保不会因为路径末尾有斜杠导致问题
		pathForWildcard := proxyConf.Path
		if strings.HasSuffix(pathForWildcard, "/") {
			// 如果路径末尾已经有斜杠，去除它以避免双斜杠问题
			pathForWildcard = strings.TrimSuffix(pathForWildcard, "/")
		}

		// 注册精确匹配路由
		r.Any(pathForWildcard, func(c *gin.Context) {
			proxy.ServeHTTP(c.Writer, c.Request)
		})

		// 注册通配符路由，使用处理过的路径
		r.Any(pathForWildcard+"/*path", func(c *gin.Context) {
			proxy.ServeHTTP(c.Writer, c.Request)
		})
	} else {
		log.Printf("警告: 代理路径太短 [%s]，可能导致路由问题", proxyConf.Path)
		return
	}

	log.Printf("代理路由已设置: %s -> %s", proxyConf.Path, proxyConf.TargetURL)
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
	result := models.DB.Where("enabled = ?", true).Find(&proxies)
	if result.Error != nil {
		log.Printf("刷新代理配置失败: %v", result.Error)
		return
	}

	// 清除现有的代理缓存
	proxyCache = make(map[string]*httputil.ReverseProxy)

	// 创建新的引擎实例
	newEngine := gin.Default()

	// 添加中间件
	newEngine.Use(middlewares.CORSMiddleware())
	newEngine.Use(middlewares.LoggerMiddleware())
	newEngine.Use(middlewares.RouterMiddleware(newEngine))

	// 设置静态文件目录
	newEngine.Static("/assets", "/Users/ws/Documents/code/astrm/frontend/dist/assets")
	newEngine.StaticFile("/", "/Users/ws/Documents/code/astrm/frontend/dist/index.html")

	// 设置API路由
	api := newEngine.Group("/api")
	{
		// 任务相关接口
		tasks := api.Group("/tasks")
		{
			tasks.GET("/", ListTasks)
			tasks.GET("/:id", GetTask)
			tasks.POST("/", CreateTask)
			tasks.PUT("/:id", UpdateTask)
			tasks.DELETE("/:id", DeleteTask)
			tasks.POST("/:id/run", RunTask)
			tasks.GET("/:id/logs", GetTaskLogs)
		}

		// 配置相关接口
		configs := api.Group("/configs")
		{
			configs.GET("/", ListConfigs)
			configs.GET("/:id", GetConfig)
			configs.POST("/", CreateConfig)
			configs.PUT("/:id", UpdateConfig)
			configs.DELETE("/:id", DeleteConfig)
			configs.GET("/schema", GetConfigSchema)
		}

		// 日志相关接口
		logs := api.Group("/logs")
		{
			logs.GET("/", ListLogs)
			logs.GET("/:id", GetLog)
			logs.DELETE("/:id", DeleteLog)
			logs.DELETE("/", ClearLogs)
		}

		// 代理配置相关接口
		proxies := api.Group("/proxies")
		{
			proxies.GET("/", ListProxies)
			proxies.GET("/:id", GetProxy)
			proxies.POST("/", CreateProxy)
			proxies.PUT("/:id", UpdateProxy)
			proxies.DELETE("/:id", DeleteProxy)
			proxies.POST("/refresh", RefreshAllProxies)
		}
	}

	// 为每个代理设置路由
	for _, proxy := range proxies {
		setupProxy(newEngine, proxy)
	}

	// 非API路由重定向到前端
	newEngine.NoRoute(func(c *gin.Context) {
		c.File("/Users/ws/Documents/code/astrm/frontend/dist/index.html")
	})

	// 替换原引擎
	*r = *newEngine

	log.Printf("所有路由已刷新，当前有 %d 个活跃代理配置", len(proxies))
}

// setupMainRoutes 设置主要路由
// 获取路由引擎实例从上下文
func getRouterFromContext(c *gin.Context) (*gin.Engine, bool) {
	router, exists := c.Get("router")
	if !exists {
		return nil, false
	}
	return router.(*gin.Engine), true
}

// 刷新单个代理配置
func refreshSingleProxy(r *gin.Engine, proxy models.Proxy) {
	// 如果代理被禁用，则跳过
	if !proxy.Enabled {
		log.Printf("代理 %s 已禁用，跳过路由设置", proxy.Path)
		return
	}

	// 为代理设置路由
	setupProxy(r, proxy)
	log.Printf("代理路由已刷新: %s -> %s", proxy.Path, proxy.TargetURL)
}

func setupMainRoutes(r *gin.Engine) {
	// 设置静态文件目录 - 用于提供前端文件
	r.Static("/assets", "/Users/ws/Documents/code/astrm/frontend/dist/assets")
	r.StaticFile("/", "/Users/ws/Documents/code/astrm/frontend/dist/index.html")

	// API路由
	api := r.Group("/api")
	{
		// 任务相关接口
		tasks := api.Group("/tasks")
		{
			tasks.GET("/", ListTasks)
			tasks.GET("/:id", GetTask)
			tasks.POST("/", CreateTask)
			tasks.PUT("/:id", UpdateTask)
			tasks.DELETE("/:id", DeleteTask)
			tasks.POST("/:id/run", RunTask)
			tasks.GET("/:id/logs", GetTaskLogs)
		}

		// 配置相关接口
		configs := api.Group("/configs")
		{
			configs.GET("/", ListConfigs)
			configs.GET("/:id", GetConfig)
			configs.POST("/", CreateConfig)
			configs.PUT("/:id", UpdateConfig)
			configs.DELETE("/:id", DeleteConfig)
			configs.GET("/schema", GetConfigSchema)
		}

		// 日志相关接口
		logs := api.Group("/logs")
		{
			logs.GET("/", ListLogs)
			logs.GET("/:id", GetLog)
			logs.DELETE("/:id", DeleteLog)
			logs.DELETE("/", ClearLogs)
		}

		// 代理配置相关接口
		proxies := api.Group("/proxies")
		{
			proxies.GET("/", ListProxies)
			proxies.GET("/:id", GetProxy)
			proxies.POST("/", CreateProxy)
			proxies.PUT("/:id", UpdateProxy)
			proxies.DELETE("/:id", DeleteProxy)
		}
	}

	// 非API路由重定向到前端
	r.NoRoute(func(c *gin.Context) {
		c.File("/Users/ws/Documents/code/astrm/frontend/dist/index.html")
	})
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
	if !strings.HasPrefix(proxy.TargetURL, "http://") && !strings.HasPrefix(proxy.TargetURL, "https://") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "目标URL必须以http://或https://开头"})
		return
	}

	// 创建代理配置
	result := models.DB.Create(&proxy)
	if result.Error != nil {
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
	var proxy models.Proxy

	// 检查代理配置是否存在
	if err := models.DB.First(&proxy, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "代理配置未找到"})
		return
	}

	// 保存旧数据用于检查
	oldProxy := proxy

	// 绑定更新数据
	if err := c.ShouldBindJSON(&proxy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 如果路径已更改，检查是否与现有路径冲突
	if oldProxy.Path != proxy.Path {
		var count int64
		models.DB.Model(&models.Proxy{}).Where("path = ? AND id != ?", proxy.Path, id).Count(&count)
		if count > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "代理路径已存在"})
			return
		}
	}

	// 验证路径格式
	if !strings.HasPrefix(proxy.Path, "/") {
		proxy.Path = "/" + proxy.Path
	}

	// 保存更新
	result := models.DB.Save(&proxy)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	// 始终刷新代理配置，无论是否更改了路径或状态
	router, exists := c.Get("router")
	if exists {
		engine := router.(*gin.Engine)
		log.Printf("代理配置已更新: %s，刷新所有路由", proxy.Path)
		RefreshProxies(engine)
	} else {
		log.Printf("警告: 无法从上下文获取router实例，代理路由可能未完全刷新")
		// 继续执行而不是中断，因为数据库更新已经完成
	}

	c.JSON(http.StatusOK, proxy)
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
