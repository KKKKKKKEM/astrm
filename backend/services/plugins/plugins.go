// file: plugins/plugin.go
package plugins

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Plugin 是所有插件必须实现的接口
type Plugin interface {
	// Name 返回插件的唯一名称
	Name() string
	// BeforeProxy 在请求转发到目标前执行
	// 可以修改请求，或者完全处理它（例如重定向）
	// 如果返回 true，表示请求已被处理，代理不应继续执行
	BeforeProxy(c *gin.Context, config string) (handled bool, err error)
	// AfterProxy 在从目标收到响应后执行
	// 可以在响应发送给客户端前修改它
	AfterProxy(resp *http.Response, config string) error
}

// registry 持有所有可用的插件实例
var registry = make(map[string]Plugin)

// Register 将一个新插件添加到注册中心
// 应在每个插件文件的 init() 函数中调用
func Register(plugin Plugin) {
	name := plugin.Name()
	if _, exists := registry[name]; exists {
		panic(fmt.Sprintf("插件 '%s' 已被注册", name))
	}
	registry[name] = plugin
}

// Get 根据名称从注册中心获取插件
func Get(name string) (Plugin, bool) {
	plugin, exists := registry[name]
	return plugin, exists
}

// GetAvailablePlugins 返回所有已注册插件的名称列表
func GetAvailablePlugins() []string {
	names := make([]string, 0, len(registry))
	for name := range registry {
		names = append(names, name)
	}
	return names
}
