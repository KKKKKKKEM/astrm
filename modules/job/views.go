package job

import (
	"astrm/server"
	"astrm/service/job"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func list(c *gin.Context) {
	c.JSON(http.StatusOK, server.Cfg.Jobs)
}

func create(c *gin.Context) {
	var item = job.Job{Id: uuid.NewString()}
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := server.Cfg.RegisterJob(&item)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "-1", "msg": err.Error()})
	} else {
		c.JSON(http.StatusCreated, gin.H{"code": 0, "msg": "success", "data": item})
	}
}
func del(c *gin.Context) {
	jobId := c.Param("id")
	if idx, thisJob := server.Cfg.FindJob(&job.Job{Id: jobId}); idx != -1 {
		err := server.Cfg.UnRegisterJob(thisJob)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"code": -1, "msg": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": thisJob})
		return
	}

	c.JSON(http.StatusNotFound, gin.H{"code": -1, "msg": "Job not found"})
}

func get(c *gin.Context) {
	jobId := c.Param("id")
	if idx, thisJob := server.Cfg.FindJob(&job.Job{Id: jobId}); idx != -1 {
		c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": thisJob})
		return
	}

	c.JSON(http.StatusNotFound, gin.H{"code": -1, "msg": "Job not found"})
}

func run(c *gin.Context) {
	jobId := c.Param("id")

	if idx, thisJob := server.Cfg.FindJob(&job.Job{Id: jobId}); idx != -1 {
		go thisJob.Run()
		c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": thisJob})
		return
	}
	c.JSON(http.StatusNotFound, gin.H{"code": -1, "msg": "Job not found"})

}

func modify(c *gin.Context) {

	jobId := c.Param("id")
	idx, thisJob := server.Cfg.FindJob(&job.Job{Id: jobId})
	if idx != -1 {
		rawSpec := thisJob.Spec
		if err := c.ShouldBindJSON(&thisJob); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		// 变化了要重新注册 job
		if thisJob.Spec != rawSpec {
			if err := server.Cfg.UnRegisterJob(thisJob); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			server.Cfg.Jobs = append(server.Cfg.Jobs, thisJob)
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": thisJob})

	} else {
		c.JSON(http.StatusNotFound, gin.H{"code": -1, "msg": "Job not found"})

	}

}
