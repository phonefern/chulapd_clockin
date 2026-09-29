// One-off script: creates a LINE rich menu with two buttons
//   left  -> LIFF home (clock in / clock out)
//   right -> LIFF leave form (?view=leave)
// and sets it as the default menu for all OA friends.
// The image source is scripts/richmenu/richmenu.html (rendered to richmenu.png, 2500x843).
// Usage: node scripts/setup-richmenu.js [path/to/image.png]
const fs = require("fs");

const TOKEN = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;
const imagePath = process.argv[2] ?? `${__dirname}/richmenu/richmenu.png`;

if (!TOKEN || !LIFF_ID) {
  console.error("Missing LINE_MESSAGING_CHANNEL_ACCESS_TOKEN or NEXT_PUBLIC_LIFF_ID in env");
  process.exit(1);
}

const richMenuDef = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: "ChulaPD Attendance menu",
  chatBarText: "ลงเวลาทำงาน",
  areas: [
    {
      bounds: { x: 0, y: 0, width: 1250, height: 843 },
      action: { type: "uri", label: "ลงเวลาทำงาน", uri: `https://liff.line.me/${LIFF_ID}` },
    },
    {
      bounds: { x: 1250, y: 0, width: 1250, height: 843 },
      action: { type: "uri", label: "แจ้งลา", uri: `https://liff.line.me/${LIFF_ID}?view=leave` },
    },
  ],
};

(async () => {
  const createRes = await fetch("https://api.line.me/v2/bot/richmenu", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(richMenuDef),
  });
  const createBody = await createRes.json();
  if (!createRes.ok) {
    console.error("Create rich menu failed:", createRes.status, createBody);
    process.exit(1);
  }
  const richMenuId = createBody.richMenuId;
  console.log("Created rich menu:", richMenuId);

  const imageBuffer = fs.readFileSync(imagePath);
  const uploadRes = await fetch(
    `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
    {
      method: "POST",
      headers: {
        "Content-Type": "image/png",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: imageBuffer,
    }
  );
  if (!uploadRes.ok) {
    const body = await uploadRes.text();
    console.error("Upload image failed:", uploadRes.status, body);
    process.exit(1);
  }
  console.log("Image uploaded.");

  const defaultRes = await fetch(
    `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
    }
  );
  if (!defaultRes.ok) {
    const body = await defaultRes.text();
    console.error("Set default failed:", defaultRes.status, body);
    process.exit(1);
  }
  console.log("Set as default rich menu for all users. richMenuId:", richMenuId);
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
