package handlers

import (
	"github.com/gin-gonic/gin"
)

func RegisterTasksRoutes(router *gin.RouterGroup) {
	tasks := router.Group("/tasks")
	tasks.GET("/", ListTasks)
	tasks.GET("/:id", GetTask)
	tasks.POST("/", CreateTask)
	tasks.PUT("/:id", UpdateTask)
	tasks.DELETE("/:id", DeleteTask)
	tasks.POST("/:id/run", RunTask)
	tasks.POST("/:id/stop", StopTask)
	tasks.GET("/:id/logs", GetTaskLogs)
}

func RegisterConfigsRoutes(router *gin.RouterGroup) {
	configs := router.Group("/configs")
	configs.GET("/", ListConfigs)
	configs.GET("/:id", GetConfig)
	configs.POST("/", CreateConfig)
	configs.PUT("/:id", UpdateConfig)
	configs.DELETE("/:id", DeleteConfig)
	configs.GET("/schema", GetConfigSchema)
}

func RegisterLogsRoutes(router *gin.RouterGroup) {
	logs := router.Group("/logs")
	logs.GET("/", ListLogs)
	logs.GET("/:id", GetLog)
	logs.DELETE("/:id", DeleteLog)
	logs.DELETE("/", ClearLogs)
}
func RegisterProxiesRoutes(router *gin.RouterGroup) {
	proxies := router.Group("/proxies")
	proxies.GET("/", ListProxies)
	proxies.GET("/:id", GetProxy)
	proxies.POST("/", CreateProxy)
	proxies.PUT("/:id", UpdateProxy)
	proxies.DELETE("/:id", DeleteProxy)
	proxies.POST("/refresh", RefreshAllProxies)
	proxies.POST("/batch-delete", DeleteBatchProxies)
	proxies.GET("/plugins/available", GetAvailablePlugins)
}
