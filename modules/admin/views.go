package admin

import (
	"astrm/server"
	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3"
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
func cfg(c *gin.Context) {
	bytes, _ := yaml.Marshal(server.Cfg)
	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=astrm.yaml")
	c.String(http.StatusOK, string(bytes))
}
