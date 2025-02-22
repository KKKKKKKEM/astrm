package server

import (
	"astrm/middleware"
	"github.com/gin-gonic/gin"
	"github.com/natefinch/lumberjack"
	"github.com/robfig/cron/v3"
	"github.com/sirupsen/logrus"
	"io"
	"log"
	"os"
	"strings"
)

var (
	Cfg        *Storage
	r          *gin.Engine
	VideoRegex = `(?i)^\.(mp4|avi|mkv|mov|webm|flv|wmv|3gp|mpeg|mpg)$`
)

func setupCfg() (err error) {
	for i, a := range Cfg.Alist {
		a.Id = i
		a.Endpoint = strings.TrimSpace(a.Endpoint)
	}

	Cfg.Cron = cron.New(cron.WithSeconds())

	for _, j := range Cfg.Jobs {
		if err = Cfg.RegisterJob(j); err != nil {
			return
		}
	}
	return
}

func setupHttpServer() {
	r = gin.New()
	gin.SetMode(gin.ReleaseMode)
	//配置 CORS 中间件（开发环境）
	r.Use(middleware.SetRefererPolicy("same-origin"))
	r.Use(middleware.QueryCaseInsensitive())
	r.Use(middleware.SetCors())
}

func setupLog() {
	logrus.SetOutput(os.Stdout)
	logrus.SetFormatter(&logrus.JSONFormatter{})
	if Cfg.Debug {
		logrus.SetLevel(logrus.DebugLevel)
	} else {
		logrus.SetLevel(logrus.Level(Cfg.Log.Level))
		gin.SetMode(gin.ReleaseMode)
	}
	if Cfg.Log.Path != "" {
		logfile := &lumberjack.Logger{
			Filename:   Cfg.Log.Path, // 日志文件路径
			MaxSize:    5,            // megabytes
			MaxBackups: 3,            // 最多保留的旧文件数量
			MaxAge:     28,           // days
			Compress:   true,         // 是否启用压缩
		}
		// 使用MultiWriter可以同时向多个目标输出日志
		logrus.SetOutput(io.MultiWriter(logfile, os.Stdout))
	}

}
func GetApp() *gin.Engine {
	return r
}

func Init(configPath string) {
	var err error
	Cfg = new(Storage)

	if err = Cfg.fromYaml(configPath); err != nil {
		log.Println("read config failure, err：" + err.Error())
	}

	setupLog()

	if err = setupCfg(); err != nil {
		panic("setup job failure, err：" + err.Error())
	}
	if Cfg.Persistence != "" {
		_, err = Cfg.Cron.AddFunc(Cfg.Persistence, func() {
			err := Cfg.store(configPath)
			if err != nil {
				logrus.Errorln("save config failure, err：" + err.Error())
			}
		})
		if err != nil {
			logrus.Errorln("add persistence job failure, err：" + err.Error())
		}
	}

	setupHttpServer()

}

func Run() {
	Cfg.Cron.Start()
	logrus.Infof("listen: %s", Cfg.Listen)
	_ = r.Run(Cfg.Listen)

}
