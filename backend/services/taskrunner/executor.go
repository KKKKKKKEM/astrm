package taskrunner

import (
	"astrm/backend/models"
	"astrm/backend/services/alist"
	"context"
	"fmt"
	"sync"
)

// AlistTaskExecutor 实现Alist任务的执行逻辑
type AlistTaskExecutor struct {
	task     *models.Task
	mutex    sync.Mutex
	cancel   context.CancelFunc
	finished bool
}

// NewAlistTaskExecutor 创建一个新的Alist任务执行器
func NewAlistTaskExecutor() *AlistTaskExecutor {
	return &AlistTaskExecutor{}
}
func (e *AlistTaskExecutor) Execute(ctx context.Context, task *models.Task, output chan<- string) error {
	// 保存任务和日志ID
	e.task = task
	e.mutex.Lock()
	e.finished = false
	e.mutex.Unlock()

	// 创建可取消的上下文
	ctxWithCancel, cancel := context.WithCancel(ctx)
	e.cancel = cancel

	// 启动一个goroutine执行任务
	go func() {
		defer func() {
			// 确保管道关闭
			close(output)
		}()
		defer cancel()
		// 检查上下文是否已取消
		select {
		case <-ctxWithCancel.Done():
			output <- fmt.Sprintf("任务已取消")
			return
		default:
			// 继续执行

			alistClien := alist.Client{}
			_ = alistClien.Handle(task)

		}

		// 设置完成状态
		e.mutex.Lock()
		e.finished = true
		e.mutex.Unlock()
	}()

	return nil
}

// Stop 停止任务执行
func (e *AlistTaskExecutor) Stop() error {
	if e.cancel != nil {
		e.cancel()
		return nil
	}
	return fmt.Errorf("无法停止任务：任务未运行或已完成")
}

// GetType 获取执行器类型
func (e *AlistTaskExecutor) GetType() string {
	return "alist"
}
