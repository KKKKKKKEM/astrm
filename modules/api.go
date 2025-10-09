package modules

import (
	"astrm/modules/admin"
	"astrm/modules/alist"
	"astrm/modules/config"
	"astrm/modules/job"
	"astrm/modules/proxy"
)

func Init() {
	admin.Init()
	alist.Init()
	job.Init()
	config.Init()
	proxy.Init()
}
