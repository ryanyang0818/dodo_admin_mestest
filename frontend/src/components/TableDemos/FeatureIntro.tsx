import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"

import { Badge } from "@/components/ui/badge"

export type FeatureItem = {
  /** 功能中文名稱 */
  name: string
  /** 對應的 @tanstack/react-table API */
  api: string
  /** 補充說明（可省略） */
  note?: string
}

type FeatureIntroProps = {
  title: string
  description: string
  features: FeatureItem[]
}

// Demo 頁頁首：標題、返回索引連結，以及本頁使用的 feature 清單
export function FeatureIntro({
  title,
  description,
  features,
}: FeatureIntroProps) {
  return (
    <div className="mb-6 flex flex-col gap-4">
      <div>
        <Link
          to="/table-demos"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          返回 Table Demos 索引
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="mb-3 text-sm font-medium">本頁使用的 features</p>
        <ul className="flex flex-col gap-2">
          {features.map((f) => (
            <li key={f.api} className="flex flex-wrap items-baseline gap-2">
              <Badge
                variant="outline"
                className="font-mono text-xs font-normal"
              >
                {f.api}
              </Badge>
              <span className="text-sm font-medium">{f.name}</span>
              {f.note && (
                <span className="text-sm text-muted-foreground">
                  — {f.note}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
