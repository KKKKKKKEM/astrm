package routes

import (
	"astrm/backend/handlers"
	"github.com/gin-gonic/gin"
)

func RegisterTasksRoutes(router *gin.RouterGroup) {
	tasks := router.Group("/tasks")
	tasks.GET("/", handlers.ListTasks)
	tasks.GET("/:id", handlers.GetTask)
	tasks.POST("/", handlers.CreateTask)
	tasks.PUT("/:id", handlers.UpdateTask)
	tasks.DELETE("/:id", handlers.DeleteTask)
	tasks.POST("/:id/run", handlers.RunTask)
	tasks.POST("/:id/stop", handlers.StopTask)
	tasks.GET("/:id/logs", handlers.GetTaskLogs)
}

func RegisterConfigsRoutes(router *gin.RouterGroup) {
	configs := router.Group("/configs")
	configs.GET("/", handlers.ListConfigs)
	configs.GET("/:id", handlers.GetConfig)
	configs.POST("/", handlers.CreateConfig)
	configs.PUT("/:id", handlers.UpdateConfig)
	configs.DELETE("/:id", handlers.DeleteConfig)
	configs.GET("/schema", handlers.GetConfigSchema)
}

func RegisterLogsRoutes(router *gin.RouterGroup) {
	logs := router.Group("/logs")
	logs.GET("/", handlers.ListLogs)
	logs.GET("/:id", handlers.GetLog)
	logs.DELETE("/:id", handlers.DeleteLog)
	logs.DELETE("/", handlers.ClearLogs)
}
func RegisterProxiesRoutes(router *gin.RouterGroup) {
	proxies := router.Group("/proxies")
	proxies.GET("/", handlers.ListProxies)
	proxies.GET("/:id", handlers.GetProxy)
	proxies.POST("/", handlers.CreateProxy)
	proxies.PUT("/:id", handlers.UpdateProxy)
	proxies.DELETE("/:id", handlers.DeleteProxy)
	proxies.POST("/refresh", handlers.RefreshAllProxies)
	proxies.POST("/batch-delete", handlers.DeleteBatchProxies)
}

func InitRoutes(router *gin.RouterGroup) {
	RegisterTasksRoutes(router)
	RegisterConfigsRoutes(router)
	RegisterLogsRoutes(router)
	RegisterProxiesRoutes(router)

}
