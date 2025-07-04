package handlers

import (
	"fmt"
	"strconv"
	"strings"

	"gorm.io/gorm"
)

// paginate 返回分页函数
func paginate(page, pageSize string) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		pageInt, _ := strconv.Atoi(page)
		if pageInt <= 0 {
			pageInt = 1
		}

		pageSizeInt, _ := strconv.Atoi(pageSize)
		switch {
		case pageSizeInt > 100:
			pageSizeInt = 100
		case pageSizeInt <= 0:
			pageSizeInt = 10
		}

		offset := (pageInt - 1) * pageSizeInt
		return db.Offset(offset).Limit(pageSizeInt)
	}
}

// validatePattern 校验搜索模式，防止SQL注入
func validatePattern(pattern string) (string, error) {
	// 禁止SQL注入的简单检查
	for _, char := range []string{";", "--", "/*", "*/", "UNION", "DROP", "DELETE", "INSERT"} {
		if contains(pattern, char) {
			return "", fmt.Errorf("模式包含无效字符: %s", char)
		}
	}

	return pattern, nil
}

// contains 检查字符串是否包含子串（不区分大小写）
func contains(s, substr string) bool {
	s, substr = strings.ToLower(s), strings.ToLower(substr)
	return strings.Contains(s, substr)
}
