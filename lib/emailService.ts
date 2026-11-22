import nodemailer, { type Transporter } from "nodemailer";

export const DEFAULT_CC_EMAILS = ["admin@scot.lk", "it@scot.lk", "hr@scot.lk"] as const;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let cachedSmtpKey = "";
let cachedTransporter: Transporter | null = null;

export function escapeHtml(value: string | undefined | null): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function isValidEmail(email: string | undefined | null): boolean {
  return Boolean(email && EMAIL_REGEX.test(email.trim()));
}

export function buildCcList(recipientEmail: string): string[] {
  const envCc = process.env.SMTP_CC
    ? process.env.SMTP_CC.split(",").map((s) => s.trim()).filter((s) => isValidEmail(s))
    : [];
  const allCc = Array.from(new Set([...DEFAULT_CC_EMAILS, ...envCc]));
  const target = recipientEmail.trim().toLowerCase();
  return allCc.filter((c) => c.toLowerCase() !== target);
}

function getPooledSmtpTransporter(host: string, port: number, user: string, pass: string): Transporter {
  const key = `${host}:${port}:${user}`;
  if (cachedTransporter && cachedSmtpKey === key) {
    return cachedTransporter;
  }
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    pool: true,
    maxConnections: 3,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    auth: { user, pass },
  });
  cachedSmtpKey = key;
  return cachedTransporter;
}

export type EmailDeliveryResult =
  | { success: true; provider: "resend" | "smtp"; ccList: string[] }
  | { success: false; notConfigured: true; ccList: string[] };

export async function deliverTransactionalEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailDeliveryResult> {
  const cleanTo = to.trim();
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM?.trim() || smtpUser || "AssetFlow <noreply@scot.lk>";
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const ccList = buildCcList(cleanTo);

  // 1. Resend HTTP API (fast, serverless-friendly, bounded 10s timeout)
  if (resendApiKey) {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: smtpFrom.includes("<") ? smtpFrom : `AssetFlow <${smtpFrom}>`,
        to: [cleanTo],
        ...(ccList.length ? { cc: ccList } : {}),
        subject,
        html,
      }),
    });

    if (resendRes.ok) {
      return { success: true, provider: "resend", ccList };
    }
    const errorText = await resendRes.text();
    console.error("Resend API error:", errorText);
  }

  // 2. Pooled SMTP transport (reuses warm connections across requests)
  if (smtpHost && smtpUser && smtpPass) {
    const transporter = getPooledSmtpTransporter(smtpHost, smtpPort, smtpUser, smtpPass);
    await transporter.sendMail({
      from: smtpFrom,
      to: cleanTo,
      ...(ccList.length ? { cc: ccList } : {}),
      subject,
      html,
    });
    return { success: true, provider: "smtp", ccList };
  }

  return { success: false, notConfigured: true, ccList };
}
