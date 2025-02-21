package alist

import (
	"astrm/libs/job"
	"astrm/utils"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"strings"
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
	for _, from := range j.From {
		list := a.FsList(from, true, j.Opts.Filters)
		for content := range list {
			o := job.SaveOpt{
				Opts: &j.Opts,
				From: from,
				Dest: j.Dest,
				Name: content.Name,
			}

			switch j.Mode {
			case "raw_url":
				if get, err := a.FsGet(content.Name); err != nil {
					o.Content = []byte(get.RawURL)
				} else {
					log.Println(err)
					continue
				}

			case "alist_path":
				o.Content = []byte(content.Name)
			default:
				r, _ := url.JoinPath(a.Endpoint, "/d/", content.Name)
				if content.Sign != "" {
					r = r + "?sign=" + content.Sign
				}
				o.Content = []byte(r)
			}
			if err = job.Save(o); err != nil {
				log.Printf("[Save Error] %v", err)
			}
		}
	}
	return
}

func (a *Server) sendRequest(uri, method, data string) (result Result, err error) {
	var (
		u       string
		payload *strings.Reader
	)
	u, _ = url.JoinPath(a.Endpoint, uri)
	if data != "" {
		payload = strings.NewReader(data)
	}

	req, _ := http.NewRequest(method, u, payload)

	req.Header.Add("content-type", "application/json")
	req.Header.Add("Accept", "application/json, text/plain, */*")
	req.Header.Add("Authorization", a.Token)
	res, _ := http.DefaultClient.Do(req)

	if res.StatusCode != 200 {
		err = fmt.Errorf("uri: %s, status code: %d", uri, res.StatusCode)
		return
	}
	defer func(Body io.ReadCloser) {
		_ = Body.Close()
	}(res.Body)
	body, _ := io.ReadAll(res.Body)
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

func (a *Server) FsList(path string, recursion bool, filter string) (res <-chan Content) {

	gen := func(pending []string, recursion bool, filter func(path string) bool, c chan<- Content) {
		defer close(c)
		for len(pending) > 0 {
			path := pending[0]
			pending = pending[1:]
			data := fmt.Sprintf(`{"path":"%s","password":"","page":1,"per_page":0,"refresh":false}`, path)
			result, err := a.sendRequest("api/fs/list", "POST", data)
			if err != nil {
				log.Printf("[FsList Error] path: %s, err: %v", path, err)
				return
			}

			var fsList FsList
			if err = utils.MapToStruct(result.Data, &fsList); err != nil {
				return
			}

			if total := fsList.Total; total == 0 {
				return
			}

			for _, content := range fsList.Content {
				content.Name = strings.Join([]string{path, content.Name}, "/")
				if recursion && content.IsDir {
					pending = append(pending, content.Name)
				} else if filter != nil && filter(content.Name) {
					c <- content
				}
			}
		}
	}
	iterChan := make(chan Content, 100)
	var filterRegex *regexp.Regexp
	filterRegex = regexp.MustCompile(filter)
	filterFunc := func(p string) bool { return filterRegex.MatchString(filepath.Ext(p)) }
	go gen([]string{path}, recursion, filterFunc, iterChan)
	return iterChan

}

func (a *Server) FsGet(path string) (content FsGet, err error) {
	var result Result
	data := fmt.Sprintf(`{"path":"%s","password":""}`, path)
	result, err = a.sendRequest("api/fs/get", "POST", data)
	if err != nil {
		err = fmt.Errorf("[FsGet Error] path: %s, err: %v", path, err)
		return
	}

	if err = utils.MapToStruct(result.Data, &content); err != nil {
		return
	}
	content.Name = path
	return

}
