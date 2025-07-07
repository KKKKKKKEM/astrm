package models

import (
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

// Task 表示系统中的任务
type Task struct {
	BaseModel
	Name        string         `json:"name" gorm:"not null"`
	Description string         `json:"description"`
	Concurrency int            `json:"concurrency" gorm:"default:1"`
	Command     string         `json:"command"`
	Schedule    string         `json:"schedule"` // cron表达式
	Opts        map[string]any `json:"opts" gorm:"serializer:json"`
	Enabled     bool           `json:"enabled" gorm:"default:true"`
	Status      TaskStatus     `json:"status" gorm:"default:'idle'"`
	LastRun     *time.Time     `json:"last_run"`
	NextRun     *time.Time     `json:"next_run"`
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
