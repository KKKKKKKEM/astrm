package middleware

import (
	"github.com/gin-gonic/gin"
)

// 设置Referer策略
func SetRefererPolicy(value string) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.Header("Referrer-Policy", value)
	}
}
