import { useQuery } from '@tanstack/react-query'
import { TasksApi, LogsApi, ProxiesApi, ConfigsApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { AlertCircle, ArrowUpRight, CheckCircle2, XCircle } from 'lucide-react'

export function Dashboard() {
  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => TasksApi.getAll({ pageSize: 5 }),
  })

  const { data: logs } = useQuery({
    queryKey: ['logs'],
    queryFn: () => LogsApi.getAll({ pageSize: 5 }),
  })

  const { data: proxies } = useQuery({
    queryKey: ['proxies'],
    queryFn: () => ProxiesApi.getAll({ pageSize: 5 }),
  })

  const { data: configs } = useQuery({
    queryKey: ['configs'],
    queryFn: () => ConfigsApi.getAll({ pageSize: 5 }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">仪表盘</h2>
        <p className="text-muted-foreground">系统概览和快速操作</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">任务总数</CardTitle>
            <div className="h-4 w-4 text-muted-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-muted-foreground"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              已启用: {tasks?.data.filter(task => task.enabled).length || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">配置总数</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{configs?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              系统配置: {configs?.data.filter(config => config.type === 'system').length || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">代理总数</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <path d="M2 10h20" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{proxies?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              已启用: {proxies?.data.filter(proxy => proxy.enabled).length || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">日志总数</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              错误: {logs?.data.filter(log => log.level === 'error').length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>最近任务</CardTitle>
          </CardHeader>
          <CardContent>
            {tasks?.data && tasks.data.length > 0 ? (
              <div className="space-y-4">
                {tasks.data.map((task) => (
                  <div key={task.id} className="flex items-center gap-4">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{task.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {task.last_run ? formatDate(task.last_run) : '未运行'}
                      </p>
                    </div>
                    <Badge
                      variant={task.status === 'success' ? 'default' : 
                              task.status === 'failed' ? 'destructive' : 
                              task.status === 'running' ? 'outline' : 'secondary'}
                    >
                      {task.status === 'idle' ? '空闲' : 
                       task.status === 'running' ? '运行中' : 
                       task.status === 'success' ? '成功' : '失败'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无任务</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最近日志</CardTitle>
          </CardHeader>
          <CardContent>
            {logs?.data && logs.data.length > 0 ? (
              <div className="space-y-4">
                {logs.data.map((log) => (
                  <div key={log.id} className="flex items-start gap-4">
                    {log.level === 'error' ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : log.level === 'warning' ? (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center">
                        <p className="text-sm font-medium leading-none">{log.source}</p>
                        <p className="ml-auto text-xs text-muted-foreground">
                          {formatDate(log.created_at)}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">{log.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无日志</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>活跃代理</CardTitle>
        </CardHeader>
        <CardContent>
          {proxies?.data && proxies.data.filter(p => p.enabled).length > 0 ? (
            <div className="space-y-4">
              {proxies.data
                .filter(proxy => proxy.enabled)
                .map((proxy) => (
                  <Alert key={proxy.id}>
                    <ArrowUpRight className="h-4 w-4" />
                    <AlertTitle className="flex">
                      {proxy.name}
                      <Badge className="ml-2" variant="outline">{proxy.path}</Badge>
                    </AlertTitle>
                    <AlertDescription>
                      {proxy.target_url}
                    </AlertDescription>
                  </Alert>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无活跃代理</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
