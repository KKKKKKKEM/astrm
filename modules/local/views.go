package local

import (
	"net/http"
	"os"
	"path/filepath"
	"sort"

	"github.com/gin-gonic/gin"
)

type DirItem struct {
	Name  string `json:"name"`
	IsDir bool   `json:"is_dir"`
}

func listDir(c *gin.Context) {
	// Get path from query parameter
	path := c.DefaultQuery("path", "/")

	// Clean the path
	path = filepath.Clean(path)

	// Read directory
	entries, err := os.ReadDir(path)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"code": 1, "msg": err.Error(), "data": nil})
		return
	}

	// Convert to response format
	var items []DirItem
	for _, entry := range entries {
		// Skip hidden files
		if entry.Name()[0] == '.' {
			continue
		}

		// Only include directories
		if entry.IsDir() {
			fullPath := filepath.Join(path, entry.Name())
			items = append(items, DirItem{
				Name:  fullPath,
				IsDir: true,
			})
		}
	}

	// Sort by name
	sort.Slice(items, func(i, j int) bool {
		return items[i].Name < items[j].Name
	})

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "success", "data": items})
}

