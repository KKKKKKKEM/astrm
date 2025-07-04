package main

import (
	"astrm/backend/config"
	"astrm/backend/handlers"
	"astrm/backend/middlewares"
	"astrm/backend/models"
	"astrm/backend/routes"
	"astrm/backend/services/taskrunner"
	"github.com/gin-gonic/gin"
	"log"
	"net/http"
)

func main() {
	// 初始化配置
	appConfig, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	// 初始化数据库
	if err := models.InitDB(); err != nil {
		log.Fatalf("初始化数据库失败: %v", err)
	}

	// 初始化任务管理器
	taskrunner.GetTaskManager()
	log.Println("任务管理系统初始化完成")

	// 可以在这里注册自定义任务执行器
	// 例如: taskManager.RegisterExecutor("custom", func() taskrunner.TaskExecutor { return &CustomExecutor{} })

	// 创建Gin实例
	r := gin.Default()

	// 添加中间件
	r.Use(middlewares.CORSMiddleware())
	r.Use(middlewares.LoggerMiddleware())
	r.Use(middlewares.RouterMiddleware(r))

	// 设置静态文件目录 - 用于提供前端文件
	r.Static("/assets", "../frontend/dist/assets")
	r.StaticFile("/", "../frontend/dist/index.html")

	// API路由
	api := r.Group("/api")
	routes.InitRoutes(api)

	// 反向代理路由 - 动态生成基于配置
	handlers.SetupProxyRoutes(r)

	// 非API路由重定向到前端
	r.NoRoute(func(c *gin.Context) {
		c.File("../frontend/dist/index.html")
	})

	// 启动服务器
	serverAddr := appConfig.Server.Host + ":" + appConfig.Server.Port
	log.Printf("服务器启动于 %s", serverAddr)
	if err := http.ListenAndServe(serverAddr, r); err != nil {
		log.Fatalf("启动服务器失败: %v", err)
	}
}
