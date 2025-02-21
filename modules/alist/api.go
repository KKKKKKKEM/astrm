package alist

import (
	"astrm/server"
)

func Init() {
	r := server.GetApp()
	api := r.Group("/api/alist")
	{
		api.GET("", list)
		api.POST("", create)
		api.POST("/:name", modify)
		api.DELETE("/:name", delete)
	}
}
