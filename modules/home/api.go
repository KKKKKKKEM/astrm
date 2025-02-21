package home

import "astrm/server"

func Init() {
	r := server.GetApp()
	r.LoadHTMLFiles("web/index.html")
	r.Static("/static", "web/static")
	r.GET("/", home)
}
