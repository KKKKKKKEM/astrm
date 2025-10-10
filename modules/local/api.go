package local

import (
	"astrm/server"
)

func Init() {
	r := server.GetApp()
	api := r.Group("/api/local")
	{
		api.GET("/list-dir", listDir)
	}
}

