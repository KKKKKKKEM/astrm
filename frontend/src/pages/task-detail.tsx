import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Check, Clock, Play, RefreshCw, Terminal, X } from 'lucide-react'
import { TasksApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('details')
  const [isPolling, setIsPolling] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const { data: task, isLoading: isLoadingTask } = useQuery({
    queryKey: ['task', id],
    queryFn: () => id ? TasksApi.getById(id) : Promise.reject('No ID provided'),
    enabled: !!id,
  })

  const { data: logs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['task-logs', id],
    queryFn: () => id ? TasksApi.getLogs(id) : Promise.reject('No ID provided'),
    enabled: !!id,
  })

  const runMutation = useMutation({
    mutationFn: TasksApi.run,
    onSuccess: () => {
      toast.success('任务已开始执行')
      queryClient.invalidateQueries({ queryKey: ['task', id] })
      queryClient.invalidateQueries({ queryKey: ['task-logs', id] })
      // 开始轮询
      startPolling()
    },
    onError: (error) => {
      toast.error(`执行失败: ${error instanceof Error ? error.message : '未知错误'}`)
    },
  })

  // 开始轮询
  const startPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }
    
    setIsPolling(true)
    
    pollingIntervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['task-logs', id] })
      queryClient.invalidateQueries({ queryKey: ['task', id] })
    }, 2000) // 每2秒刷新一次
  }

  // 停止轮询
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    setIsPolling(false)
  }

  // 检查任务状态，如果完成则停止轮询
  useEffect(() => {
    if (task && isPolling) {
      if (task.status === 'success' || task.status === 'failed' || task.status === 'idle') {
        stopPolling()
        if (task.status === 'success') {
          toast.success('任务执行成功')
        } else if (task.status === 'failed') {
          toast.error('任务执行失败')
        }
      }
    }
  }, [task, isPolling])

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  // 监听任务状态变化，如果是运行中状态且没有在轮询，则开始轮询
  useEffect(() => {
    if (task && task.status === 'running' && !isPolling) {
      startPolling()
    }
  }, [task?.status])

  const handleRunTask = () => {
    if (id) {
      // 自动切换到日志标签页
      setActiveTab('logs')
      runMutation.mutate(id)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <Check className="h-5 w-5 text-green-500" />
      case 'failed':
        return <X className="h-5 w-5 text-red-500" />
      case 'running':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
      default:
        return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  if (isLoadingTask) {
    return <div className="flex justify-center p-4">加载中...</div>
  }

  if (!task) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">任务不存在</p>
        <Button onClick={() => navigate('/tasks')}>返回任务列表</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/tasks')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{task.name}</h2>
          <p className="text-muted-foreground">{task.description}</p>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <Badge
          variant={
            task.status === 'success' ? 'default' :
            task.status === 'failed' ? 'destructive' :
            task.status === 'running' ? 'outline' : 'secondary'
          }
          className="text-base py-1 px-2"
        >
          {task.status === 'idle' ? '空闲' :
           task.status === 'running' ? '运行中' :
           task.status === 'success' ? '成功' : '失败'}
        </Badge>
        {!task.enabled && (
          <Badge variant="outline" className="text-base py-1 px-2">已禁用</Badge>
        )}
        {isPolling && (
          <Badge variant="outline" className="text-base py-1 px-2 animate-pulse">
            实时更新中...
          </Badge>
        )}
        <div className="flex gap-2">
          <Button
            onClick={handleRunTask}
            disabled={task.status === 'running'}
          >
            <Play className="mr-2 h-4 w-4" />
            运行任务
          </Button>
          {isPolling && (
            <Button
              variant="outline"
              onClick={stopPolling}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              停止刷新
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">任务详情</TabsTrigger>
          <TabsTrigger value="logs">执行日志</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>任务信息</CardTitle>
              <CardDescription>
                任务详细配置和执行状态
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">源路径</p>
                  <pre className="text-sm text-muted-foreground bg-secondary p-2 rounded whitespace-pre-wrap">
                    {task.from}
                  </pre>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">目标路径</p>
                  <p className="text-sm text-muted-foreground bg-secondary p-2 rounded">
                    {task.dest}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">模式</p>
                  <p className="text-sm text-muted-foreground">
                    {task.mode}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">并发数</p>
                  <p className="text-sm text-muted-foreground">
                    {task.concurrency}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">ALIST ID</p>
                  <p className="text-sm text-muted-foreground">
                    {task.alist}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">计划</p>
                  <p className="text-sm text-muted-foreground">
                    {task.schedule || '未设置'}
                  </p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-sm font-medium">选项配置</p>
                  <div className="grid gap-2 md:grid-cols-3">
                    <p className="text-sm text-muted-foreground bg-secondary p-2 rounded">深度: {task.opts.deep}</p>
                    <p className="text-sm text-muted-foreground bg-secondary p-2 rounded">覆盖: {task.opts.overwrite ? '是' : '否'}</p>
                    <p className="text-sm text-muted-foreground bg-secondary p-2 rounded">刷新: {task.opts.refresh ? '是' : '否'}</p>
                    <p className="text-sm text-muted-foreground bg-secondary p-2 rounded">间隔: {task.opts.interval}</p>
                    <p className="text-sm text-muted-foreground bg-secondary p-2 rounded col-span-3">文件过滤器: {task.opts.filters}</p>
                    <p className="text-sm text-muted-foreground bg-secondary p-2 rounded col-span-3">额外文件: {task.opts.extra}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">上次运行</p>
                  <p className="text-sm text-muted-foreground">
                    {task.last_run ? formatDate(task.last_run) : '未运行'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">下次运行</p>
                  <p className="text-sm text-muted-foreground">
                    {task.next_run ? formatDate(task.next_run) : '未调度'}
                  </p>
                </div>
                {task.command && (
                    <div className="col-span-2 space-y-1">
                      <p className="text-sm font-medium">命令</p>
                      <p className="text-sm text-muted-foreground bg-secondary p-2 rounded">
                        {task.command}
                      </p>
                    </div>
                )}
                <div className="space-y-1">
                  <p className="text-sm font-medium">创建时间</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(task.created_at)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">更新时间</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(task.updated_at)}
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" onClick={() => navigate(`/tasks/${id}/edit`)}>
                编辑任务
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>执行日志</CardTitle>
              <CardDescription>
                任务的执行历史记录
                {isPolling && (
                  <span className="text-blue-500 ml-2">
                    • 实时更新中
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <div className="flex justify-center p-4">加载中...</div>
              ) : logs && logs.length > 0 ? (
                <div className="space-y-6">
                  {logs.map((log) => (
                    <div key={log.id} className="border rounded-lg overflow-hidden">
                      <div className="bg-muted p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          <span className="font-medium">
                            {log.status === 'idle' ? '空闲' :
                             log.status === 'running' ? '运行中' :
                             log.status === 'success' ? '成功' : '失败'}
                          </span>
                          {log.status === 'running' && (
                            <Badge variant="outline" className="text-xs animate-pulse">
                              实时更新
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span>开始: {formatDate(log.start_time)}</span>
                          {log.end_time && (
                            <span className="ml-4">
                              结束: {formatDate(log.end_time)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Terminal className="h-4 w-4" />
                          <span className="font-medium">输出</span>
                        </div>
                        <pre className="bg-black text-white p-3 rounded overflow-auto max-h-96">
                          {log.output || '无输出'}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">暂无执行日志</p>
                  <Button onClick={handleRunTask} disabled={task.status === 'running'}>
                    <Play className="mr-2 h-4 w-4" />
                    运行任务
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}