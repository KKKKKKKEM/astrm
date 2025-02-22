package alist

import (
	"astrm/server"
	"astrm/service/alist"
	"github.com/gin-gonic/gin"
	"net/http"
	"strings"
)

func list(c *gin.Context) {
	c.JSON(http.StatusOK, server.Cfg.Alist)
}

func create(c *gin.Context) {
	var item alist.Server
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item.Endpoint = strings.TrimSpace(item.Endpoint)
	server.Cfg.Alist = append(server.Cfg.Alist, &item)
	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": item})
}

func modify(c *gin.Context) {
	alistName := c.Param("name")

	for _, a := range server.Cfg.Alist {
		if a.Name == alistName {
			if err := c.ShouldBindJSON(&a); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			a.Endpoint = strings.TrimSpace(a.Endpoint)
			c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": a})
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"code": -1, "msg": "alist not found"})

}
func del(c *gin.Context) {
	alistName := c.Param("name")

	for i, a := range server.Cfg.Alist {
		if a.Name == alistName {
			// 删除
			server.Cfg.Alist = append(server.Cfg.Alist[:i], server.Cfg.Alist[i+1:]...)
			c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": a})
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"code": -1, "msg": "alist not found"})

}
