package admin

import (
	"astrm/server"
	"astrm/web"
	"io/fs"
	"net/http"
)

func Init() {
	r := server.GetApp()
	fsys, err := fs.Sub(web.Web, "static")
	if err != nil {
		panic(err)
	}
	r.StaticFS("/admin/static/", http.FS(fsys))
	r.GET("/admin/:entrance", admin)
	r.GET("/admin/:entrance/cfg", cfg)
	r.GET("/admin", enter)
}
