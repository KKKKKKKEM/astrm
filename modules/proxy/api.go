package proxy

import (
	"astrm/server"
)

var embyHandler *EmbyServerHandler

func Init() {
	r := server.GetApp()
	embyHandler = NewEmbyHandler()

	r.NoRoute(proxy)
}
