package handlers

import (
	"astrm/backend/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ListConfigs 获取所有配置
func ListConfigs(c *gin.Context) {
	var configs []models.Config

	// 过滤参数
	configType := c.DefaultQuery("type", "")
	search := c.DefaultQuery("search", "")

	// 分页参数
	page := c.DefaultQuery("page", "1")
	pageSize := c.DefaultQuery("pageSize", "10")

	// 排序参数
	sortBy := c.DefaultQuery("sortBy", "created_at")
	sortOrder := c.DefaultQuery("sortOrder", "desc")

	// 构建查询
	db := models.DB.Model(&models.Config{})

	// 应用过滤
	if configType != "" {
		db = db.Where("type = ?", configType)
	}

	if search != "" {
		search = "%" + search + "%"
		db = db.Where("name LIKE ? OR description LIKE ?", search, search)
	}

	// 计算总数
	var total int64
	db.Count(&total)

	// 排序和分页
	result := db.Order(sortBy + " " + sortOrder).Scopes(paginate(page, pageSize)).Find(&configs)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  configs,
		"total": total,
		"page":  page,
	})
}

// GetConfig 获取指定配置
func GetConfig(c *gin.Context) {
	id := c.Param("id")
	var config models.Config

	if err := models.DB.First(&config, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "配置未找到"})
		return
	}

	c.JSON(http.StatusOK, config)
}

// CreateConfig 创建新配置
func CreateConfig(c *gin.Context) {
	var config models.Config

	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 检查名称是否已存在
	var count int64
	models.DB.Model(&models.Config{}).Where("name = ?", config.Name).Count(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "配置名称已存在"})
		return
	}

	result := models.DB.Create(&config)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusCreated, config)
}

// UpdateConfig 更新配置
func UpdateConfig(c *gin.Context) {
	id := c.Param("id")
	var config models.Config

	// 检查配置是否存在
	if err := models.DB.First(&config, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "配置未找到"})
		return
	}

	// 保存旧名称用于检查
	oldName := config.Name

	// 绑定更新数据
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 如果名称已更改，检查是否与现有名称冲突
	if oldName != config.Name {
		var count int64
		models.DB.Model(&models.Config{}).Where("name = ? AND id != ?", config.Name, id).Count(&count)
		if count > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "配置名称已存在"})
			return
		}
	}

	// 保存更新
	result := models.DB.Save(&config)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, config)
}

// DeleteConfig 删除配置
func DeleteConfig(c *gin.Context) {
	id := c.Param("id")

	// 删除配置
	result := models.DB.Delete(&models.Config{}, "id = ?", id)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "配置未找到"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "配置已删除"})
}

// GetConfigSchema 获取配置架构
func GetConfigSchema(c *gin.Context) {
	// 返回可用的配置字段类型和配置类型
	c.JSON(http.StatusOK, gin.H{
		"fieldTypes": []string{
			string(models.FieldTypeText),
			string(models.FieldTypeNumber),
			string(models.FieldTypeSelect),
			string(models.FieldTypeTextarea),
			string(models.FieldTypeSwitch),
			string(models.FieldTypeDate),
		},
		"configTypes": []string{
			string(models.ConfigTypeSystem),
			string(models.ConfigTypeUser),
			string(models.ConfigTypeService),
		},
	})
}
