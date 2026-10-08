import QRCode from "qrcode";

export function verifyUrl(origin: string, verificationId: string) {
  return `${origin}/verify/${verificationId}`;
}

export function verificationQrSvg(origin: string, verificationId: string): Promise<string> {
  return QRCode.toString(verifyUrl(origin, verificationId), {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#1b2f55", light: "#ffffff" },
  });
}
