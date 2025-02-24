package admin

import "astrm/server"

func Init() {
	r := server.GetApp()
	r.LoadHTMLFiles("web/admin.html", "web/403.html")
	r.Static("/admin/static", "web/static")
	r.GET("/admin/:entrance", admin)
	r.GET("/admin/:entrance/cfg", cfg)
	r.GET("/admin", enter)
}
