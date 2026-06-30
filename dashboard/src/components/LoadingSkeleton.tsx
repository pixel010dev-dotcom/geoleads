'use client';

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-4 p-3">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 skeleton flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 p-3">
          {Array.from({ length: cols }).map((_, c) => {
            const widths = ['w-24', 'w-32', 'w-20', 'w-28', 'w-16'];
            return <div key={c} className={`h-3 skeleton ${widths[c % widths.length]}`} />;
          })}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="app-card p-5 space-y-3">
          <div className="w-10 h-10 skeleton rounded-xl" />
          <div className="h-4 skeleton w-3/4" />
          <div className="h-3 skeleton w-full" />
          <div className="h-3 skeleton w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="app-card p-5 space-y-4">
      <div className="flex gap-4 items-end">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 skeleton rounded-t-lg"
            style={{ height: `${20 + Math.random() * 60}px` }}
          />
        ))}
      </div>
      <div className="flex gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-1 h-3 skeleton" />
        ))}
      </div>
    </div>
  );
}

export function KPISkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="app-card p-4 space-y-2">
          <div className="h-3 skeleton w-20" />
          <div className="h-7 skeleton w-24" />
          <div className="h-3 skeleton w-16" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="h-6 skeleton w-40" />
        <div className="h-4 skeleton w-24" />
      </div>
      <KPISkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartSkeleton />
        </div>
        <div>
          <CardSkeleton count={1} />
        </div>
      </div>
      <TableSkeleton />
    </div>
  );
}
