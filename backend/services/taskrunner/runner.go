package taskrunner

import (
	"astrm/backend/models"
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"
)

// DefaultTaskRunner 默认的任务执行器实现
type DefaultTaskRunner struct {
	mutex        sync.RWMutex
	runningTasks map[string]*runningTaskInfo
	executors    map[string]TaskExecutor
}

type runningTaskInfo struct {
	task     *models.Task
	executor TaskExecutor
	output   strings.Builder
	status   models.TaskStatus
	logID    string
}

// NewTaskRunner 创建一个新的任务执行器
func NewTaskRunner() *DefaultTaskRunner {
	runner := &DefaultTaskRunner{
		runningTasks: make(map[string]*runningTaskInfo),
		executors:    make(map[string]TaskExecutor),
	}

	// 注册默认执行器
	//runner.RegisterExecutor("command", executors.NewCommandTaskExecutor())
	runner.RegisterExecutor("alist_url", NewAlistTaskExecutor())

	return runner
}

// RegisterExecutor 注册任务执行器
func (r *DefaultTaskRunner) RegisterExecutor(executorType string, executor TaskExecutor) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	r.executors[executorType] = executor
	log.Printf("已注册任务执行器: %s", executorType)
}

// getExecutorForTask 根据任务类型获取相应的执行器
func (r *DefaultTaskRunner) getExecutorForTask(task *models.Task) (TaskExecutor, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()
	executorIns, exists := r.executors[task.Mode]
	if !exists {
		return nil, fmt.Errorf("未找到任务类型的执行器: %s", task.Mode)
	}
	return executorIns, nil
}

// RunTask 运行指定的任务
func (r *DefaultTaskRunner) RunTask(ctx context.Context, task *models.Task) (string, error) {
	// 检查任务是否已经在运行
	r.mutex.RLock()
	if info, exists := r.runningTasks[task.ID]; exists && info.status == models.TaskStatusRunning {
		r.mutex.RUnlock()
		return "", errors.New("任务已经在运行中")
	}
	r.mutex.RUnlock()

	// 更新任务状态为运行中
	task.Status = models.TaskStatusRunning
	now := time.Now()
	task.LastRun = &now
	if err := models.DB.Save(task).Error; err != nil {
		return "", fmt.Errorf("更新任务状态失败: %w", err)
	}

	// 创建任务日志
	taskLog := models.TaskLog{
		TaskID:    task.ID,
		StartTime: now,
		Status:    models.TaskStatusRunning,
	}
	if err := models.DB.Create(&taskLog).Error; err != nil {
		return "", fmt.Errorf("创建任务日志失败: %w", err)
	}

	// 获取适合该任务的执行器
	executor, err := r.getExecutorForTask(task)
	if err != nil {
		// 更新任务状态为失败
		task.Status = models.TaskStatusFailed
		models.DB.Save(task)

		// 更新日志
		taskLog.Status = models.TaskStatusFailed
		taskLog.Output = fmt.Sprintf("获取任务执行器失败: %v", err)
		endTime := time.Now()
		taskLog.EndTime = &endTime
		models.DB.Save(&taskLog)

		return "", err
	}

	// 创建一个 string 的 chan
	outputChan := make(chan string)

	// 使用执行器执行任务
	err = executor.Execute(ctx, task, outputChan)
	if err != nil {
		// 更新任务状态为失败
		task.Status = models.TaskStatusFailed
		models.DB.Save(task)

		// 更新日志
		taskLog.Status = models.TaskStatusFailed
		taskLog.Output = fmt.Sprintf("启动任务失败: %v", err)
		endTime := time.Now()
		taskLog.EndTime = &endTime
		models.DB.Save(&taskLog)

		return "", fmt.Errorf("启动任务失败: %w", err)
	}

	// 创建任务信息对象
	taskInfo := &runningTaskInfo{
		task:     task,
		executor: executor,
		status:   models.TaskStatusRunning,
		logID:    taskLog.ID,
	}

	r.mutex.Lock()
	r.runningTasks[task.ID] = taskInfo
	r.mutex.Unlock()

	// 创建一个单独的goroutine来监控任务执行
	go func() {

		for line := range outputChan {
			log.Printf("[Task %s] %s", task.ID, line)
			r.mutex.Lock()
			taskInfo.output.WriteString(line + "\n")
			taskLog.Output = taskInfo.output.String()
			models.DB.Save(&taskLog)
			r.mutex.Unlock()
		}

		// 更新任务状态和日志
		endTime := time.Now()
		taskLog.EndTime = &endTime
		taskLog.Output = taskInfo.output.String()
		task.Status = models.TaskStatusSuccess
		taskLog.Status = models.TaskStatusSuccess
		log.Printf("任务 %s 执行完成", task.ID)
		// 保存最终更新
		models.DB.Save(task)
		models.DB.Save(&taskLog)

		// 更新任务信息状态
		r.mutex.Lock()
		delete(r.runningTasks, task.ID)
		r.mutex.Unlock()

	}()

	// 返回日志ID和输出读取器
	return taskLog.ID, nil
}

// StopTask 停止正在运行的任务
func (r *DefaultTaskRunner) StopTask(taskID string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	taskInfo, exists := r.runningTasks[taskID]
	if !exists {
		return errors.New("任务未找到或已经停止")
	}

	if taskInfo.status != models.TaskStatusRunning {
		return errors.New("任务未在运行状态")
	}

	// 使用执行器停止任务
	if err := taskInfo.executor.Stop(); err != nil {
		return fmt.Errorf("停止任务失败: %w", err)
	}

	// 更新状态
	taskInfo.status = models.TaskStatusFailed
	taskInfo.task.Status = models.TaskStatusFailed
	models.DB.Save(taskInfo.task)

	// 更新日志
	var taskLog models.TaskLog
	if err := models.DB.First(&taskLog, "id = ?", taskInfo.logID).Error; err == nil {
		endTime := time.Now()
		taskLog.EndTime = &endTime
		taskLog.Status = models.TaskStatusFailed
		taskLog.Output += "\n任务被手动停止"
		models.DB.Save(&taskLog)
	}

	return nil
}

// GetTaskStatus 获取任务当前状态
func (r *DefaultTaskRunner) GetTaskStatus(taskID string) (models.TaskStatus, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	taskInfo, exists := r.runningTasks[taskID]
	if !exists {
		// 从数据库查询任务状态
		var task models.Task
		if err := models.DB.First(&task, "id = ?", taskID).Error; err != nil {
			return "", errors.New("任务未找到")
		}
		return task.Status, nil
	}

	return taskInfo.status, nil
}

// GetTaskOutput 获取任务的输出内容
func (r *DefaultTaskRunner) GetTaskOutput(taskID string) (string, error) {
	r.mutex.RLock()
	taskInfo, exists := r.runningTasks[taskID]
	r.mutex.RUnlock()

	if !exists {
		// 从数据库查询任务日志
		var taskLog models.TaskLog
		if err := models.DB.Where("task_id = ?", taskID).Order("start_time DESC").First(&taskLog).Error; err != nil {
			return "", errors.New("任务日志未找到")
		}
		return taskLog.Output, nil
	}

	r.mutex.RLock()
	output := taskInfo.output.String()
	r.mutex.RUnlock()

	return output, nil
}
