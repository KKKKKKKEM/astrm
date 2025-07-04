import { Link } from 'react-router-dom'
import { ModeToggle } from './mode-toggle'

export function Header() {
  return (
    <header className="bg-background border-b sticky top-0 z-30">
      <div className="flex h-16 items-center px-4 sm:px-6">
        <Link to="/" className="flex items-center">
          <h1 className="text-xl font-bold tracking-tight">Astrm</h1>
        </Link>
        <div className="ml-auto flex items-center space-x-4">
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
