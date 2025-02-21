package modules

import (
	"astrm/modules/alist"
	"astrm/modules/home"
	"astrm/modules/job"
)

func Init() {
	home.Init()
	alist.Init()
	job.Init()
}
