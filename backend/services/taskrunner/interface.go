package taskrunner

import (
	"astrm/backend/models"
	"context"
)

// TaskExecutor 任务执行器接口，定义不同类型的任务执行器需要实现的方法
type TaskExecutor interface {
	// Execute 执行任务并返回输出流
	Execute(ctx context.Context, task *models.Task, outputChan chan<- string) error

	// Stop 停止任务执行
	Stop() error

	// GetType 获取任务执行器类型
	GetType() string
}

// TaskRunner 定义任务执行的接口
type TaskRunner interface {
	// RunTask 运行指定的任务，返回任务执行的ID和输出流
	RunTask(ctx context.Context, task *models.Task) (string, error)

	// StopTask 停止正在运行的任务
	StopTask(taskID string) error

	// GetTaskStatus 获取任务当前状态
	GetTaskStatus(taskID string) (models.TaskStatus, error)

	// GetTaskOutput 获取任务的输出内容
	GetTaskOutput(taskID string) (string, error)

	// RegisterExecutor 注册任务执行器
	RegisterExecutor(executorType string, executor TaskExecutor)
}
