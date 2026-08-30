export function SiteFooter() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

  return (
    <footer className="site-footer">
      <span>pantry pal</span>
      <span>v{version}</span>
    </footer>
  );
}
