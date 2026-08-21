export async function pushLineMessage(to: string, text: string): Promise<void> {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LINE push failed (${res.status}): ${body}`);
  }
}

export function liffUrl(): string {
  return `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`;
}
