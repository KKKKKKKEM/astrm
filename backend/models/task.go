package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// TaskStatus 定义任务状态
type TaskStatus string

const (
	TaskStatusIdle    TaskStatus = "idle"
	TaskStatusRunning TaskStatus = "running"
	TaskStatusSuccess TaskStatus = "success"
	TaskStatusFailed  TaskStatus = "failed"
)

// TaskType 定义任务类型
type TaskType string

const (
	TaskTypeCommand TaskType = "command" // 命令行任务
	TaskTypeAlist   TaskType = "alist"   // Alist任务
)

// TaskOptions 定义任务的选项
type TaskOptions struct {
	Deep      int    `json:"deep" gorm:"default:1"`
	Overwrite bool   `json:"overwrite" gorm:"default:true"`
	Filters   string `json:"filters"`
	Extra     string `json:"extra"`
	Refresh   bool   `json:"refresh" gorm:"default:true"`
	Interval  int    `json:"interval" gorm:"default:1"`
}

type SaveOpt struct {
	*TaskOptions
	From       string
	Dest       string
	Name       string
	Body       io.Reader
	ModifyTime time.Time
}

func (opt *SaveOpt) FmtSavePath() string {
	fromDirs := strings.Split(opt.From, "/")
	opt.Dest = strings.ReplaceAll(opt.Dest, "/", string(filepath.Separator))
	destDirs := strings.Split(opt.Dest, string(filepath.Separator))
	destDirs = append(destDirs, fromDirs[len(fromDirs)-opt.Deep:]...)
	return filepath.Join(append(destDirs, strings.ReplaceAll(opt.Name, opt.From, ""))...)
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

// Value 实现 driver.Valuer 接口，用于数据库存储
func (o TaskOptions) Value() (driver.Value, error) {
	return json.Marshal(o)
}

// Scan 实现 sql.Scanner 接口，用于数据库读取
func (o *TaskOptions) Scan(value interface{}) error {
	data, ok := value.([]byte)
	if !ok {
		return errors.New("无效的数据类型，期望 []byte")
	}
	return json.Unmarshal(data, o)
}

// Task 表示系统中的任务
type Task struct {
	BaseModel
	Name        string      `json:"name" gorm:"not null"`
	Description string      `json:"description"`
	Alist       int         `json:"alist" gorm:"default:0"`
	Concurrency int         `json:"concurrency" gorm:"default:1"`
	From        string      `json:"from" gorm:"type:text"`
	Dest        string      `json:"dest"`
	Mode        string      `json:"mode"`
	Spec        string      `json:"spec"`
	Opts        TaskOptions `json:"opts" gorm:"serializer:json"`
	Command     string      `json:"command"`
	Schedule    string      `json:"schedule"` // cron表达式
	Enabled     bool        `json:"enabled" gorm:"default:true"`
	Status      TaskStatus  `json:"status" gorm:"default:'idle'"`
	LastRun     *time.Time  `json:"last_run"`
	NextRun     *time.Time  `json:"next_run"`
}

// TaskLog 表示任务执行的日志
type TaskLog struct {
	BaseModel
	TaskID    string     `json:"task_id" gorm:"index"`
	StartTime time.Time  `json:"start_time"`
	EndTime   *time.Time `json:"end_time"`
	Status    TaskStatus `json:"status"`
	Output    string     `json:"output" gorm:"type:text"`
}
