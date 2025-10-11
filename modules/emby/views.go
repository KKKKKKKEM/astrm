package emby

import (
	"astrm/server"
	"net/http"

	"github.com/gin-gonic/gin"
)

// 获取完整配置
func get(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"emby": server.Cfg.Emby,
	})
}

// 更新配置
func update(c *gin.Context) {
	var payload struct {
		Emby *server.Emby `json:"emby"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 更新 Emby 配置
	if payload.Emby != nil {
		server.Cfg.Emby = *payload.Emby
	}

	// 持久化到文件
	if err := server.Cfg.Store(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "success",
		"data": gin.H{
			"emby": server.Cfg.Emby,
		},
	})
}

