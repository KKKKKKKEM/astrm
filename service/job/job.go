package job

import (
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
)

type Opts struct {
	Deep      int              `yaml:"deep" json:"deep"`
	Overwrite bool             `yaml:"overwrite" json:"overwrite"`
	Filters   string           `yaml:"filters" json:"filters"`
	Refresh   bool             `yaml:"refresh" json:"refresh"`
	Extra     string           `yaml:"extra" json:"extra"`
	Interval  float64          `yaml:"interval" json:"interval"`
	C         <-chan time.Time `yaml:"-" json:"-"`
}

type SaveOpt struct {
	*Opts
	From       string
	Dest       string
	Name       string
	Body       io.Reader
	ModifyTime time.Time
}

func (opt *SaveOpt) FmtSavePath() string {
	fromDirs := strings.Split(strings.TrimLeft(opt.From, "/"), "/")
	opt.Dest = strings.ReplaceAll(opt.Dest, "/", string(filepath.Separator))
	targetDir := filepath.Join(append([]string{opt.Dest}, fromDirs[len(fromDirs)-opt.Deep:]...)...)

	return filepath.Join(targetDir, strings.Replace(opt.Name, opt.From, "", -1))	
}

func (opt *SaveOpt) IsWrite(savePath string, referenceTime time.Time) (state bool) {
	if opt.Overwrite {
		return true
	}
	// 获取文件状态信息
	fileInfo, err := os.Stat(savePath)
	if err != nil {
		return true
	}

	// 获取修改时间
	modTime := fileInfo.ModTime()
	// 修改时间在参考时间之前，则返回 true
	if referenceTime.After(modTime) {
		return true
	}

	if fileInfo.Size() == 0 {
		return true
	}

	return false

}

type Job struct {
	Id          string  `yaml:"-" json:"id,omitempty"`
	Name        string  `yaml:"name" json:"name,omitempty"`
	Alist       int     `yaml:"alist" json:"alist"`
	From        string  `yaml:"from" json:"from,omitempty"`
	Dest        string  `yaml:"dest" json:"dest,omitempty"`
	Mode        string  `yaml:"mode" json:"mode,omitempty"`
	Spec        string  `yaml:"spec" json:"spec"`
	Opts        *Opts   `yaml:"opts" json:"opts"`
	Handler     Handler `yaml:"-" json:"-"`
	Concurrency int     `yaml:"concurrency" json:"concurrency"`
}

func (j Job) Run() {
	logrus.Printf("[start] job name: %s, job id: %s\n", j.Name, j.Id)
	err := j.Handler.Handle(&j)
	if err != nil {
		logrus.Printf("[failed] job name: %s, job id: %s, err: %v\n", j.Name, j.Id, err)
		return
	}
	logrus.Printf("[success] job name: %s, job id: %s\n", j.Name, j.Id)

}

func Save(opt SaveOpt) (err error) {
	filePath := opt.FmtSavePath()
	if !opt.IsWrite(filePath, opt.ModifyTime) {
		return
	}
	var file *os.File
	dirName := filepath.Dir(filePath)
	err = os.MkdirAll(dirName, os.ModePerm)
	if err != nil {
		logrus.Errorln("mkdir error: ", err)
		return err
	}

	if file, err = os.Create(filePath); err != nil {
		return
	}
	defer func(file *os.File) {
		_ = file.Close()
	}(file)
	_, err = io.Copy(file, opt.Body)
	if err != nil {
		logrus.Errorln("Failed to save file:", err)
		return
	}

	logrus.Infof("[Save] %s -> %s ", opt.From, filePath)

	return

}
