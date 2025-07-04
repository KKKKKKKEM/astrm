import axios from 'axios'

const baseURL = '/api'

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// API响应类型
export interface ApiResponse<T> {
  data: T
  total?: number
  page?: string
}

// 任务选项接口
export interface TaskOptions {
  deep: number
  overwrite: boolean
  filters: string
  extra: string
  refresh: boolean
  interval: number
}

// 任务接口
export interface Task {
  id: string
  name: string
  description: string
  alist: number
  concurrency: number
  from: string
  dest: string
  mode: string
  spec: string
  opts: TaskOptions
  command: string
  schedule: string
  enabled: boolean
  status: 'idle' | 'running' | 'success' | 'failed'
  last_run: string | null
  next_run: string | null
  created_at: string
  updated_at: string
}

// WebSocket消息类型
export interface TaskOutputMessage {
  type: 'output' | 'status' | 'error'
  output?: string
  status?: string
  error?: string
  task_id: string
}

// 创建任务输出WebSocket连接
export function createTaskOutputWebSocket(taskId: string, 
  onMessage: (message: TaskOutputMessage) => void,
  onOpen?: () => void,
  onClose?: () => void,
  onError?: (error: Event) => void
): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//${window.location.host}/api/tasks/${taskId}/ws`

  const socket = new WebSocket(wsUrl)

  socket.onopen = () => {
    console.log(`WebSocket连接已打开：任务ID ${taskId}`)
    onOpen?.() 
  }

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data) as TaskOutputMessage
      onMessage(message)
    } catch (error) {
      console.error('解析WebSocket消息失败:', error)
    }
  }

  socket.onclose = () => {
    console.log(`WebSocket连接已关闭：任务ID ${taskId}`)
    onClose?.()
  }

  socket.onerror = (error) => {
    console.error(`WebSocket错误：任务ID ${taskId}`, error)
    onError?.(error)
  }

  return socket
}

export interface TaskLog {
  id: string
  task_id: string
  start_time: string
  end_time: string | null
  status: 'idle' | 'running' | 'success' | 'failed'
  output: string
  created_at: string
  updated_at: string
}

// 配置接口
export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'textarea' | 'switch' | 'date'
  value: any
  placeholder?: string
  required: boolean
  options?: Array<{ label: string; value: any }>
}

export interface Config {
  id: string
  name: string
  description: string
  type: 'system' | 'user' | 'service'
  fields: ConfigField[]
  created_at: string
  updated_at: string
}

// 日志接口
export interface Log {
  id: string
  source: string
  level: 'debug' | 'info' | 'warning' | 'error'
  message: string
  details: string
  created_at: string
  updated_at: string
}

// 代理接口
export interface Proxy {
  id: string
  name: string
  description: string
  path: string
  target_url: string
  enabled: boolean
  strip_prefix: boolean
  created_at: string
  updated_at: string
}

