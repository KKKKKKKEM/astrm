package server

import (
	"astrm/service/alist"
	"astrm/service/job"
	"fmt"
	"os"
	"strconv"

	"github.com/google/uuid"
	"github.com/robfig/cron/v3"
	"gopkg.in/yaml.v3"
)

type Emby struct {
	Addr      string      `yaml:"addr" json:"addr"`
	ApiKey    string      `yaml:"apiKey" json:"apiKey"`
	HttpStrm  []HttpStrm  `yaml:"httpStrm" json:"httpStrm"`
	AlistStrm []AlistStrm `yaml:"alistStrm" json:"alistStrm"`
}

type Action struct {
	Type string `yaml:"type" json:"type"`
	Args string `yaml:"args" json:"args"`
}

type HttpStrm struct {
	Enable    bool     `yaml:"enable" json:"enable"`
	Match     string   `yaml:"match" json:"match"`
	Actions   []Action `yaml:"actions" json:"actions"`
	TransCode bool     `yaml:"transCode" json:"transCode"`
	FinalURL  bool     `yaml:"finalURL" json:"finalURL"` // 对 URL 进行重定向判断，找到非重定向地址再重定向给客户端，减少客户端重定向次数
}

type AlistStrm struct {
	Enable    bool   `yaml:"enable" json:"enable"`
	Match     string `yaml:"match" json:"match"`
	Actions   Action `yaml:"actions" json:"actions"`
	Alist     int    `yaml:"alist" json:"alist"`
	TransCode bool   `yaml:"transCode" json:"transCode"`
	RawURL    bool   `yaml:"rawURL" json:"rawURL"`
}

type Storage struct {
	Debug       bool            `yaml:"debug"`
	Persistence string          `yaml:"persistence"` // 保留用于向后兼容，但不再使用
	Alist       []*alist.Server `yaml:"alist"`
	Jobs        []*job.Job      `yaml:"jobs"`
	Listen      string          `yaml:"listen"`
	Cron        *cron.Cron      `yaml:"-"`
	Emby        Emby            `yaml:"emby"`
	Log         struct {
		Level int    `yaml:"level"`
		Path  string `yaml:"path"`
	} `yaml:"log"`
	Entrance   string `yaml:"entrance"`
	ConfigPath string `yaml:"-"` // 配置文件路径，不保存到 YAML
}

func (s *Storage) fromYaml(path string) (err error) {
	var yamlFile []byte

	if yamlFile, err = os.ReadFile(path); err != nil {
		return
	}

	err = yaml.Unmarshal(yamlFile, &s)

	return
}

func (s *Storage) store(path string) (err error) {
	// 将 s 写入yaml 文件
	var bytes []byte
	bytes, err = yaml.Marshal(s)
	if err != nil {
		return err
	}

	// 写入文件
	err = os.WriteFile(path, bytes, 0644)
	return
}

// Store 保存配置到持久化文件
func (s *Storage) Store() error {
	return s.store(s.ConfigPath)
}

func (s *Storage) RegisterJob(j *job.Job) (err error) {
	var entryID cron.EntryID
	isInit := j.Id == ""
	// 重新注册
	j.Handler = Cfg.Alist[j.Alist]
	if j.Opts.Filters == "" {
		j.Opts.Filters = VideoRegex
	}

	if j.Mode == "" {
		j.Mode = "alist_url"
	}

	if j.Spec != "" {
		if entryID, err = Cfg.Cron.AddJob(j.Spec, j); err != nil {
			return
		}
		j.Id = fmt.Sprintf("%d", entryID)

	} else {
		j.Id = uuid.NewString()
	}
	if !isInit {
		Cfg.Jobs = append(Cfg.Jobs, j)

	}
	return
}

func (s *Storage) UnRegisterJob(j *job.Job) (err error) {

	if idx, j2 := s.FindJob(j); idx != -1 {
		Cfg.Jobs = append(Cfg.Jobs[:idx], Cfg.Jobs[idx+1:]...)
		if entyId, err2 := strconv.ParseInt(j2.Id, 10, 64); err2 == nil {
			Cfg.Cron.Remove(cron.EntryID(entyId))
		}
	}

	return
}

func (s *Storage) FindJob(j2 *job.Job) (int, *job.Job) {
	for idx, j := range Cfg.Jobs {
		if j.Id == j2.Id || j == j2 {
			return idx, j
		}
	}
	return -1, nil
}
