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
		api.DELETE("/:id", del)
		api.GET("/:id", get)
		api.GET("/:id/list-item", listItem)
		api.POST("/:id", run)
		api.PATCH("/:id", modify)
	}
}
