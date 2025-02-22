package proxy

import (
	"github.com/gin-gonic/gin"
	"regexp"
)

var (
	embyRegexp = map[string]map[string]*regexp.Regexp{ // Emby 相关的正则表达式
		"router": {
			"VideosHandler":        regexp.MustCompile(`(?i)^(/emby)?/videos/\d+/(stream|original)`),           // 普通视频处理接口匹配
			"ModifyBaseHtmlPlayer": regexp.MustCompile(`(?i)^/web/modules/htmlvideoplayer/basehtmlplayer.js$`), // 修改 Web 的 basehtmlplayer.js
			"ModifyIndex":          regexp.MustCompile(`^/web/index.html$`),                                    // Web 首页
			"ModifyPlaybackInfo":   regexp.MustCompile(`(?i)^(/emby)?/Items/\d+/PlaybackInfo`),                 // 播放信息处理接口
			"ModifySubtitles":      regexp.MustCompile(`(?i)^(/emby)?/Videos/\d+/\w+/subtitles`),               // 字幕处理接口
		},
		"others": {
			"VideoRedirectReg": regexp.MustCompile(`(?i)^(/emby)?/videos/(.*)/stream/(.*)`), // 视频重定向匹配，统一视频请求格式
		},
	}
	HTTPStrm    StrmFileType = "HTTPStrm"
	AlistStrm   StrmFileType = "AlistStrm"
	UnknownStrm StrmFileType = "UnknownStrm"
	embyAPIKeys              = []string{"api_key", "X-Emby-Token"}
)

type StrmFileType string

type RegexpRouteRule struct {
	Regexp  *regexp.Regexp
	Handler gin.HandlerFunc
}

func proxy(ctx *gin.Context) {
	embyServerHandler := NewHandler()
	for _, rule := range embyServerHandler.GetRegexpRouteRules() {
		if rule.Regexp.MatchString(ctx.Request.RequestURI) { // 带有查询参数的字符串：/emby/Items/54/Images/Primary?maxWidth=600&tag=f66addf8af207bdc39cdb4dd56db0d0b&quality=90
			rule.Handler(ctx)
			return
		}
	}

	// 未匹配路由
	embyServerHandler.ReverseProxy(ctx.Writer, ctx.Request)
}
