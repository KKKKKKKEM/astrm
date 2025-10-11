package logs

import (
	"astrm/server"
	"bufio"
	"io"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// tailLogs 实现类似 tail -f 的功能
func tailLogs(c *gin.Context) {
	// 获取日志文件路径
	logPath := server.Cfg.Log.Path
	if logPath == "" {
		c.JSON(http.StatusOK, gin.H{
			"code": 1,
			"msg":  "日志文件未配置",
		})
		return
	}

	// 获取参数
	linesStr := c.DefaultQuery("lines", "100")  // 默认读取最后 100 行
	follow := c.DefaultQuery("follow", "false") // 是否实时跟踪

	lines, err := strconv.Atoi(linesStr)
	if err != nil || lines < 1 {
		lines = 100
	}
	if lines > 1000 {
		lines = 1000 // 最多 1000 行
	}

	// 如果是实时跟踪模式，使用 SSE (Server-Sent Events)
	if follow == "true" {
		streamLogs(c, logPath, lines)
		return
	}

	// 否则返回最后 N 行
	lastLines, err := readLastLines(logPath, lines)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"code": 1,
			"msg":  "读取日志失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "success",
		"data": lastLines,
	})
}

// readLastLines 读取文件的最后 N 行
func readLastLines(filePath string, n int) ([]string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	// 获取文件大小
	stat, err := file.Stat()
	if err != nil {
		return nil, err
	}

	fileSize := stat.Size()
	if fileSize == 0 {
		return []string{}, nil
	}

	// 简单实现：读取整个文件并分割行
	// 对于大文件，这不是最优的，但对于日志文件来说通常可以接受
	content := make([]byte, fileSize)
	_, err = file.ReadAt(content, 0)
	if err != nil && err != io.EOF {
		return nil, err
	}

	// 分割行
	lines := []string{}
	start := 0
	for i := 0; i < len(content); i++ {
		if content[i] == '\n' {
			line := string(content[start:i])
			// 移除 \r (Windows 换行符)
			if len(line) > 0 && line[len(line)-1] == '\r' {
				line = line[:len(line)-1]
			}
			if line != "" {
				lines = append(lines, line)
			}
			start = i + 1
		}
	}

	// 处理最后一行（如果没有换行符结尾）
	if start < len(content) {
		line := string(content[start:])
		if len(line) > 0 && line[len(line)-1] == '\r' {
			line = line[:len(line)-1]
		}
		if line != "" {
			lines = append(lines, line)
		}
	}

	// 返回最后 N 行
	if len(lines) > n {
		return lines[len(lines)-n:], nil
	}

	return lines, nil
}

// streamLogs 使用 SSE 实时推送日志
func streamLogs(c *gin.Context, logPath string, initialLines int) {
	// 设置 SSE 响应头
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	// 先发送最后 N 行
	lastLines, err := readLastLines(logPath, initialLines)
	if err != nil {
		logrus.Errorf("读取日志失败: %v", err)
		return
	}

	// 发送初始日志
	// logrus.Infof("准备发送 %d 行初始日志", len(lastLines))
	for _, line := range lastLines {
		c.SSEvent("message", line)
		c.Writer.Flush()
		// if i < 3 {
		// 	logrus.Infof("发送日志 %d: %s", i, line)
		// }
	}
	// logrus.Info("初始日志发送完成")

	// 打开文件准备跟踪
	file, err := os.Open(logPath)
	if err != nil {
		logrus.Errorf("打开日志文件失败: %v", err)
		return
	}
	defer file.Close()

	// 移动到文件末尾
	_, err = file.Seek(0, io.SeekEnd)
	if err != nil {
		logrus.Errorf("移动到文件末尾失败: %v", err)
		return
	}

	// 创建 reader
	reader := bufio.NewReader(file)

	// 创建 ticker 用于定期检查新内容
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	// 监听客户端断开
	clientGone := c.Request.Context().Done()

	for {
		select {
		case <-clientGone:
			// 客户端断开连接
			return

		case <-ticker.C:
			// 读取新行
			for {
				line, err := reader.ReadString('\n')
				if err != nil {
					if err == io.EOF {
						// 没有更多数据，继续等待
						break
					}
					// 其他错误
					logrus.Errorf("读取日志失败: %v", err)
					return
				}

				// 发送新行
				if line != "" {
					c.SSEvent("message", line[:len(line)-1]) // 去掉换行符
					c.Writer.Flush()
				}
			}
		}
	}
}
