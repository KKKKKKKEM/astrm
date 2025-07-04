import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

interface Proxy {
  id: string;
  name: string;
  path: string;
  target_url: string;
  enabled: boolean;
  strip_prefix: boolean;
  created_at: string;
}
export function Proxies() {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchProxies();
  }, []);

  const fetchProxies = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/proxies?search=${search}`);
      if (!response.ok) throw new Error('获取代理失败');
      const data = await response.json();
      setProxies(data.data || []);
    } catch (error) {
      console.error('获取代理失败:', error);
      toast({
        variant: 'destructive',
        title: '错误',
        description: '获取代理列表失败',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      // 先获取当前代理的完整信息
      const getResponse = await fetch(`/api/proxies/${id}`);
      if (!getResponse.ok) throw new Error('获取代理信息失败');
      const proxyData = await getResponse.json();

      // 更新启用状态
      const response = await fetch(`/api/proxies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...proxyData,
          enabled: !currentStatus
        }),
      });

      if (!response.ok) throw new Error('更新状态失败');

      setProxies(proxies.map(proxy => 
        proxy.id === id ? { ...proxy, enabled: !currentStatus } : proxy
      ));

      toast({
        title: '成功',
        description: `代理已${!currentStatus ? '启用' : '禁用'}`,
      });
    } catch (error) {
      console.error('更新状态失败:', error);
      toast({
        variant: 'destructive',
        title: '错误',
        description: '更新代理状态失败',
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除代理 "${name}" 吗？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/proxies/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('删除代理失败');

      // 从列表中移除已删除的代理
      setProxies(proxies.filter(proxy => proxy.id !== id));

      toast({
        title: '成功',
        description: `代理 "${name}" 已删除`,
      });
    } catch (error) {
      console.error('删除代理失败:', error);
      toast({
        variant: 'destructive',
        title: '错误',
        description: '删除代理失败',
      });
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProxies();
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">代理管理</h1>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={async () => {
              try {
                const response = await fetch('/api/proxies/refresh', {
                  method: 'POST',
                });
                if (!response.ok) throw new Error('刷新代理失败');
                toast({
                  title: '成功',
                  description: '所有代理配置已刷新',
                });
                // 刷新列表
                fetchProxies();
              } catch (error) {
                console.error('刷新代理失败:', error);
                toast({
                  variant: 'destructive',
                  title: '错误',
                  description: '刷新代理配置失败',
                });
              }
            }}
          >
            刷新代理配置
          </Button>
          <Button asChild>
            <Link to="/proxies/new">添加代理</Link>
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="搜索代理名称、路径或目标URL"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Button type="submit">搜索</Button>
          </form>
          <Button 
            onClick={fetchProxies} 
            variant="outline"
          >
            刷新列表
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          代理配置创建或修改后会立即生效，点击「访问代理」可直接进入代理服务。
        </p>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>路径</TableHead>
              <TableHead>目标URL</TableHead>
              <TableHead>状态</TableHead>
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
            ) : proxies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  暂无代理数据
                </TableCell>
              </TableRow>
            ) : (
              proxies.map((proxy) => (
                <TableRow key={proxy.id}>
                  <TableCell className="font-medium">{proxy.name}</TableCell>
                  <TableCell>{proxy.path}</TableCell>
                  <TableCell className="truncate max-w-xs">{proxy.target_url}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <div className="mr-3">
                        <div className={`w-3 h-3 rounded-full ${proxy.enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      </div>
                      <span className={`text-sm font-medium ${proxy.enabled ? 'text-green-600' : 'text-gray-500'}`}>
                        {proxy.enabled ? '已启用' : '已禁用'}
                      </span>
                      <div className="ml-4">
                        <Switch
                          checked={proxy.enabled}
                          onCheckedChange={() => handleToggleStatus(proxy.id, proxy.enabled)}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/proxies/${proxy.id}`}>编辑</Link>
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDelete(proxy.id, proxy.name)}
                      >
                        删除
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm" 
                        asChild
                        className={!proxy.enabled ? "opacity-50 cursor-not-allowed" : ""}
                      >
                        <a 
                          href={proxy.path} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={!proxy.enabled ? "pointer-events-none" : ""}
                          onClick={(e) => {
                            if (!proxy.enabled) {
                              e.preventDefault();
                              toast({
                                title: "提示",
                                description: "代理未启用，请先启用后再访问",
                              });
                              return;
                            }
                            toast({
                              title: "打开代理",
                              description: `正在访问: ${proxy.path} -> ${proxy.target_url}`,
                            });
                          }}
                        >
                          <span className="flex items-center">访问代理 ↗</span>
                        </a>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
