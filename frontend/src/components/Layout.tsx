import type { ReactNode } from 'react'

interface LayoutProps {
  sidebar: ReactNode
  children: ReactNode
  showSidebar: boolean
}

export function Layout({ sidebar, children, showSidebar }: LayoutProps) {
  return (
    <div
      className="h-[calc(100vh-64px)]"
      style={{
        display: 'grid',
        gridTemplateColumns: showSidebar ? '240px 1fr' : '1fr',
      }}
    >
      {showSidebar && sidebar}
      <main className="overflow-y-auto px-8 py-6 flex flex-col gap-4">{children}</main>
    </div>
  )
}
