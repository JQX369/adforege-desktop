import { cn } from '@/lib/utils'

interface TrustRowProps {
  className?: string
  disclosureId?: string
}

export function TrustRow({
  className,
  disclosureId = 'amazon-disclosure',
}: TrustRowProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 text-body-sm text-muted-foreground md:flex-row md:justify-center',
        '[&>div]:flex [&>div]:items-center [&>div]:gap-2',
        className
      )}
    >
      <div>
        <span aria-hidden className="hidden text-base md:inline">
          ⭐️
        </span>
        <span>Trusted by 8,400+ gifters in the last 90 days</span>
      </div>
      <div>
        <span aria-hidden className="hidden text-base md:inline">
          🔒
        </span>
        <span>No login required</span>
      </div>
      <div>
        <span aria-hidden className="hidden md:inline text-base">
          ℹ️
        </span>
        <span id={disclosureId}>We may earn from qualifying purchases</span>
      </div>
    </div>
  )
}
