export default function RootPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl border border-border bg-card p-8 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          Soundfolio
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          Your listening stats, your account
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Create a free account, connect Last.fm, and explore your listening history.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/auth?next=/onboarding"
            className="inline-flex h-11 items-center bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Get started
          </a>
          <a
            href="/auth"
            className="inline-flex h-11 items-center border border-border bg-secondary/30 px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary/50"
          >
            Sign in
          </a>
          <a
            href="/demo?range=ytd"
            className="inline-flex h-11 items-center border border-border bg-secondary/30 px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary/50"
          >
            View demo
          </a>
        </div>
      </div>
    </div>
  );
}
