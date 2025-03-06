package admin

import (
	"astrm/server"
	"astrm/web"
	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3"
	"io/fs"
	"net/http"
)

func admin(c *gin.Context) {
	entrance := c.Param("entrance")
	if entrance != server.Cfg.Entrance {
		c.Redirect(http.StatusFound, "/admin")
		return
	}

	if bytes, err := fs.ReadFile(web.Web, "admin.html"); err != nil {
		return
	} else {
		c.Data(http.StatusOK, "text/html; charset=utf-8", bytes)
	}
}

func enter(c *gin.Context) {
	if bytes, err := fs.ReadFile(web.Web, "403.html"); err != nil {
		return
	} else {
		c.Data(http.StatusForbidden, "text/html; charset=utf-8", bytes)
	}
}
func cfg(c *gin.Context) {
	entrance := c.Param("entrance")
	if entrance != server.Cfg.Entrance {
		c.Redirect(http.StatusFound, "/admin")
		return
	}
	bytes, _ := yaml.Marshal(server.Cfg)
	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=astrm.yaml")
	c.String(http.StatusOK, string(bytes))
}
