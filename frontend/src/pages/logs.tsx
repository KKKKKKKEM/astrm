import { useState, useEffect } from 'react';
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

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
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
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleLevelChange = (value: string) => {
    debugger;
    setLevel(value);
    setPage(1);
    setTimeout(fetchLogs, 0);
  };

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
                      {log.source}
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
              disabled={page === 1}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
