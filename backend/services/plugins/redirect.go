package plugins

import (
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"log"
	"net/http"
)

// RedirectPlugin 结构体定义了我们的新插件
type RedirectPlugin struct{}

// 关键步骤：在包初始化时，自动将此插件注册到全局注册中心
func init() {
	Register(&RedirectPlugin{})
}

// Name 返回插件的唯一名称，这个名称会显示在前端的下拉列表中。
func (p *RedirectPlugin) Name() string {
	return "RedirectPlugin"
}

// RedirectConfig 定义了此插件可以接受的JSON配置结构。
// 这样使得插件更加灵活，用户可以在前端配置重定向的目标。
type RedirectConfig struct {
	// Dest 重定向的目标URL
	Dest string `json:"dest"`
	// Code 是HTTP重定向状态码 (301或302)
	Code int `json:"code"`
}

// BeforeProxy 是插件的核心逻辑实现。
// 它会在请求被转发到后端目标之前执行。
func (p *RedirectPlugin) BeforeProxy(c *gin.Context, configStr string) (handled bool, err error) {
	// 1. 解析来自前端的JSON配置
	var config RedirectConfig
	if err := json.Unmarshal([]byte(configStr), &config); err != nil {
		// 如果JSON解析失败，返回一个清晰的错误
		return false, fmt.Errorf("RedirectPlugin 配置解析失败: %w", err)
	}

	// 3. 获取当前请求的Host头
	requestHost := c.Request.Host

	// 4. 判断Host是否匹配配置中的 `source_host`
	// 如果匹配，执行重定向逻辑
	log.Printf("RedirectPlugin: 匹配成功! 将请求从 %s 重定向到 %s", requestHost, config.Dest)

	// 确定重定向状态码，默认为 302 (临时重定向)
	code := http.StatusFound                        // 302
	if config.Code == http.StatusMovedPermanently { // 301
		code = config.Code
	}

	// 执行重定向
	c.Redirect(code, config.Dest)

	// 关键：终止 Gin 的处理链，防止请求继续被转发
	c.Abort()

	// 返回 true 表示请求已被此插件完全处理
	return true, nil

}

// AfterProxy 在此插件中不需要执行任何操作，因为逻辑在请求前就完成了。
func (p *RedirectPlugin) AfterProxy(_ *http.Response, _ string) error {
	// 返回 nil 表示没有错误，不修改响应
	return nil
}
