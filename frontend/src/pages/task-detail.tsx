import { useState, useEffect, useRef, useCallback } from 'react'
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

// DynamicOptsDisplay 组件保持不变
const DynamicOptsDisplay = ({ opts }: { opts: Record<string, any> | null | undefined }) => {
  if (!opts || Object.keys(opts).length === 0) {
    return <p className="text-sm text-muted-foreground">未配置任何选项。</p>
  }
  const renderValue = (value: any) => {
    if (typeof value === 'boolean') return value ? '是' : '否'
    if (Array.isArray(value)) return `[ ${value.join(', ')} ]`
    if (typeof value === 'object' && value !== null) return JSON.stringify(value, null, 2)
    return String(value)
  }
  return (
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(opts).map(([key, value]) => (
            <div key={key} className="space-y-1 bg-secondary p-3 rounded-lg">
              <p className="text-sm font-medium capitalize">{key.replace(/_/g, ' ')}</p>
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap break-all">{renderValue(value)}</pre>
            </div>
        ))}
      </div>
  )
};

export function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('details')
  const [isPolling, setIsPolling] = useState(false)
  const prevTaskStatusRef = useRef<string | undefined>()

  // --- 这是关键修正点 ---
  // 为 task 查询也添加 refetchInterval
  const { data: task, isLoading: isLoadingTask } = useQuery({
    queryKey: ['task', id],
    queryFn: () => id ? TasksApi.getById(id) : Promise.reject('No ID provided'),
    enabled: !!id,
    refetchInterval: isPolling ? 2000 : false, // <--- 新增此行
  });

  const { data: logs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['task-logs', id],
    queryFn: () => id ? TasksApi.getLogs(id) : Promise.reject('No ID provided'),
    enabled: !!id,
    refetchInterval: isPolling ? 2000 : false,
  });

  const runMutation = useMutation({
    mutationFn: (taskId: string) => TasksApi.run(taskId),
    onSuccess: async () => {
      toast.success('任务已开始执行');
      // 立即手动刷新一次，让UI尽快响应，然后交给Interval
      await queryClient.invalidateQueries({ queryKey: ['task', id] });
      await queryClient.invalidateQueries({ queryKey: ['task-logs', id] });
    },
    onError: (error) => {
      toast.error(`执行失败: ${error instanceof Error ? error.message : '未知错误'}`);
    },
  });

  // 使用 useCallback 避免不必要的重渲染
  const startPolling = useCallback(() => setIsPolling(true), []);
  const stopPolling = useCallback(() => setIsPolling(false), []);

  // 此 useEffect 只负责根据任务状态来【启停】轮询
  useEffect(() => {
    if (task?.status === 'running' && !isPolling) {
      startPolling();
    } else if (task?.status !== 'running' && isPolling) {
      // 当任务状态不再是 'running' 时，停止轮询
      stopPolling();
    }
  }, [task?.status, isPolling, startPolling, stopPolling]);

  // 此 useEffect 只负责在状态【转变】时发出通知
  useEffect(() => {
    const prevStatus = prevTaskStatusRef.current;
    const currentStatus = task?.status;

    if (prevStatus === 'running') {
      if (currentStatus === 'success') {
        toast.success('任务执行成功');
      } else if (currentStatus === 'failed') {
        toast.error('任务执行失败');
      }
    }

    prevTaskStatusRef.current = currentStatus;
  }, [task?.status]);

  // 组件卸载时，确保清除轮询状态
  useEffect(() => {
    return () => {
      // 确保在离开页面时停止轮询
      stopPolling();
    };
  }, [stopPolling]);


  const handleRunTask = () => {
    if (id) {
      setActiveTab('logs');
      runMutation.mutate(id);
    }
  };

  // 其他 UI 辅助函数保持不变
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'success': return 'default';
      case 'failed': return 'destructive';
      case 'running': return 'outline';
      default: return 'secondary';
    }
  }
  const getStatusText = (status: string) => {
    switch (status) {
      case 'idle': return '空闲';
      case 'running': return '运行中';
      case 'success': return '成功';
      case 'failed': return '失败';
      default: return '未知';
    }
  }
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <Check className="h-5 w-5 text-green-500" />;
      case 'failed': return <X className="h-5 w-5 text-red-500" />;
      case 'running': return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      default: return <Clock className="h-5 w-5 text-gray-500" />;
    }
  }

  // JSX 渲染部分保持不变
  if (isLoadingTask && !task) {
    return <div className="flex justify-center p-4">加载中...</div>;
  }
  if (!task) {
    return <div className="text-center py-8"><p className="text-muted-foreground">任务未找到。</p></div>;
  }

  return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/tasks')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{task.name}</h2>
            <p className="text-muted-foreground">{task.description || '暂无描述'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <Badge variant={getStatusBadgeVariant(task.status)} className="text-base py-1 px-2">
            {getStatusText(task.status)}
          </Badge>
          {!task.enabled && <Badge variant="outline" className="text-base py-1 px-2">已禁用</Badge>}
          {isPolling && (
              <Badge variant="outline" className="text-base py-1 px-2 animate-pulse text-blue-600">
                实时更新中...
              </Badge>
          )}
          <div className="flex gap-2">
            <Button onClick={handleRunTask} disabled={runMutation.isPending || task.status === 'running'}>
              <Play className="mr-2 h-4 w-4" /> 运行任务
            </Button>
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
                <CardDescription>任务详细配置和执行状态</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1"><p className="text-sm font-medium">并发数</p><p className="text-sm text-muted-foreground">{task.concurrency}</p></div>
                  <div className="space-y-1"><p className="text-sm font-medium">计划 (Cron)</p><p className="text-sm text-muted-foreground">{task.schedule || '未设置'}</p></div>
                  {task.command && (<div className="col-span-2 space-y-1"><p className="text-sm font-medium">命令</p><pre className="text-sm text-muted-foreground bg-secondary p-3 rounded font-mono whitespace-pre-wrap break-all">{task.command}</pre></div>)}
                  <div className="space-y-1"><p className="text-sm font-medium">上次运行</p><p className="text-sm text-muted-foreground">{task.last_run ? formatDate(task.last_run) : '未运行'}</p></div>
                  <div className="space-y-1"><p className="text-sm font-medium">下次运行</p><p className="text-sm text-muted-foreground">{task.next_run ? formatDate(task.next_run) : '未调度'}</p></div>
                  <div className="space-y-1"><p className="text-sm font-medium">创建时间</p><p className="text-sm text-muted-foreground">{formatDate(task.created_at)}</p></div>
                  <div className="space-y-1"><p className="text-sm font-medium">更新时间</p><p className="text-sm text-muted-foreground">{formatDate(task.updated_at)}</p></div>
                </div>
                <div className="col-span-2 space-y-2">
                  <h3 className="text-lg font-semibold mt-4">选项配置</h3>
                  <DynamicOptsDisplay opts={task.opts} />
                </div>
              </CardContent>
              <CardFooter><Button variant="outline" onClick={() => navigate(`/tasks/${id}/edit`)}>编辑任务</Button></CardFooter>
            </Card>
          </TabsContent>
          <TabsContent value="logs" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>执行日志</CardTitle>
                <CardDescription>任务的执行历史记录 {isPolling && <span className="text-blue-500 ml-2">• 实时更新中</span>}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingLogs && !logs ? (
                    <div className="flex justify-center p-4">加载中...</div>
                ) : logs && logs.length > 0 ? (
                    <div className="space-y-6">
                      {logs.map((log: any) => (
                          <div key={log.id} className="border rounded-lg overflow-hidden">
                            <div className="bg-muted p-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">{getStatusIcon(log.status)}<span className="font-medium">{getStatusText(log.status)}</span>{log.status === 'running' && isPolling && <Badge variant="outline" className="text-xs animate-pulse">实时</Badge>}</div>
                              <div className="text-sm text-muted-foreground"><span>开始: {formatDate(log.start_time)}</span>{log.end_time && <span className="ml-4">结束: {formatDate(log.end_time)}</span>}</div>
                            </div>
                            <div className="p-3">
                              <div className="flex items-center gap-2 mb-2"><Terminal className="h-4 w-4" /><span className="font-medium">输出</span></div>
                              <pre className="bg-black text-white p-3 rounded overflow-auto max-h-96">{log.output || '无输出'}</pre>
                            </div>
                          </div>
                      ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">暂无执行日志</p>
                      <Button onClick={handleRunTask} disabled={runMutation.isPending || task.status === 'running'}><Play className="mr-2 h-4 w-4" />运行任务</Button>
                    </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  )
}

