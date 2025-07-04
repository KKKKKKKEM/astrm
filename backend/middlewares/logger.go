package middlewares

import (
	"astrm/backend/models"
	"time"

	"github.com/gin-gonic/gin"
)

// LoggerMiddleware 记录HTTP请求日志的中间件
func LoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 开始时间
		startTime := time.Now()

		// 处理请求
		c.Next()

		// 结束时间
		endTime := time.Now()

		// 执行时间
		latency := endTime.Sub(startTime)

		// 请求方法和路径
		method := c.Request.Method
		path := c.Request.URL.Path

		// 状态码
		statusCode := c.Writer.Status()

		// 客户端IP
		clientIP := c.ClientIP()

		// 构建日志消息
		message := path
		details := method + " " + path + " " + c.Request.Proto +
			"\nStatus: " + string(rune(statusCode)) +
			"\nLatency: " + latency.String() +
			"\nIP: " + clientIP

		// 确定日志级别
		var level models.LogLevel
		if statusCode >= 500 {
			level = models.LogLevelError
		} else if statusCode >= 400 {
			level = models.LogLevelWarning
		} else {
			level = models.LogLevelInfo
		}

		// 记录到数据库
		log := models.Log{
			Source:  "http",
			Level:   level,
			Message: message,
			Details: details,
		}

		models.DB.Create(&log)
	}
}
