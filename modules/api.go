package modules

import (
	"astrm/modules/admin"
	"astrm/modules/alist"
	"astrm/modules/emby"
	"astrm/modules/job"
	"astrm/modules/local"
	"astrm/modules/logs"
	"astrm/modules/proxy"
)

func Init() {
	admin.Init()
	alist.Init()
	job.Init()
	emby.Init()
	local.Init()
	logs.Init()
	proxy.Init()
}
