import Link from "next/link";

export default function CheckNotFound() {
  return (
    <div className="space-y-4 py-12 text-center">
      <h1 className="text-2xl font-bold">Check not found</h1>
      <p className="text-zinc-700 dark:text-zinc-300">
        This link may be mistyped, or the check may have been removed.
      </p>
      <Link href="/" className="inline-block font-medium text-indigo-700 underline underline-offset-2 dark:text-indigo-300">
        Start a new check
      </Link>
    </div>
  );
}
