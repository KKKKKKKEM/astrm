package alist

import (
	"astrm/server"
	"astrm/service/alist"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
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

func listItem(c *gin.Context) {
	idxStr := c.Param("idx")
	// 从 url 参数中获取 path, page, pageSize, refresh
	root := c.Query("root")
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("pageSize", "0")
	refreshStr := c.DefaultQuery("refresh", "false")
	idx, _ := strconv.Atoi(idxStr)
	page, _ := strconv.Atoi(pageStr)
	pageSize, _ := strconv.Atoi(pageSizeStr)
	refresh, _ := strconv.ParseBool(refreshStr)

	alist := server.Cfg.Alist[idx]

	data, err := alist.List(c, root, page, pageSize, refresh)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "msg": err.Error(), "data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": data})
}
