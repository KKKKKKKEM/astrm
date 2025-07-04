import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { LogsApi, Log } from '@/lib/api';

export function LogDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [log, setLog] = useState<Log | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLog();
  }, [id]);

  const fetchLog = async () => {
    try {
      setLoading(true);
      if (!id) return;
      const data = await LogsApi.getById(id);
      setLog(data);
    } catch (error) {
      console.error('获取日志失败:', error);
      toast({
        variant: 'destructive',
        title: '错误',
        description: '获取日志详情失败',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container mx-auto py-6 flex justify-center">加载中...</div>;
  }

  if (!log) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">日志不存在</h1>
          <Button variant="outline" onClick={() => navigate('/logs')}>
            返回日志列表
          </Button>
        </div>
        <div className="border rounded-md p-6 text-center">
          未找到指定的日志记录
        </div>
      </div>
    );
  }

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

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">日志详情</h1>
        <Button variant="outline" onClick={() => navigate('/logs')}>
          返回日志列表
        </Button>
      </div>

      <div className="border rounded-md p-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500">日志ID</h3>
            <p className="mt-1">{log.id}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">记录时间</h3>
            <p className="mt-1">{formatTimestamp(log.created_at)}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">来源</h3>
            <p className="mt-1 hover:underline cursor-pointer" onClick={() => navigate(`/tasks/${log.source}`)}>
              {log.source}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">日志级别</h3>
            <p className={`mt-1 font-medium ${getLogLevelColor(log.level)}`}>
              {log.level.toUpperCase()}
            </p>
          </div>
        </div>

        <Tabs defaultValue="message">
          <TabsList className="mb-4">
            <TabsTrigger value="message">日志内容</TabsTrigger>
            <TabsTrigger value="details">详细信息</TabsTrigger>
          </TabsList>
          <TabsContent value="message" className="border rounded-md p-4">
            <pre className="whitespace-pre-wrap font-mono text-sm">
              {log.message}
            </pre>
          </TabsContent>
          <TabsContent value="details">
            <div className="border rounded-md p-4">
              {log.details ? (
                <pre className="whitespace-pre-wrap font-mono text-sm">
                  {log.details}
                </pre>
              ) : (
                <p className="text-gray-500 italic">无详细信息</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
