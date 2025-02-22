package proxy

import (
	"astrm/server"
)

var handler *EmbyServerHandler

func Init() {
	r := server.GetApp()
	handler = NewHandler()

	r.NoRoute(proxy)
}
