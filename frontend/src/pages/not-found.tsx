import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-[70vh] space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">404 - 页面未找到</h1>
        <p className="text-muted-foreground max-w-[600px] mx-auto">
          抱歉，您访问的页面不存在或已被移除。
        </p>
      </div>
      <Button asChild>
        <Link to="/">返回首页</Link>
      </Button>
    </div>
  )
}
