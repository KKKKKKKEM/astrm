package middlewares

import (
	"github.com/gin-gonic/gin"
)

// RouterMiddleware 将router实例注入到上下文中
func RouterMiddleware(router *gin.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("router", router)
		c.Next()
	}
}
