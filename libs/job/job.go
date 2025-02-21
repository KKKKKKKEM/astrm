package job

import (
	"astrm/utils"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
)

type Opts struct {
	Deep      int    `yaml:"deep" json:"deep"`
	Overwrite bool   `yaml:"overwrite" json:"overwrite"`
	Filters   string `yaml:"filters" json:"filters"`
	Extra     string `yaml:"extra" json:"extra"`
}

type SaveOpt struct {
	*Opts
	From    string
	Dest    string
	Name    string
	Content []byte
}

type Job struct {
	Id      string  `yaml:"-" json:"id,omitempty"`
	Name    string  `yaml:"name" json:"name,omitempty"`
	Alist   int     `yaml:"alist" json:"alist"`
	From    string  `yaml:"from" json:"from,omitempty"`
	Dest    string  `yaml:"dest" json:"dest,omitempty"`
	Mode    string  `yaml:"mode" json:"mode,omitempty"`
	Spec    string  `yaml:"spec" json:"spec"`
	Opts    Opts    `yaml:"opts" json:"opts"`
	Handler Handler `yaml:"-" json:"-"`
}

func (j Job) Run() {
	err := j.Handler.Handle(&j)
	if err != nil {
		log.Printf("error running job, job name: %s, job id: %s, err: %v\n", j.Name, j.Id, err)
		return
	}

}

func Save(opt SaveOpt) (err error) {
	fromDirs := strings.Split(opt.From, "/")
	opt.Dest = strings.ReplaceAll(opt.Dest, "/", string(filepath.Separator))
	destDirs := strings.Split(opt.Dest, string(filepath.Separator))
	destDirs = append(destDirs, fromDirs[len(fromDirs)-opt.Deep:]...)
	filePath := filepath.Join(append(destDirs, strings.ReplaceAll(opt.Name, opt.From, ""))...)
	filePath = strings.ReplaceAll(filePath, filepath.Ext(filePath), ".strm")
	if !opt.Overwrite && utils.Exists(filePath) {
		return
	}
	var file *os.File
	dirName := filepath.Dir(filePath)
	err = os.MkdirAll(dirName, os.ModePerm)
	if err != nil {
		fmt.Println("mkdir error: ", err)
		return err
	}

	if file, err = os.Create(filePath); err != nil {
		return
	}

	if _, err = file.Write(opt.Content); err != nil {
		return
	}
	log.Print("save: ", filePath)
	return

}
