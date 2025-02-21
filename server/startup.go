package server

import (
	"flag"
	"github.com/gin-gonic/gin"
	"github.com/robfig/cron/v3"
	"log"
	"strings"
)

var (
	DB         *Storage
	configPath = *flag.String("config", "conf/conf.yaml", "config file path")
	r          *gin.Engine
	VideoRegex = `(?i)^\.(mp4|avi|mkv|mov|webm|flv|wmv|3gp|mpeg|mpg)$`
)

func setupDB() (err error) {
	for i, a := range DB.Alist {
		a.Id = i
		a.Endpoint = strings.Trim(a.Endpoint, "\n")
		a.Endpoint = strings.Trim(a.Endpoint, "")
	}

	DB.Cron = cron.New(cron.WithSeconds())

	for _, j := range DB.Jobs {
		if err = DB.RegisterJob(j); err != nil {
			return
		}
	}
	return
}

func setupHttpServer() {
	r = gin.Default()
	// 配置 CORS 中间件（开发环境）
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})
}

func GetApp() *gin.Engine {
	return r
}

func Init() {
	var err error
	flag.Parse()
	DB = new(Storage)

	if err = DB.fromYaml(configPath); err != nil {
		log.Println("read config failure, err：" + err.Error())
	}

	if err = setupDB(); err != nil {
		panic("setup job failure, err：" + err.Error())
	}
	_, _ = DB.Cron.AddFunc("*/10 * * * * ?", func() {
		err := DB.store(configPath)
		if err != nil {
			log.Println("save config failure, err：" + err.Error())
		}
	})
	setupHttpServer()

}

func Run() {
	DB.Cron.Start()
	_ = r.Run(DB.Listen)
}
