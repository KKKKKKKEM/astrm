package main

import (
	"astrm/backend/app"
	"astrm/backend/app/taskrunner"
	"astrm/backend/config"
	"astrm/backend/handlers"
	"astrm/backend/models"
	"astrm/backend/services/handler"
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
	// 例如: taskManager.RegisterHandler("custom", func() taskrunner.TaskExecutor { return &CustomExecutor{} })

	// 创建Gin实例
	r := app.InitEngine(
		[]app.SetupRoute{
			handlers.RegisterTasksRoutes,
			handlers.RegisterConfigsRoutes,
			handlers.RegisterLogsRoutes,
			handlers.RegisterProxiesRoutes,
		},
		[]app.SetupEngine{
			// 反向代理路由 - 动态生成基于配置
			handlers.SetupProxyRoutes,
		},
	)

	runner := taskrunner.GetTaskManager().GetRunner()
	runner.RegisterHandler("alist", handler.NewAlistHandler())

	// 启动服务器
	serverAddr := appConfig.Server.Host + ":" + appConfig.Server.Port
	log.Printf("服务器启动于 %s", serverAddr)
	if err := http.ListenAndServe(serverAddr, r); err != nil {
		log.Fatalf("启动服务器失败: %v", err)
	}
}