// Tasks API
export const TasksApi = {
  getAll: async (params?: any) => {
    try {
      const response = await apiClient.get<ApiResponse<Task[]>>('/tasks', { params })
      return response.data
    } catch (error) {
      console.error('获取任务列表失败:', error)
      throw error
    }
  },
  getById: async (id: string) => {
    try {
      const response = await apiClient.get<Task>(`/tasks/${id}`)
      return response.data
    } catch (error) {
      console.error(`获取任务 ${id} 失败:`, error)
      throw error
    }
  },
  create: async (task: Partial<Task>) => {
    try {
      console.log('发送创建任务请求:', task)
      const response = await apiClient.post<Task>('/tasks', task)
      console.log('创建任务成功:', response.data)
      return response.data
    } catch (error) {
      console.error('创建任务失败:', error)
      if (axios.isAxiosError(error) && error.response) {
        console.error('服务器返回:', error.response.data)
      }
      throw error
    }
  },
  update: async (id: string, task: Partial<Task>) => {
    try {
      console.log(`发送更新任务 ${id} 请求:`, task)
      const response = await apiClient.put<Task>(`/tasks/${id}`, task)
      console.log('更新任务成功:', response.data)
      return response.data
    } catch (error) {
      console.error(`更新任务 ${id} 失败:`, error)
      if (axios.isAxiosError(error) && error.response) {
        console.error('服务器返回:', error.response.data)
      }
      throw error
    }
  },
  delete: async (id: string) => {
    try {
      const response = await apiClient.delete(`/tasks/${id}`)
      return response.data
    } catch (error) {
      console.error(`删除任务 ${id} 失败:`, error)
      throw error
    }
  },
  run: async (id: string) => {
    try {
      console.log(`开始运行任务: ${id}`)
      const response = await apiClient.post(`/tasks/${id}/run`)
      console.log('任务运行响应:', response.data)
      return response.data.task_id
    } catch (error) {
      console.error(`运行任务 ${id} 失败:`, error)
      throw error
    }
  },
  getLogs: async (id: string) => {
    try {
      const response = await apiClient.get<TaskLog[]>(`/tasks/${id}/logs`)
      return response.data
    } catch (error) {
      console.error(`获取任务 ${id} 日志失败:`, error)
      throw error
    }
  },
  getTaskOutput: async (id: string) => {
    try {
      const response = await apiClient.get<{output: string}>(`/tasks/${id}/output`)
      return response.data.output
    } catch (error) {
      console.error(`获取任务 ${id} 输出失败:`, error)
      throw error
    }
  },
  getTaskStatus: async (id: string) => {
    try {
      const response = await apiClient.get<{status: string}>(`/tasks/${id}/status`)
      return response.data.status
    } catch (error) {
      console.error(`获取任务 ${id} 状态失败:`, error)
      throw error
    }
  },
}

// Configs API
export const ConfigsApi = {
  getAll: async (params?: any) => {
    const response = await apiClient.get<ApiResponse<Config[]>>('/configs', { params })
    return response.data
  },
  getById: async (id: string) => {
    const response = await apiClient.get<Config>(`/configs/${id}`)
    return response.data
  },
  create: async (config: Partial<Config>) => {
    const response = await apiClient.post<Config>('/configs', config)
    return response.data
  },
  update: async (id: string, config: Partial<Config>) => {
    const response = await apiClient.put<Config>(`/configs/${id}`, config)
    return response.data
  },
  delete: async (id: string) => {
    const response = await apiClient.delete(`/configs/${id}`)
    return response.data
  },
  getSchema: async () => {
    const response = await apiClient.get('/configs/schema')
    return response.data
  },
}

// Logs API
export const LogsApi = {
  getAll: async (params?: any) => {
    const response = await apiClient.get<ApiResponse<Log[]>>('/logs', { params })
    return response.data
  },
  getById: async (id: string) => {
    const response = await apiClient.get<Log>(`/logs/${id}`)
    return response.data
  },
  delete: async (id: string) => {
    const response = await apiClient.delete(`/logs/${id}`)
    return response.data
  },
  clear: async (params?: any) => {
    const response = await apiClient.delete('/logs', { params })
    return response.data
  },
}

// Proxies API
export const ProxiesApi = {
  getAll: async (params?: any) => {
    const response = await apiClient.get<ApiResponse<Proxy[]>>('/proxies', { params })
    return response.data
  },
  getById: async (id: string) => {
    const response = await apiClient.get<Proxy>(`/proxies/${id}`)
    return response.data
  },
  create: async (proxy: Partial<Proxy>) => {
    const response = await apiClient.post<Proxy>('/proxies', proxy)
    return response.data
  },
  update: async (id: string, proxy: Partial<Proxy>) => {
    const response = await apiClient.put<Proxy>(`/proxies/${id}`, proxy)
    return response.data
  },
  delete: async (id: string) => {
    const response = await apiClient.delete(`/proxies/${id}`)
    return response.data
  },
}
