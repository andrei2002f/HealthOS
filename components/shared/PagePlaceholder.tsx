/** Temporary placeholder for routes built in later weeks (see PRD §14). */
export function PagePlaceholder({
  title,
  week,
}: {
  title: string;
  week: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">
        Coming up in {week}.
      </p>
    </div>
  );
}
