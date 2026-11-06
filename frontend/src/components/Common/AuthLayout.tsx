import { Logo } from "@/components/Common/Logo"

interface AuthLayoutProps {
  children: React.ReactNode
  aside?: React.ReactNode
}

export function AuthLayout({ children, aside }: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div
        className={`bg-muted dark:bg-zinc-900 relative order-2 ${aside ? "flex" : "hidden lg:flex"} lg:order-1 lg:items-center lg:justify-center`}
      >
        {aside ?? <Logo variant="full" className="h-16" asLink={false} />}
      </div>
      <div className="order-1 flex flex-col gap-4 p-6 md:p-10 lg:order-2">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">{children}</div>
        </div>
      </div>
    </div>
  )
}
