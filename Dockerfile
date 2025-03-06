# 使用官方golang镜像作为构建环境
FROM golang:1.23 AS builder

ENV GO111MODULE=on \
    GOPROXY=https://goproxy.io,direct \
    CGO_ENABLED=0


# 设置工作目录
WORKDIR /app

# 复制go.mod和go.sum文件（如果有）
COPY go.mod go.sum ./

# 下载依赖
RUN go mod download

# 复制整个项目
COPY . .

# 构建应用程序
RUN CGO_ENABLED=0 GOOS=linux go build -o astrm .

# 使用最小的镜像作为运行时环境
FROM alpine:latest

# 从构建阶段复制二进制文件
COPY --from=builder /app/astrm .
RUN chmod +x ./astrm

# 暴露应用运行所需的端口（如果有的话）
EXPOSE 8080
COPY conf /conf
# 运行可执行文件
CMD ["./astrm"]