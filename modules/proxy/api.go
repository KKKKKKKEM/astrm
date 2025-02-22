package proxy

import (
	"astrm/server"
)

func Init() {
	r := server.GetApp()
	r.NoRoute(proxy)
}
