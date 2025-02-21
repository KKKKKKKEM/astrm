package alist

import (
	"astrm/libs/alist"
	"astrm/server"
	"github.com/gin-gonic/gin"
	"net/http"
	"strings"
)

func list(c *gin.Context) {
	c.JSON(http.StatusOK, server.DB.Alist)
}

func create(c *gin.Context) {
	var item alist.Server
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item.Endpoint = strings.Trim(item.Endpoint, "")
	item.Endpoint = strings.Trim(item.Endpoint, "\n")
	server.DB.Alist = append(server.DB.Alist, &item)
	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": item})
}

func modify(c *gin.Context) {
	alistName := c.Param("name")

	for _, a := range server.DB.Alist {
		if a.Name == alistName {
			if err := c.ShouldBindJSON(&a); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			a.Endpoint = strings.Trim(a.Endpoint, "")
			a.Endpoint = strings.Trim(a.Endpoint, "\n")
			c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": a})
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"code": -1, "msg": "alist not found"})

}
func del(c *gin.Context) {
	alistName := c.Param("name")

	for i, a := range server.DB.Alist {
		if a.Name == alistName {
			// 删除
			server.DB.Alist = append(server.DB.Alist[:i], server.DB.Alist[i+1:]...)
			c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": a})
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"code": -1, "msg": "alist not found"})

}
