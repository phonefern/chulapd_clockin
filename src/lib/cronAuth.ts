import { NextRequest } from "next/server";

// Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET`
// when the CRON_SECRET env var is set on the project.
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
}
