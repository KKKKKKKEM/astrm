import { useState, useEffect, useCallback } from 'react'; // <-- 引入 useCallback
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { LogsApi, Log } from '@/lib/api';

export function Logs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('all');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { toast } = useToast();

  // **优化点 1: 将 fetchLogs 包装在 useCallback 中**
  // 这可以防止它在每次渲染时都被重新创建，避免 useEffect 出现不必要的触发。
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      // 在函数内部直接使用最新的 state 值，而不是通过参数传递
      const params: Record<string, any> = {
        page: page,
        pageSize: pageSize,
      };

      if (search) params.search = search;
      if (level && level !== 'all') params.level = level;

      const result = await LogsApi.getAll(params);
      setLogs(result.data || []);
      setTotal(result.total || 0);
    } catch (error) {
      console.error('获取日志失败:', error);
      toast({
        variant: 'destructive',
        title: '错误',
        description: '获取日志列表失败',
      });
    } finally {
      setLoading(false);
    }
  }, [page, search, level, toast]); // <-- 将所有依赖项放入数组

  // **优化点 2: 使用一个 useEffect 来处理所有的数据获取**
  // 当任何一个依赖项 (page, search, level) 变化时，这个 effect 都会重新运行。
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]); // <-- 依赖于 memoized 的 fetchLogs 函数

  // **优化点 3: 事件处理器只负责更新状态**
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // 触发 effect
    // 不再需要手动调用 fetchLogs
  };

  const handleLevelChange = (value: string) => {
    setLevel(value);
    setPage(1); // 重置分页并触发 effect
    // 不再需要手动调用 fetchLogs
  };


  // --- 后续代码保持不变 ---

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getLogLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      case 'info': return 'text-blue-600';
      case 'debug': return 'text-gray-600';
      default: return 'text-gray-900';
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">日志管理</h1>
        </div>

        <div className="mb-6 flex flex-wrap gap-4">
          {/* onSubmit 中已经包含了 setPage(1)，但如果用户清空输入框再搜索，
            search state 会变化，需要 setPage(1) 来确保从第一页开始。
            handleSearch 现在只处理 form 提交事件，search 的变化由 onChange 处理。
            为了简单起见，我们可以在 handleSearch 中只调用 fetchLogs()，
            但更好的做法是让 state 驱动。
            当前逻辑：search 变化不会立即触发搜索，需要点击按钮。这样是ok的。
            点击搜索按钮会重置 page 并触发 useEffect。
        */}
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <Input
                placeholder="搜索日志内容或任务名称"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
            />
            <Button type="submit">搜索</Button>
          </form>

          <Select value={level} onValueChange={handleLevelChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="日志级别" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部级别</SelectItem>
              <SelectItem value="debug">Debug</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>级别</TableHead>
                <TableHead>任务</TableHead>
                <TableHead className="w-1/2">消息</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      加载中...
                    </TableCell>
                  </TableRow>
              ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      暂无日志数据
                    </TableCell>
                  </TableRow>
              ) : (
                  logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{formatTimestamp(log.created_at)}</TableCell>
                        <TableCell>
                    <span className={`font-medium ${getLogLevelColor(log.level)}`}>
                      {log.level.toUpperCase()}
                    </span>
                        </TableCell>
                        <TableCell>
                          <Link to={`/tasks/${log.source}`} className="hover:underline">
                            {log.source || 'N/A'}
                          </Link>
                        </TableCell>
                        <TableCell className="truncate max-w-xs">
                          {log.message}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/logs/${log.id}`}>查看</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-gray-500">
                共 {total} 条记录，第 {page}/{totalPages} 页
              </div>
              <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                >
                  上一页
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                >
                  下一页
                </Button>
              </div>
            </div>
        )}
      </div>
  );
}
