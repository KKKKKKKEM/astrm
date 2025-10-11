package logs

import (
	"astrm/server"
)

func Init() {
	r := server.GetApp()
	api := r.Group("/api/logs")
	{
		api.GET("/tail", tailLogs)
	}
}

