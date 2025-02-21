package server

import (
	"astrm/libs/alist"
	"astrm/libs/job"
	"fmt"
	"github.com/google/uuid"
	"github.com/robfig/cron/v3"
	"gopkg.in/yaml.v3"
	"os"
	"strconv"
)

type Storage struct {
	Alist  []*alist.Server `yaml:"alist"`
	Jobs   []*job.Job      `yaml:"jobs"`
	Listen string          `yaml:"listen"`
	Cron   *cron.Cron      `yaml:"-"`
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

	// 写入文件
	err = os.WriteFile(path, bytes, 0644)
	return
}

func (s *Storage) RegisterJob(j *job.Job) (err error) {
	var entryID cron.EntryID
	isInit := j.Id == ""
	// 重新注册
	j.Handler = DB.Alist[j.Alist]
	if j.Opts.Filters == "" {
		j.Opts.Filters = VideoRegex
	}

	if j.Spec != "" {
		if entryID, err = DB.Cron.AddJob(j.Spec, j); err != nil {
			return
		}
		j.Id = fmt.Sprintf("%d", entryID)

	} else {
		j.Id = uuid.NewString()
	}
	if !isInit {
		DB.Jobs = append(DB.Jobs, j)

	}
	return
}

func (s *Storage) UnRegisterJob(j *job.Job) (err error) {

	if idx, j2 := s.FindJob(j); idx != -1 {
		DB.Jobs = append(DB.Jobs[:idx], DB.Jobs[idx+1:]...)
		if entyId, err2 := strconv.ParseInt(j2.Id, 10, 64); err2 == nil {
			DB.Cron.Remove(cron.EntryID(entyId))
		}
	}

	return
}

func (s *Storage) FindJob(j2 *job.Job) (int, *job.Job) {
	for idx, j := range DB.Jobs {
		if j.Id == j2.Id || j == j2 {
			return idx, j
		}
	}
	return -1, nil
}
