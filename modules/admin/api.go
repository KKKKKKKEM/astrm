package admin

import (
	"astrm/server"
	"astrm/web"
	"net/http"
)

func Init() {
	r := server.GetApp()
	r.StaticFS("/admin/static", http.FS(web.StaticFiles))
	r.GET("/admin/:entrance", admin)
	r.GET("/admin/:entrance/cfg", cfg)
	r.GET("/admin", enter)
}
