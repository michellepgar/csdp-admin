import { NotFoundMessage } from "@/components/not-found-message";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <NotFoundMessage title="Page not found" detail="This link doesn't go anywhere in the tracker. It may be out of date or mistyped." />
    </div>
  );
}
