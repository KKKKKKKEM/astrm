package app

import (
	"astrm/backend/middlewares"
	"github.com/gin-gonic/gin"
)

var (
	engine       *gin.Engine
	_setupRoutes []SetupRoute
	_setupEngins []SetupEngine
)

func GetEngine() *gin.Engine {
	return engine
}

func SetEngin() *gin.Engine {
	engine = gin.Default()
	InitEngine(_setupRoutes, _setupEngins)
	return engine
}

func RefreshEngine(r *gin.Engine) {
	// 创建新的引擎实例
	*r = *SetEngin()
}

type SetupRoute func(router *gin.RouterGroup)
type SetupEngine func(r *gin.Engine)

func InitEngine(setupRoutes []SetupRoute, setupEngins []SetupEngine) *gin.Engine {
	if setupRoutes == nil && setupEngins == nil {
		return engine
	}

	_setupRoutes = setupRoutes
	_setupEngins = setupEngins
	// 添加中间件
	engine.Use(middlewares.CORSMiddleware())
	engine.Use(middlewares.LoggerMiddleware())
	engine.Use(middlewares.RouterMiddleware(engine))

	// 设置静态文件目录 - 用于提供前端文件
	engine.Static("/assets", "/Users/ws/Documents/code/astrm/frontend/dist/assets")
	engine.StaticFile("/", "/Users/ws/Documents/code/astrm/frontend/dist/index.html")

	// API路由
	api := engine.Group("/api")
	for _, setupRoute := range setupRoutes {
		setupRoute(api)
	}
	for _, setupEngin := range setupEngins {
		setupEngin(engine)
	}

	// 非API路由重定向到前端
	engine.NoRoute(func(c *gin.Context) {
		c.File("/Users/ws/Documents/code/astrm/frontend/dist/index.html")
	})

	return engine
}

func init() {
	engine = gin.Default()
}
