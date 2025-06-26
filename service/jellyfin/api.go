package jellyfin

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
)

type Jellyfin struct {
	endpoint string
	apiKey   string // 认证方式：APIKey；获取方式：Emby控制台 -> 高级 -> API密钥
	proxy    *httputil.ReverseProxy
}

// 初始化函数
func (jellyfin *Jellyfin) Init() {
	jellyfin.initProxy()
}

// 初始化proxy
func (jellyfin *Jellyfin) initProxy() {
	target, _ := url.Parse(jellyfin.endpoint)
	baseProxy := httputil.NewSingleHostReverseProxy(target)
	jellyfin.proxy = &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			// 确保Host头被设置为目标服务器的地址
			req.Host = target.Host
			// 保留原始请求的Host头部信息
			req.Header.Set("X-Forwarded-Host", req.Header.Get("Host"))
			baseProxy.Director(req)
		},
	}
}

// 获取 Jellyfin 连接地址
//
// 包含协议、服务器域名（IP）、端口号
// 示例：return "http://jellyfin.example.com:8096"
func (jellyfin *Jellyfin) GetEndpoint() string {
	return jellyfin.endpoint
}

// 获取 Jellyfin 的API Key
func (jellyfin *Jellyfin) GetAPIKey() string {
	return jellyfin.apiKey
}

//// 获取反代服务器
////
//// 根据EmbyServer的proxy创建一个新的反代服务器用于处理请求
//// 对此httputil.ReverseProxy进行修改不影响EmbyServer的ReverseProxy()方法的行为
//func (embyServer *EmbyServer) GetReverseProxy() *httputil.ReverseProxy {
//	return &httputil.ReverseProxy{Director: embyServer.proxy.Director}
//}
//
//// 反代上游响应
//func (embyServer *EmbyServer) ReverseProxy(rw http.ResponseWriter, req *http.Request) {
//	if embyServer.proxy != nil {
//		embyServer.proxy.ServeHTTP(rw, req)
//	} else {
//		panic("反代服务器未初始化")
//	}
//}

// ItemsService
// /Items
func (jellyfin *Jellyfin) ItemsServiceQueryItem(ids string, limit int, fields string) (*Response, error) {
	var (
		params       = url.Values{}
		itemResponse = &Response{}
	)
	params.Add("Ids", ids)
	params.Add("Limit", strconv.Itoa(limit))
	params.Add("Fields", fields)
	params.Add("api_key", jellyfin.GetAPIKey())

	resp, err := http.Get(jellyfin.GetEndpoint() + "/Items?" + params.Encode())
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if err = json.Unmarshal(body, itemResponse); err != nil {
		return nil, err
	}
	return itemResponse, nil
}

// 获取EmbyServer实例
func New(addr string, apiKey string) *Jellyfin {
	if !strings.HasPrefix(addr, "http") {
		addr = "http://" + addr
	}
	jellyfin := &Jellyfin{
		endpoint: strings.TrimSuffix(addr, "/"),
		apiKey:   apiKey,
	}
	jellyfin.Init()
	return jellyfin
}
