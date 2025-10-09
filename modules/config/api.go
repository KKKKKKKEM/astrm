package config

import (
	"astrm/server"
)

func Init() {
	r := server.GetApp()
	api := r.Group("/api/emby")
	{
		api.GET("", get)
		api.PATCH("", update)
	}
}
