# Astrm 系统管理平台

Astrm 是一个功能丰富的系统管理平台，提供反向代理、任务管理、配置管理和日志管理等功能。

## 功能特点

- **反向代理服务**: 配置路径映射到目标地址，支持路径前缀剥离
- **任务管理服务**: 创建、运行、监控和管理系统任务，查看执行日志
- **配置管理服务**: 管理系统配置，支持多种字段类型和自定义配置
- **日志管理服务**: 集中式日志查看、搜索、过滤和管理

## 技术栈

### 后端

- **语言**: Go 1.23.5
- **框架**: Gin
- **数据库**: SQLite (通过 GORM)
- **配置管理**: Viper

### 前端

- **语言**: TypeScript
- **框架**: React
- **UI组件**: shadcn/ui
- **样式**: Tailwind CSS
- **状态管理**: React Query
- **路由**: React Router

## 快速开始

### 后端

```bash
# 进入后端目录
cd backend

# 安装依赖
go mod download

# 构建项目
go build -o astrm

# 运行服务
./astrm
```

### 前端

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建项目
npm run build
```

## 项目结构

```
├── backend/            # Go 后端
│   ├── config/         # 配置管理
│   ├── handlers/       # 请求处理器
│   ├── middlewares/    # 中间件
│   ├── models/         # 数据模型
│   └── main.go         # 主入口
├── frontend/           # React 前端
│   ├── public/         # 静态资源
│   ├── src/            # 源代码
│   │   ├── components/ # UI组件
│   │   ├── lib/        # 工具函数和API
│   │   ├── pages/      # 页面组件
│   │   └── App.tsx     # 应用入口
│   └── index.html      # HTML模板
└── README.md           # 说明文档
```

## 许可证

MIT
