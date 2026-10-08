import { signedQuery } from "@/lib/signedUrl";

// Local Windows dev has no Linux Chromium build; use the installed Edge/Chrome instead.
const LOCAL_BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
];

async function launchBrowser() {
  const puppeteer = (await import("puppeteer-core")).default;

  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
      executablePath: await chromium.executablePath(),
      headless: "shell",
    });
  }

  const fs = await import("node:fs");
  const executablePath = process.env.CHROME_EXECUTABLE_PATH ?? LOCAL_BROWSERS.find((p) => fs.existsSync(p));
  if (!executablePath) throw new Error("No local Chrome/Edge found; set CHROME_EXECUTABLE_PATH");
  return puppeteer.launch({ executablePath, headless: true });
}

// Renders the certified sheet (/print/report/{id}) to an A4-landscape PDF.
export async function renderApprovedReportPdf(origin: string, approvalId: string): Promise<Uint8Array> {
  const url = `${origin}/print/report/${approvalId}?${signedQuery("report-print", approvalId, 120)}`;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({ preferCSSPageSize: true, printBackground: true });
  } finally {
    await browser.close();
  }
}
