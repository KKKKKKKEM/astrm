package job

import (
	"astrm/server"
)

func Init() {
	r := server.GetApp()
	api := r.Group("/api/job")
	{
		api.GET("", list)
		api.POST("", create)
		api.DELETE("/:id", delete)
		api.GET("/:id", get)
		api.POST("/:id", run)
		api.PATCH("/:id", modify)
	}
}
