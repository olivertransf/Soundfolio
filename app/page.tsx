export default function RootPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl rounded-2xl border border-border/60 bg-card/65 p-8 text-center shadow-2xl ring-1 ring-border/40">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Soundfolio</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Your listening stats, your account
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Create a free account, connect Last.fm, and explore your stats with cleaner visuals and richer charts.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/auth?next=/onboarding"
            className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Get started
          </a>
          <a
            href="/auth"
            className="inline-flex h-10 items-center rounded-lg border border-border/70 bg-secondary/30 px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary/50"
          >
            Sign in
          </a>
          <a
            href="/demo?range=ytd"
            className="inline-flex h-10 items-center rounded-lg border border-border/70 bg-secondary/30 px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary/50"
          >
            View demo
          </a>
        </div>
      </div>
    </div>
  );
}
