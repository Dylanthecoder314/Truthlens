// Re-mounts on every navigation, so each page fades in. Opacity only: a transform would break sticky and fixed children.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in flex flex-1 flex-col">{children}</div>;
}
