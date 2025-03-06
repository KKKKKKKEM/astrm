package server

import (
	"astrm/middleware"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/natefinch/lumberjack"
	"github.com/robfig/cron/v3"
	"github.com/sirupsen/logrus"
	"io"
	"log"
	"net"
	"os"
	"strings"
)

var (
	Cfg        *Storage
	r          *gin.Engine
	VideoRegex = `(?i)^\.(mp4|avi|mkv|mov|webm|flv|wmv|3gp|mpeg|mpg|ts|rmvb)$`
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
func printAccessibleURLs(addr string) {
	// 解析监听地址
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		fmt.Printf("Invalid address: %v\n", err)
		return
	}

	// 如果 host 为空，则默认为 0.0.0.0（监听所有网络接口）
	if host == "" {
		host = "0.0.0.0"
	}

	// 获取所有网络接口及其 IP 地址
	interfaces, err := net.Interfaces()
	if err != nil {
		fmt.Printf("Failed to get network interfaces: %v\n", err)
		return
	}

	// 收集所有可用的访问地址
	var urls []string
	for _, iface := range interfaces {
		// 跳过无效或未启用的网络接口
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}

		// 获取网络接口的地址
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			default:
				continue
			}

			// 过滤无效或非 IPv4 地址
			if ip == nil || ip.IsLoopback() || ip.To4() == nil {
				continue
			}

			// 构造访问 URL
			url := fmt.Sprintf("http://%s:%s", ip.String(), port)
			urls = append(urls, url)
		}
	}

	// 添加 localhost 和回环地址
	if host == "0.0.0.0" || host == "127.0.0.1" {
		urls = append(urls, fmt.Sprintf("http://localhost:%s", port))
		urls = append(urls, fmt.Sprintf("http://127.0.0.1:%s", port))
	}

	// 打印所有可访问的 URL
	fmt.Println("Server is accessible at the following URLs:")
	for _, url := range urls {
		fmt.Println("- " + url)
	}
}
func printLOGO() {
	fmt.Print(
		`
 █████╗ ███████╗████████╗██████╗ ███╗   ███╗
██╔══██╗██╔════╝╚══██╔══╝██╔══██╗████╗ ████║
███████║███████╗   ██║   ██████╔╝██╔████╔██║
██╔══██║╚════██║   ██║   ██╔══██╗██║╚██╔╝██║
██║  ██║███████║   ██║   ██║  ██║██║ ╚═╝ ██║
╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝     ╚═╝
                                            
`)
}
func Run() {
	Cfg.Cron.Start()
	printLOGO()
	printAccessibleURLs(Cfg.Listen)
	_ = r.Run(Cfg.Listen)

}
