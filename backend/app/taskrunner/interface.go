package taskrunner

import (
	"astrm/backend/models"
	"context"
	"fmt"
	"sync"
)

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

	// RegisterHandler 注册任务执行器
	RegisterHandler(executorType string, handler TaskHandler)
}

type TaskHandler interface {
	Handle(task *models.Task, log chan<- string) (result any, err error)
}

type Future struct {
	err      error
	result   any
	mutex    sync.Mutex
	cancel   context.CancelFunc
	finished bool
}

func (f *Future) GetResult() (any, error) {
	f.mutex.Lock()
	defer f.mutex.Unlock()
	return f.result, f.err
}

// Stop 停止任务执行
func (f *Future) Stop() error {
	if f.cancel != nil {
		f.cancel()
		return nil
	}
	return fmt.Errorf("无法停止任务：任务未运行或已完成")
}
