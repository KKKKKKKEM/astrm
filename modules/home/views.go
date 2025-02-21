package home

import (
	"github.com/gin-gonic/gin"
	"net/http"
)

func home(c *gin.Context) {
	c.HTML(http.StatusOK, "index.html", gin.H{})
}
