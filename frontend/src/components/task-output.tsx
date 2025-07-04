import { useEffect, useRef, useState } from 'react'
import { createTaskOutputWebSocket, TaskOutputMessage, TasksApi } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface TaskOutputProps {
  taskId: string
  onStatusChange?: (status: string) => void
}

export function TaskOutput({ taskId, onStatusChange }: TaskOutputProps) {
  const [output, setOutput] = useState<string[]>([])
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isPolling, setIsPolling] = useState(false) // 新增：是否正在轮询输出
  const outputEndRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const pollingIntervalRef = useRef<number | null>(null) // 新增：轮询间隔引用

  // 从WebSocket获取输出
  useEffect(() => {
    if (!taskId) return;

    // 创建WebSocket连接
    try {
      const socket = createTaskOutputWebSocket(
        taskId,
        (message: TaskOutputMessage) => {
          // 处理消息
          if (message.type === 'output' && message.output) {
            setOutput(prev => [...prev, message.output!])
          } else if (message.type === 'status' && message.status) {
            setStatus(message.status)
            onStatusChange?.(message.status)

            // 如果任务已完成或失败，停止轮询
            if (message.status === 'success' || message.status === 'failed') {
              stopPolling();
            }
          } else if (message.type === 'error') {
            setError(message.error || '发生未知错误')
          }
        },
        () => {
          setIsConnected(true)
          // WebSocket连接成功后，获取初始输出
          fetchInitialOutput()
        },
        () => {
          setIsConnected(false)
          // WebSocket断开后，如果任务仍在运行，启动轮询
          if (status === 'running') {
            startPolling()
          }
        },
        () => {
          setError('无法通过WebSocket连接到服务器，将使用轮询方式获取输出')
          // WebSocket错误时启动轮询
          startPolling()
        }
      )

      socketRef.current = socket
    } catch (error) {
      console.error('创建WebSocket连接失败:', error)
      setError('无法创建WebSocket连接，将使用轮询方式获取输出')
      // 如果WebSocket连接失败，启动轮询
      startPolling()
    }

    // 清理函数
    return () => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close()
      }
      stopPolling()
    }
  }, [taskId])

  // 获取初始输出
  const fetchInitialOutput = async () => {
    try {
      // 获取最新的任务日志
      const logs = await TasksApi.getLogs(taskId)
      if (logs && logs.length > 0) {
        const latestLog = logs[0] // 假设按时间倒序排列，第一个是最新的

        // 如果有输出，按行分割并设置
        if (latestLog.output) {
          const lines = latestLog.output.split('\n').filter(line => line.trim() !== '')
          setOutput(lines)
        }

        // 设置状态
        setStatus(latestLog.status)
        onStatusChange?.(latestLog.status)

        // 如果任务正在运行但WebSocket没有连接，启动轮询
        if (latestLog.status === 'running' && !isConnected) {
          startPolling()
        }
      }
    } catch (error) {
      console.error('获取初始输出失败:', error)
      setError('获取任务历史输出失败')
    }
  }

  // 通过API获取最新输出
  const fetchLatestOutput = async () => {
    if (!taskId || !isPolling) return

    try {
      // 获取任务状态和输出
      const task = await TasksApi.getById(taskId)
      const logs = await TasksApi.getLogs(taskId)

      if (logs && logs.length > 0) {
        const latestLog = logs[0]

        // 更新状态
        setStatus(task.status)
        onStatusChange?.(task.status)

        // 更新输出
        if (latestLog.output) {
          const lines = latestLog.output.split('\n').filter(line => line.trim() !== '')
          setOutput(lines)
        }

        // 如果任务已完成或失败，停止轮询
        if (task.status !== 'running') {
          stopPolling()
        }
      }
    } catch (error) {
      console.error('轮询任务输出失败:', error)
      // 不设置错误，避免频繁提示
    }
  }

  // 开始轮询
  const startPolling = () => {
    if (isPolling) return

    setIsPolling(true)
    // 每2秒轮询一次
    pollingIntervalRef.current = window.setInterval(fetchLatestOutput, 2000) as unknown as number
  }

  // 停止轮询
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    setIsPolling(false)
  }

  // 手动刷新输出
  const handleRefresh = () => {
    fetchLatestOutput()
  }

  // 自动滚动到底部
  useEffect(() => {
    if (outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [output])

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">任务输出</CardTitle>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge variant="outline" className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                已连接
              </Badge>
            ) : isPolling ? (
              <Badge variant="outline" className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                轮询中
              </Badge>
            ) : (
              <Badge variant="outline" className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                未连接
              </Badge>
            )}
            {status && (
              <Badge 
                variant={status === 'running' ? 'outline' :
                         status === 'success' ? 'default' :
                         status === 'failed' ? 'destructive' : 'secondary'}
                className="ml-2"
              >
                {status === 'idle' ? '空闲' :
                 status === 'running' ? '运行中' :
                 status === 'success' ? '成功' : '失败'}
              </Badge>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleRefresh} 
              title="刷新输出"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>
          {error ? (
            <div className="text-red-500 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {error}
            </div>
          ) : (
            status === 'running' ? '任务正在运行中...' : 
            status === 'success' ? '任务已完成' :
            status === 'failed' ? '任务执行失败' : '正在连接...'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-muted p-3 rounded-md max-h-96 overflow-y-auto font-mono text-sm">
          {output.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              {status === 'running' ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-5 w-5 animate-spin mb-2" />
                  <span>等待输出...</span>
                </div>
              ) : (
                <span>暂无输出</span>
              )}
            </div>
          ) : (
            <div className="whitespace-pre-wrap">
              {output.map((line, index) => (
                <div key={index} className={
                  line.includes('错误') || line.includes('失败') || line.startsWith('ERROR') ? 'text-red-500' :
                  line.includes('成功') || line.includes('完成') ? 'text-green-500' : ''
                }>
                  {line}
                </div>
              ))}
              <div ref={outputEndRef} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
