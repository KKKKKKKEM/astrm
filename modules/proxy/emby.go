package proxy

import (
	"astrm/server"
	"astrm/service/emby"
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/sirupsen/logrus"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path"
	"reflect"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// Emby服务器处理器
type EmbyServerHandler struct {
	server         *emby.EmbyServer                   // Emby 服务器
	modifyProxyMap map[uintptr]*httputil.ReverseProxy // 修改响应的代理存取映射
	routerRules    []RegexpRouteRule                  // 正则路由规则
}

// 初始化
func NewHandler() *EmbyServerHandler {
	embyServerHandler := &EmbyServerHandler{}
	embyServerHandler.server = emby.New(server.Cfg.Emby.Addr, server.Cfg.Emby.ApiKey)
	if embyServerHandler.modifyProxyMap == nil {
		embyServerHandler.modifyProxyMap = make(map[uintptr]*httputil.ReverseProxy)
	}
	{ // 初始化路由规则
		embyServerHandler.routerRules = []RegexpRouteRule{
			{
				Regexp:  embyRegexp["router"]["VideosHandler"],
				Handler: embyServerHandler.VideosHandler,
			},
			{
				Regexp:  embyRegexp["router"]["ModifyPlaybackInfo"],
				Handler: embyServerHandler.responseModifyCreater(embyServerHandler.ModifyPlaybackInfo),
			},
			{
				Regexp:  embyRegexp["router"]["ModifyBaseHtmlPlayer"],
				Handler: embyServerHandler.responseModifyCreater(embyServerHandler.ModifyBaseHtmlPlayer),
			},
		}

	}
	return embyServerHandler
}

// 转发请求至上游服务器
func (embyServerHandler *EmbyServerHandler) ReverseProxy(rw http.ResponseWriter, req *http.Request) {
	embyServerHandler.server.ReverseProxy(rw, req)
}

// 正则路由表
func (embyServerHandler *EmbyServerHandler) GetRegexpRouteRules() []RegexpRouteRule {
	return embyServerHandler.routerRules
}

// 响应修改创建器
//
// 将需要修改上游响应的处理器包装成一个 gin.HandlerFunc 处理器
func (embyServerHandler *EmbyServerHandler) responseModifyCreater(modifyResponse func(rw *http.Response) error) gin.HandlerFunc {
	key := reflect.ValueOf(modifyResponse).Pointer()
	if _, ok := embyServerHandler.modifyProxyMap[key]; !ok {
		proxy := embyServerHandler.server.GetReverseProxy()
		proxy.ModifyResponse = modifyResponse
		embyServerHandler.modifyProxyMap[key] = proxy
	} else {
		logrus.Debugln("重复创建响应修改处理器：", key)
	}

	return func(ctx *gin.Context) {
		embyServerHandler.modifyProxyMap[key].ServeHTTP(ctx.Writer, ctx.Request)
	}
}

// 根据 Strm 文件路径识别 Strm 文件类型
//
// 返回 Strm 文件类型和一个可选配置
func (embyServerHandler *EmbyServerHandler) RecgonizeStrmFileType(strmFilePath string) (StrmFileType, int) {

	for i, strm := range server.Cfg.Emby.HttpStrm {
		if matched, err := regexp.MatchString(strm.Match, strmFilePath); err != nil {
			return UnknownStrm, -1
		} else if matched {
			return HTTPStrm, i
		}
	}
	for i, strm := range server.Cfg.Emby.AlistStrm {
		if matched, err := regexp.MatchString(strm.Match, strmFilePath); err != nil {
			return UnknownStrm, -1
		} else if matched {
			return AlistStrm, i
		}
	}
	return UnknownStrm, -1
}

// 修改播放信息请求
//
// /Items/:itemId/PlaybackInfo
// 强制将 HTTPStrm 设置为支持直链播放和转码、AlistStrm 设置为支持直链播放并且禁止转码
func (embyServerHandler *EmbyServerHandler) ModifyPlaybackInfo(rw *http.Response) error {
	defer rw.Body.Close()
	body, err := io.ReadAll(rw.Body)
	if err != nil {
		logrus.Errorln("读取 Body 出错：", err)
		return err
	}

	var playbackInfoResponse emby.PlaybackInfoResponse
	err = json.Unmarshal(body, &playbackInfoResponse)
	if err != nil {
		logrus.Errorln("解析 emby.PlaybackInfoResponse Json 错误：", err)
		return err
	}
	for index, mediasource := range playbackInfoResponse.MediaSources {
		itemResponse, err := embyServerHandler.server.ItemsServiceQueryItem(strings.Replace(*mediasource.ID, "mediasource_", "", 1), 1, "Path,MediaSources") // 查询 item 需要去除前缀仅保留数字部分
		if err != nil {
			logrus.Errorln("请求 ItemsServiceQueryItem 失败：", err)
			continue
		}
		item := itemResponse.Items[0]
		strmFileType, idx := embyServerHandler.RecgonizeStrmFileType(*item.Path)
		var msg string
		switch strmFileType {
		case HTTPStrm: // HTTPStrm 设置支持直链播放并且支持转码
			if !server.Cfg.Emby.HttpStrm[idx].TransCode {
				*playbackInfoResponse.MediaSources[index].SupportsDirectPlay = true
				*playbackInfoResponse.MediaSources[index].SupportsDirectStream = true
				playbackInfoResponse.MediaSources[index].TranscodingURL = nil
				playbackInfoResponse.MediaSources[index].TranscodingSubProtocol = nil
				playbackInfoResponse.MediaSources[index].TranscodingContainer = nil
				if mediasource.DirectStreamURL != nil {
					apikeypair, err := ResolveEmbyAPIKVPairs(*mediasource.DirectStreamURL)
					if err != nil {
						logrus.Errorln("解析API键值对失败：", err)
						continue
					}
					directStreamURL := fmt.Sprintf("/videos/%s/stream?MediaSourceId=%s&Static=true&%s", *mediasource.ItemID, *mediasource.ID, apikeypair)
					playbackInfoResponse.MediaSources[index].DirectStreamURL = &directStreamURL
					msg = fmt.Sprintf("%s 强制禁止转码，直链播放链接为: %s，", *mediasource.Name, directStreamURL)
				}
			}

		case AlistStrm: // AlistStm 设置支持直链播放并且禁止转码
			if !server.Cfg.Emby.AlistStrm[idx].TransCode {
				*playbackInfoResponse.MediaSources[index].SupportsDirectPlay = true
				*playbackInfoResponse.MediaSources[index].SupportsDirectStream = true
				*playbackInfoResponse.MediaSources[index].SupportsTranscoding = false
				playbackInfoResponse.MediaSources[index].TranscodingURL = nil
				playbackInfoResponse.MediaSources[index].TranscodingSubProtocol = nil
				playbackInfoResponse.MediaSources[index].TranscodingContainer = nil
				apikeypair, err := ResolveEmbyAPIKVPairs(*mediasource.DirectStreamURL)
				if err != nil {
					logrus.Errorln("解析API键值对失败：", err)
					continue
				}
				directStreamURL := fmt.Sprintf("/videos/%s/stream?MediaSourceId=%s&Static=true&%s", *mediasource.ItemID, *mediasource.ID, apikeypair)
				playbackInfoResponse.MediaSources[index].DirectStreamURL = &directStreamURL
				container := strings.TrimPrefix(path.Ext(*mediasource.Path), ".")
				playbackInfoResponse.MediaSources[index].Container = &container
				msg = fmt.Sprintf("%s 强制禁止转码，直链播放链接为: %s，容器为: %s", *mediasource.Name, directStreamURL, container)
			} else {
				msg = fmt.Sprintf("%s 保持原有转码设置", *mediasource.Name)
			}

			if playbackInfoResponse.MediaSources[index].Size == nil {
				alistServer := server.Cfg.Alist[server.Cfg.Emby.AlistStrm[idx].Alist]
				fsGetData, err := alistServer.FsGet(*mediasource.Path, nil)
				if err != nil {
					logrus.Errorln("请求 FsGet 失败：", err)
					continue
				}
				playbackInfoResponse.MediaSources[index].Size = &fsGetData.Size
				msg += fmt.Sprintf("，设置文件大小为:%d", fsGetData.Size)
			}

		}
	}

	body, err = json.Marshal(playbackInfoResponse)
	if err != nil {
		logrus.Errorln("序列化 emby.PlaybackInfoResponse Json 错误：", err)
		return err
	}

	rw.Body = io.NopCloser(bytes.NewBuffer(body)) // 重置响应体
	// 更新 Content-Length 头
	rw.ContentLength = int64(len(body))
	rw.Header.Set("Content-Length", strconv.Itoa(len(body)))
	// 更新 Content-Type 头
	rw.Header.Set("Content-Type", "application/json")

	return nil
}

// 视频流处理器
//
// 支持播放本地视频、重定向 HttpStrm、AlistStrm
func (embyServerHandler *EmbyServerHandler) VideosHandler(ctx *gin.Context) {
	if ctx.Request.Method == http.MethodHead { // 不额外处理 HEAD 请求
		embyServerHandler.ReverseProxy(ctx.Writer, ctx.Request)
		logrus.Debugln("VideosHandler 不处理 HEAD 请求，转发至上游服务器")
		return
	}

	orginalPath := ctx.Request.URL.Path
	matches := embyRegexp["others"]["VideoRedirectReg"].FindStringSubmatch(orginalPath)
	if len(matches) == 2 {
		redirectPath := fmt.Sprintf("/videos/%s/stream", matches[0])
		logrus.Debugln(orginalPath + " 重定向至：" + redirectPath)
		ctx.Redirect(http.StatusFound, redirectPath)
		return
	}

	// EmbyServer <= 4.8 ====> mediaSourceID = 343121
	// EmbyServer >= 4.9 ====> mediaSourceID = mediasource_31
	mediaSourceID := ctx.Query("mediasourceid")

	logrus.Debugln("请求 ItemsServiceQueryItem：", mediaSourceID)
	itemResponse, err := embyServerHandler.server.ItemsServiceQueryItem(strings.Replace(mediaSourceID, "mediasource_", "", 1), 1, "Path,MediaSources") // 查询 item 需要去除前缀仅保留数字部分
	if err != nil {
		logrus.Debugln("请求 ItemsServiceQueryItem 失败：", err)
		embyServerHandler.server.ReverseProxy(ctx.Writer, ctx.Request)
		return
	}

	item := itemResponse.Items[0]

	if !strings.HasSuffix(strings.ToLower(*item.Path), ".strm") { // 不是 Strm 文件
		logrus.Debugln("播放本地视频：" + *item.Path + "，不进行处理")
		embyServerHandler.server.ReverseProxy(ctx.Writer, ctx.Request)
		return
	}

	strmFileType, idx := embyServerHandler.RecgonizeStrmFileType(*item.Path)
	for _, mediasource := range item.MediaSources {
		if *mediasource.ID == mediaSourceID { // EmbyServer >= 4.9 返回的ID带有前缀mediasource_
			switch strmFileType {
			case HTTPStrm:
				if *mediasource.Protocol == emby.HTTP {
					cfg := server.Cfg.Emby.HttpStrm[idx]

					for _, action := range cfg.Actions {
						switch action.Type {
						case "replace":
							rl := strings.Split(action.Args, "->")
							*mediasource.Path = strings.ReplaceAll(*mediasource.Path, strings.TrimSpace(rl[0]), strings.TrimSpace(rl[1]))

						}
					}

					logrus.Infoln("HTTPStrm 重定向至：", *mediasource.Path)
					ctx.Redirect(http.StatusFound, *mediasource.Path)
				}
				return
			case AlistStrm: // 无需判断 *mediasource.Container 是否以Strm结尾，当 AlistStrm 存储的位置有对应的文件时，*mediasource.Container 会被设置为文件后缀
				alistServer := server.Cfg.Alist[server.Cfg.Emby.AlistStrm[idx].Alist]
				fsGetData, err := alistServer.FsGet(*mediasource.Path, nil)
				if err != nil {
					logrus.Errorln("请求 FsGet 失败：", err)
					return
				}
				var redirectURL string
				if server.Cfg.Emby.AlistStrm[idx].RawURL {
					redirectURL = fsGetData.RawURL
				} else {
					redirectURL = fmt.Sprintf("%s/d%s?sign=%s", alistServer.Endpoint, *mediasource.Path, fsGetData.Sign)
				}
				logrus.Infoln("AlistStrm 重定向至：", redirectURL)
				ctx.Redirect(http.StatusFound, redirectURL)
				return
			case UnknownStrm:
				embyServerHandler.server.ReverseProxy(ctx.Writer, ctx.Request)
				return
			}
		}
	}
}

// 修改 basehtmlplayer.js
//
// 用于修改播放器 JS，实现跨域播放 Strm 文件（302 重定向）
func (embyServerHandler *EmbyServerHandler) ModifyBaseHtmlPlayer(rw *http.Response) error {
	defer rw.Body.Close()
	body, err := io.ReadAll(rw.Body)
	if err != nil {
		return err
	}

	modifiedBodyStr := strings.ReplaceAll(string(body), `mediaSource.IsRemote&&"DirectPlay"===playMethod?null:"anonymous"`, "null") // 修改响应体
	updateBody(rw, modifiedBodyStr)
	return nil

}

// 更新响应体
//
// 修改响应体、更新Content-Length
func updateBody(rw *http.Response, s string) {
	rw.Body = io.NopCloser(bytes.NewBuffer([]byte(s))) // 重置响应体

	// 更新 Content-Length 头
	rw.ContentLength = int64(len(s))
	rw.Header.Set("Content-Length", strconv.Itoa(len(s)))

}

func ResolveEmbyAPIKVPairs(urlString string) (string, error) {

	u, err := url.Parse(urlString)
	if err != nil {
		return "", err
	}
	for quryKey, queryValue := range u.Query() {
		for _, key := range embyAPIKeys {
			if strings.EqualFold(quryKey, key) {
				return fmt.Sprintf("%s=%s", quryKey, queryValue[0]), nil
			}
		}
	}
	return "", nil
}
