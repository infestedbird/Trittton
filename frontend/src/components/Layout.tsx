import type { ReactNode } from 'react'

interface LayoutProps {
  sidebar: ReactNode
  children: ReactNode
  showSidebar: boolean
}

export function Layout({ sidebar, children, showSidebar }: LayoutProps) {
  return (
    <div
      className="h-[calc(100vh-56px)]"
      style={{
        display: 'grid',
        gridTemplateColumns: showSidebar ? '240px 1fr' : '1fr',
      }}
    >
      {showSidebar && sidebar}
      <main className="overflow-y-auto px-6 py-5 flex flex-col gap-3">{children}</main>
    </div>
  )
}
