package handlers

import (
	"astrm/backend/models"
	"astrm/backend/services/taskrunner"
	"bytes"
	"github.com/gin-gonic/gin"
	"io"
	"log"
	"net/http"
)

// ListTasks 获取所有任务
func ListTasks(c *gin.Context) {
	var tasks []models.Task

	// 分页参数
	page := c.DefaultQuery("page", "1")
	pageSize := c.DefaultQuery("pageSize", "10")

	// 排序参数
	sortBy := c.DefaultQuery("sortBy", "created_at")
	sortOrder := c.DefaultQuery("sortOrder", "desc")

	// 构建查询
	db := models.DB.Model(&models.Task{})

	// 计算总数
	var total int64
	db.Count(&total)

	// 排序和分页
	result := db.Order(sortBy + " " + sortOrder).Scopes(paginate(page, pageSize)).Find(&tasks)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  tasks,
		"total": total,
		"page":  page,
	})
}

// GetTask 获取指定任务
func GetTask(c *gin.Context) {
	id := c.Param("id")
	var task models.Task

	if err := models.DB.First(&task, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "任务未找到"})
		return
	}

	c.JSON(http.StatusOK, task)
}

// CreateTask 创建新任务
func CreateTask(c *gin.Context) {
	var taskRequest struct {
		Name        string             `json:"name"`
		Description string             `json:"description"`
		Alist       int                `json:"alist"`
		Concurrency int                `json:"concurrency"`
		From        string             `json:"from"`
		Dest        string             `json:"dest"`
		Mode        string             `json:"mode"`
		Spec        string             `json:"spec"`
		Opts        models.TaskOptions `json:"opts"`
		Command     string             `json:"command"`
		Schedule    string             `json:"schedule"`
		Enabled     bool               `json:"enabled"`
	}

	// 打印请求体以便调试
	body, _ := c.GetRawData()
	log.Printf("创建任务请求体: %s", string(body))

	// 重新设置请求体，因为 GetRawData 会消耗它
	c.Request.Body = io.NopCloser(bytes.NewBuffer(body))

	if err := c.ShouldBindJSON(&taskRequest); err != nil {
		log.Printf("绑定JSON失败: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 创建任务对象
	task := models.Task{
		Name:        taskRequest.Name,
		Description: taskRequest.Description,
		Alist:       taskRequest.Alist,
		Concurrency: taskRequest.Concurrency,
		From:        taskRequest.From,
		Dest:        taskRequest.Dest,
		Mode:        taskRequest.Mode,
		Spec:        taskRequest.Spec,
		Opts:        taskRequest.Opts,
		Command:     taskRequest.Command,
		Schedule:    taskRequest.Schedule,
		Enabled:     taskRequest.Enabled,
	}

	// 打印解析后的任务数据
	log.Printf("解析后的任务: %+v", task)

	// 如果没有设置默认值，设置默认值
	if task.Concurrency <= 0 {
		task.Concurrency = 1
	}

	// 确保 TaskOptions 有默认值
	if task.Opts.Deep <= 0 {
		task.Opts.Deep = 1
	}

	if task.Opts.Interval <= 0 {
		task.Opts.Interval = 1
	}

	// 设置状态为空闲
	task.Status = models.TaskStatusIdle

	result := models.DB.Create(&task)
	if result.Error != nil {
		log.Printf("创建任务失败: %v", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	log.Printf("任务创建成功，ID: %s", task.ID)
	c.JSON(http.StatusCreated, task)
}

// UpdateTask 更新任务
func UpdateTask(c *gin.Context) {
	id := c.Param("id")
	var existingTask models.Task

	// 检查任务是否存在
	if err := models.DB.First(&existingTask, "id = ?", id).Error; err != nil {
		log.Printf("更新任务失败，任务ID %s 未找到: %v", id, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "任务未找到"})
		return
	}

	// 打印请求体以便调试
	body, _ := c.GetRawData()
	log.Printf("更新任务请求体: %s", string(body))

	// 重新设置请求体，因为 GetRawData 会消耗它
	c.Request.Body = io.NopCloser(bytes.NewBuffer(body))

	// 创建一个新的任务对象来接收更新数据
	var updatedTask models.Task

	// 创建一个临时结构体来接收更新数据
	var taskRequest struct {
		Name        string             `json:"name"`
		Description string             `json:"description"`
		Alist       int                `json:"alist"`
		Concurrency int                `json:"concurrency"`
		From        string             `json:"from"`
		Dest        string             `json:"dest"`
		Mode        string             `json:"mode"`
		Spec        string             `json:"spec"`
		Opts        models.TaskOptions `json:"opts"`
		Command     string             `json:"command"`
		Schedule    string             `json:"schedule"`
		Enabled     bool               `json:"enabled"`
	}

	// 绑定更新数据
	if err := c.ShouldBindJSON(&taskRequest); err != nil {
		log.Printf("绑定更新数据失败: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 将临时结构体数据复制到更新任务对象
	updatedTask = models.Task{
		BaseModel:   existingTask.BaseModel,
		Name:        taskRequest.Name,
		Description: taskRequest.Description,
		Alist:       taskRequest.Alist,
		Concurrency: taskRequest.Concurrency,
		From:        taskRequest.From,
		Dest:        taskRequest.Dest,
		Mode:        taskRequest.Mode,
		Spec:        taskRequest.Spec,
		Opts:        taskRequest.Opts,
		Command:     taskRequest.Command,
		Schedule:    taskRequest.Schedule,
		Enabled:     taskRequest.Enabled,
		Status:      existingTask.Status,
		LastRun:     existingTask.LastRun,
		NextRun:     existingTask.NextRun,
	}

	// 确保 ID 正确
	updatedTask.ID = existingTask.ID

	// 确保必要的默认值
	if updatedTask.Concurrency <= 0 {
		updatedTask.Concurrency = 1
	}

	if updatedTask.Opts.Deep <= 0 {
		updatedTask.Opts.Deep = 1
	}

	if updatedTask.Opts.Interval <= 0 {
		updatedTask.Opts.Interval = 1
	}

	// 保存更新
	result := models.DB.Save(&updatedTask)
	if result.Error != nil {
		log.Printf("保存更新失败: %v", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	log.Printf("任务 %s 更新成功", id)
	c.JSON(http.StatusOK, updatedTask)
}

// DeleteTask 删除任务
func DeleteTask(c *gin.Context) {
	id := c.Param("id")

	// 删除任务
	result := models.DB.Delete(&models.Task{}, "id = ?", id)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "任务未找到"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "任务已删除"})
}

// RunTask 运行任务
func RunTask(c *gin.Context) {
	id := c.Param("id")
	var task models.Task

	// 检查任务是否存在
	if err := models.DB.First(&task, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "任务未找到"})
		return
	}

	// 获取任务执行器
	runner := taskrunner.GetTaskManager().GetRunner()

	// 创建上下文
	ctx := c.Request.Context()

	// 执行任务
	logID, err := runner.RunTask(ctx, &task)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "任务已开始执行",
		"task_id": task.ID,
		"log_id":  logID,
	})
}

// StopTask 停止正在运行的任务
func StopTask(c *gin.Context) {
	id := c.Param("id")

	// 获取任务执行器
	runner := taskrunner.GetTaskManager().GetRunner()

	// 停止任务
	err := runner.StopTask(id)
	if err != nil {
		log.Printf("停止任务 %s 失败: %v", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "任务已停止",
		"task_id": id,
	})
}

// GetTaskLogs 获取任务执行日志
func GetTaskLogs(c *gin.Context) {
	taskID := c.Param("id")

	var taskLogs []models.TaskLog
	result := models.DB.Where("task_id = ?", taskID).Order("start_time DESC").Find(&taskLogs)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, taskLogs)
}
