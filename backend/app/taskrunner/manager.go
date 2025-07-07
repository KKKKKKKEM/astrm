package taskrunner

import (
	"context"
	"log"
	"sync"
)

// TaskManager 管理所有任务执行器的单例
type TaskManager struct {
	runner TaskRunner
	mutex  sync.RWMutex
}

var (
	instance *TaskManager
	once     sync.Once
)

// GetTaskManager 获取任务管理器单例
func GetTaskManager() *TaskManager {
	once.Do(func() {
		// 创建任务执行器
		runner := NewTaskRunner()
		instance = &TaskManager{runner: runner}

		log.Printf("任务管理器初始化完成")
	})
	return instance
}

// GetRunner 获取任务执行器
func (m *TaskManager) GetRunner() TaskRunner {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m.runner
}

// SetRunner 设置任务执行器（用于测试或自定义执行器）
func (m *TaskManager) SetRunner(runner TaskRunner) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.runner = runner
}

// ShutdownAll 关闭所有任务
func (m *TaskManager) ShutdownAll(ctx context.Context) {
	// 实现根据实际需要补充
	log.Printf("关闭所有运行中的任务")
}
