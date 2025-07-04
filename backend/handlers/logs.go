package handlers

import (
	"astrm/backend/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ListLogs 获取所有日志
func ListLogs(c *gin.Context) {
	var logs []models.Log

	// 过滤参数
	level := c.DefaultQuery("level", "")
	source := c.DefaultQuery("source", "")
	search := c.DefaultQuery("search", "")

	// 分页参数
	page := c.DefaultQuery("page", "1")
	pageSize := c.DefaultQuery("pageSize", "10")

	// 排序参数
	sortBy := c.DefaultQuery("sortBy", "created_at")
	sortOrder := c.DefaultQuery("sortOrder", "desc")

	// 构建查询
	db := models.DB.Model(&models.Log{})

	// 应用过滤
	if level != "" {
		db = db.Where("level = ?", level)
	}

	if source != "" {
		db = db.Where("source = ?", source)
	}

	if search != "" {
		search = "%" + search + "%"
		db = db.Where("message LIKE ? OR details LIKE ?", search, search)
	}

	// 计算总数
	var total int64
	db.Count(&total)

	// 排序和分页
	result := db.Order(sortBy + " " + sortOrder).Scopes(paginate(page, pageSize)).Find(&logs)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  logs,
		"total": total,
		"page":  page,
	})
}

// GetLog 获取指定日志
func GetLog(c *gin.Context) {
	id := c.Param("id")
	var log models.Log

	if err := models.DB.First(&log, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "日志未找到"})
		return
	}

	c.JSON(http.StatusOK, log)
}

// DeleteLog 删除日志
func DeleteLog(c *gin.Context) {
	id := c.Param("id")

	// 删除日志
	result := models.DB.Delete(&models.Log{}, "id = ?", id)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "日志未找到"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "日志已删除"})
}

// ClearLogs 清空日志
func ClearLogs(c *gin.Context) {
	// 过滤参数
	level := c.DefaultQuery("level", "")
	source := c.DefaultQuery("source", "")

	// 构建查询
	db := models.DB.Model(&models.Log{})

	// 应用过滤
	if level != "" {
		db = db.Where("level = ?", level)
	}

	if source != "" {
		db = db.Where("source = ?", source)
	}

	// 执行删除
	result := db.Delete(&models.Log{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "日志已清空",
		"deletedRows": result.RowsAffected,
	})
}
