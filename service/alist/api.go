package alist

import (
	"astrm/service/job"
	"astrm/utils/concurrent"
	"astrm/utils/iterator"
	"astrm/utils/pandora"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
)

type Server struct {
	Id       int    `yaml:"-" json:"id"`
	Name     string `yaml:"name" json:"name,omitempty"`
	Endpoint string `yaml:"endpoint" json:"endpoint,omitempty"`
	Token    string `yaml:"token" json:"token,omitempty"`
}

type Result struct {
	Code    int64          `json:"code"`
	Message string         `json:"message"`
	Data    map[string]any `json:"data"`
}

type FsList struct {
	Content  []Content `json:"content"`
	Total    int64     `json:"total"`
	Readme   string    `json:"readme"`
	Header   string    `json:"header"`
	Write    bool      `json:"write"`
	Provider string    `json:"provider"`
}

type Content struct {
	Name     string      `json:"name"`
	Size     int64       `json:"size"`
	IsDir    bool        `json:"is_dir"`
	Modified string      `json:"modified"`
	Created  string      `json:"created"`
	Sign     string      `json:"sign"`
	Thumb    string      `json:"thumb"`
	Type     int64       `json:"type"`
	Hashinfo string      `json:"hashinfo"`
	HashInfo interface{} `json:"hash_info"`
	Action   int         `json:"-"`
	Endpoint string      `json:"endpoint"`
}

type FsGet struct {
	Name     string      `json:"name"`
	Size     int64       `json:"size"`
	IsDir    bool        `json:"is_dir"`
	Modified string      `json:"modified"`
	Created  string      `json:"created"`
	Sign     string      `json:"sign"`
	Thumb    string      `json:"thumb"`
	Type     int64       `json:"type"`
	Hashinfo string      `json:"hashinfo"`
	HashInfo interface{} `json:"hash_info"`
	RawURL   string      `json:"raw_url"`
	Readme   string      `json:"readme"`
	Header   string      `json:"header"`
	Provider string      `json:"provider"`
	Related  interface{} `json:"related"`
}

func UnmarshalResponse(data []byte) (Result, error) {
	var r Result
	err := json.Unmarshal(data, &r)
	return r, err
}

func (r *Result) Marshal() ([]byte, error) {
	return json.Marshal(r)
}

func (a *Server) Handle(j *job.Job) (err error) {
	var pool *concurrent.Pool
	ctx := context.TODO()

	if j.Opts.Interval != 0 {
		ticker := time.NewTicker(time.Duration(j.Opts.Interval) * time.Second)
		ctx = context.WithValue(ctx, "i-lock", ticker.C)
		ctx = context.WithValue(ctx, "interval", j.Opts.Interval)
		defer ticker.Stop()
	}

	process := func(content *Content, o *job.SaveOpt) {
		switch content.Action {
		case 1:
			// 获取内容
			var result *http.Response
			result, err = a.Stream(
				ctx,
				content.DownloadUrl(),
				"GET",
				"",
				map[string]any{"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.0.0"},
			)
			if err != nil {
				logrus.Errorln(err)
				return
			}
			o.Body = result.Body
			defer func(Body io.ReadCloser) {
				_ = Body.Close()
			}(result.Body)

		default:
			o.Name = strings.ReplaceAll(o.Name, filepath.Ext(o.Name), ".strm")
			// alist -> strm
			switch j.Mode {
			case "raw_url":
				// 获取 raw url
				if get, err := a.FsGet(ctx, content.Name); err == nil {
					o.Body = strings.NewReader(get.RawURL)
				} else {
					logrus.Errorln(err)
					return
				}

			case "alist_path":
				o.Body = strings.NewReader(content.Name)
			default:
				o.Body = strings.NewReader(content.DownloadUrl())
			}
		}
		err = job.Save(*o)
		if err != nil {
			logrus.Errorln(err)
			return
		}

	}

	if j.Concurrency < 1 {
		j.Concurrency = 1
	}
	pool = concurrent.NewPool(j.Concurrency)

	for _, from := range strings.Split(j.From, "\n") {
		from = strings.TrimSpace(from)
		if from == "" {
			continue
		}
		it := a.FsList(ctx, from, true, j.Opts)
		for ct := range it.Iter() {
			if ct.Error != nil {
				err = ct.Error
				logrus.Errorln(err)
				continue
			}

			content := ct.Content
			o := &job.SaveOpt{
				Opts:       j.Opts,
				From:       from,
				Dest:       j.Dest,
				Name:       content.Name,
				ModifyTime: content.ModifyTime(),
			}
			pool.Submit(process, content, o)

		}
	}
	if pool != nil {
		pool.Shutdown()
	}
	return
}

