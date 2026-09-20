import { timingSafeEqual } from "node:crypto";
import { runAutomaticBackup } from "@/lib/automatic-backup";

// Always run fresh -- this must never be cached.
export const dynamic = "force-dynamic";
// A full export can take a little while.
export const maxDuration = 60;

/* The nightly backup, called by Vercel Cron (schedule in vercel.json).
   Vercel sends "Authorization: Bearer <CRON_SECRET>" automatically when a
   CRON_SECRET environment variable exists; anything else gets a 401, so
   nobody can trigger it (or read anything) by guessing the URL. This path
   is excluded from the sign-in redirect in proxy.ts because the caller is
   a scheduler, not a person -- the secret is the only gate. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, error: "CRON_SECRET isn't set." }, { status: 500 });

  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await runAutomaticBackup();
  return Response.json(result, { status: result.ok ? 200 : 500 });
}
