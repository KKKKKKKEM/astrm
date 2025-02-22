package admin

import (
	"astrm/server"
	"github.com/gin-gonic/gin"
	"net/http"
)

func admin(c *gin.Context) {
	entrance := c.Param("entrance")
	if entrance != server.Cfg.Entrance {
		c.Redirect(http.StatusFound, "/admin")
		return
	}
	c.HTML(http.StatusOK, "admin.html", gin.H{})
}

func enter(c *gin.Context) {
	c.HTML(http.StatusForbidden, "403.html", gin.H{})
}