func (a *Server) Json(ctx context.Context, uri, method, data string, headers map[string]any) (result Result, err error) {
	var res *http.Response
	res, err = a.Stream(ctx, uri, method, data, headers)
	if err != nil {
		err = fmt.Errorf("uri: %s, err: %s", uri, err.Error())
		return
	}
	defer func(Body io.ReadCloser) {
		_ = Body.Close()
	}(res.Body)

	if res.StatusCode != 200 {
		err = fmt.Errorf("uri: %s, status code: %d", uri, res.StatusCode)
		return
	}
	defer func(Body io.ReadCloser) {
		_ = Body.Close()
	}(res.Body)
	var body []byte
	body, err = io.ReadAll(res.Body)
	result, err = UnmarshalResponse(body)
	if err != nil {
		err = fmt.Errorf("uri: %s, err: %v", uri, err)
		return
	}

	if result.Code != 200 {
		err = fmt.Errorf("uri: %s, message: %s", uri, result.Message)
	}

	return
}

func (a *Server) Stream(ctx context.Context, uri, method, data string, headers map[string]any) (res *http.Response, err error) {

	var u string
	if !strings.HasPrefix(uri, a.Endpoint) {
		u, err = url.JoinPath(a.Endpoint, uri)
		if err != nil {
			err = fmt.Errorf("uri: %s, err: %s", uri, err.Error())
			return
		}
	} else {
		u = uri
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			// 去掉referer，不然可能会失败
			req.Header.Del("Referer")
			return nil
		},
	}

	var req *http.Request
	if data != "" {
		req, err = http.NewRequest(method, u, strings.NewReader(data))
	} else {
		req, err = http.NewRequest(method, u, nil)
	}
	if err != nil {
		err = fmt.Errorf("uri: %s, err: %s", uri, err.Error())
		return
	}

	for key, value := range headers {
		req.Header.Add(key, fmt.Sprintf("%v", value))
	}
	req.Header.Add("Authorization", a.Token)

	//并发控制
	if ctx.Value("interval") != nil {
		fmt.Printf("[wait] %v s, data: %s\n", ctx.Value("interval"), data)
		<-ctx.Value("i-lock").(<-chan time.Time)
	}

	res, err = client.Do(req)
	return
}

func (a *Server) FsList(ctx context.Context, path string, recursion bool, opts *job.Opts) (res *iterator.Iterator[*Content]) {

	filterRegex := regexp.MustCompile(opts.Filters)
	var extraFunc func(p string) bool
	if opts.Extra != "" {
		extraRegex := regexp.MustCompile(opts.Extra)
		extraFunc = func(p string) bool { return extraRegex.MatchString(filepath.Ext(p)) }
	}
	filterFunc := func(p string) bool { return filterRegex.MatchString(filepath.Ext(p)) }

	return iterator.Make(func(c context.Context, ch chan<- iterator.Data[*Content]) {
		pending := []string{path}
		for len(pending) > 0 {
			path := pending[0]
			pending = pending[1:]
			data := fmt.Sprintf(`{"path":"%s","password":"","page":1,"per_page":0,"refresh":%t}`, path, opts.Refresh)
			result, err := a.Json(ctx, "api/fs/list", "POST", data, map[string]any{"Content-Type": "application/json"})
			if err != nil {
				err = fmt.Errorf("[FsList Error] path: %s, %v", path, err)
				ch <- iterator.Data[*Content]{Error: err}
				continue
			}

			var fsList FsList
			if err = pandora.MapToStructWithJson(result.Data, &fsList); err != nil {
				ch <- iterator.Data[*Content]{Error: err}
				continue
			}

			if total := fsList.Total; total == 0 {
				continue
			}

			for _, content := range fsList.Content {
				content.Endpoint = a.Endpoint
				content.Name = strings.Join([]string{path, content.Name}, "/")
				if recursion && content.IsDir {
					pending = append(pending, content.Name)
				} else if filterFunc != nil && filterFunc(content.Name) {
					ch <- iterator.Data[*Content]{Content: &content}
				} else if extraFunc != nil && extraFunc(content.Name) {
					content.Action = 1
					ch <- iterator.Data[*Content]{Content: &content}
				}

			}
		}

	})

}

func (a *Server) FsGet(ctx context.Context, path string) (content FsGet, err error) {
	var result Result
	data := fmt.Sprintf(`{"path":"%s","password":""}`, path)
	result, err = a.Json(ctx, "api/fs/get", "POST", data, map[string]any{"Content-Type": "application/json"})
	if err != nil {
		err = fmt.Errorf("[FsGet Error] path: %s, %v", path, err)
		return
	}

	if err = pandora.MapToStructWithJson(result.Data, &content); err != nil {
		return
	}
	content.Name = path
	return

}

func (c Content) DownloadUrl() (r string) {
	r, _ = url.JoinPath(c.Endpoint, "/d/", c.Name)
	if c.Sign != "" {
		r = r + "?sign=" + c.Sign
	}
	return
}

func (c Content) ProxyDownloadUrl() (r string) {
	return strings.Replace(c.DownloadUrl(), "/d/", "/p/", 1)
}

func (c Content) ModifyTime() (t time.Time) {
	layout := "2006-01-02T15:04:05.999Z"
	// 解析时间字符串
	t, _ = time.Parse(layout, c.Modified)
	return
}
