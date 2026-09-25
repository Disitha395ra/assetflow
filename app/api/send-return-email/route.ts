import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

type ReturnedAsset = {
  id: string;
  name: string;
  code: string;
  category: string;
  type: string;
  brand?: string;
  model?: string;
  serial?: string;
  location?: string;
  condition?: string;
};

type EmailRequestBody = {
  employeeName: string;
  employeeEmail: string;
  employeeDepartment?: string;
  employeeEmpNo?: string;
  returnDate: string;
  isClearance: boolean;
  note?: string;
  assets: ReturnedAsset[];
};

export async function POST(req: Request) {
  try {
    const body: EmailRequestBody = await req.json();
    const {
      employeeName,
      employeeEmail,
      employeeDepartment = "N/A",
      employeeEmpNo = "",
      returnDate,
      isClearance = false,
      note,
      assets = [],
    } = body;

    if (!employeeEmail || !employeeEmail.includes("@")) {
      return NextResponse.json(
        { success: false, error: "A valid employee email address is required." },
        { status: 400 }
      );
    }

    if (!assets.length) {
      return NextResponse.json(
        { success: false, error: "At least one asset must be specified." },
        { status: 400 }
      );
    }

    // Check for SMTP configuration
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || smtpUser || "AssetFlow <noreply@scot.lk>";
    const resendApiKey = process.env.RESEND_API_KEY;
    const defaultCc = ["admin@scot.lk", "it@scot.lk", "hr@scot.lk"];
    const envCc = process.env.SMTP_CC
      ? process.env.SMTP_CC.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const allCc = Array.from(new Set([...defaultCc, ...envCc]));
    const ccList = allCc.filter(
      (c) => c.toLowerCase() !== employeeEmail.trim().toLowerCase()
    );

    // Asset rows HTML
    const assetRowsHtml = assets
      .map(
        (asset, index) => `
        <tr style="border-bottom: 1px solid #e2e8f0; background: ${index % 2 === 0 ? "#ffffff" : "#f8fafc"};">
          <td style="padding: 12px 14px; font-weight: 600; color: #1e293b; font-size: 14px;">${asset.code}</td>
          <td style="padding: 12px 14px; color: #0f172a; font-size: 14px;">
            <strong>${asset.name}</strong>
            ${asset.brand || asset.model ? `<div style="font-size: 12px; color: #64748b;">${[asset.brand, asset.model].filter(Boolean).join(" · ")}</div>` : ""}
          </td>
          <td style="padding: 12px 14px; color: #334155; font-size: 13px;">${asset.type} (${asset.category})</td>
          <td style="padding: 12px 14px; color: #334155; font-size: 13px;">${asset.serial || asset.location || "N/A"}</td>
          <td style="padding: 12px 14px; color: #334155; font-size: 13px;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; background: #ecfdf5; color: #047857; font-weight: 500; font-size: 12px;">${asset.condition || "Returned"}</span>
          </td>
        </tr>
      `
      )
      .join("");

    const emailSubject = isClearance
      ? `Employee Clearance - Asset Return Confirmation (${assets.length} Item${assets.length > 1 ? "s" : ""})`
      : `Asset Return Confirmation - ${assets.length} Item${assets.length > 1 ? "s" : ""} Returned (${returnDate})`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${emailSubject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: ${isClearance ? "linear-gradient(135deg, #78350f 0%, #b45309 100%)" : "linear-gradient(135deg, #064e3b 0%, #047857 100%)"}; padding: 32px 36px; text-align: left;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">AssetFlow Inventory</h1>
                    <p style="color: #d1fae5; margin: 6px 0 0; font-size: 14px;">
                      ${isClearance ? "Resignation Clearance & Asset Return Confirmation" : "Official Asset Return Receipt"}
                    </p>
                  </td>
                  <td align="right">
                    <span style="background: rgba(255, 255, 255, 0.2); color: #ffffff; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${isClearance ? "Clearance Verified" : "Return Recorded"}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 36px 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #1e293b;">Dear <strong>${employeeName}</strong>,</p>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #475569;">
                This is an official confirmation from the Asset Management team. The company asset${assets.length > 1 ? "s" : ""} listed below ${assets.length > 1 ? "have" : "has"} been safely received and returned to central inventory on <strong>${returnDate}</strong>${isClearance ? " as part of your employee clearance process" : ""}.
              </p>

              <!-- Employee Details Panel -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 28px; padding: 16px;">
                <tr>
                  <td width="25%" style="padding: 6px 12px;">
                    <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600;">Employee Name</span>
                    <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 2px;">${employeeName}</div>
                  </td>
                  <td width="25%" style="padding: 6px 12px;">
                    <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600;">Employee No</span>
                    <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 2px;">${employeeEmpNo || "N/A"}</div>
                  </td>
                  <td width="25%" style="padding: 6px 12px;">
                    <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600;">Department</span>
                    <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 2px;">${employeeDepartment}</div>
                  </td>
                  <td width="25%" style="padding: 6px 12px;">
                    <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600;">Return Status</span>
                    <div style="font-size: 14px; font-weight: 600; color: ${isClearance ? "#b45309" : "#047857"}; margin-top: 2px;">
                      ${isClearance ? "Clearance Return" : "Routine Return"}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Asset List Heading -->
              <h2 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                Returned Asset${assets.length > 1 ? "s" : ""} (${assets.length})
              </h2>

              <!-- Asset Table -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
                <thead>
                  <tr style="background-color: #f1f5f9; text-align: left;">
                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase;">Asset Code</th>
                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase;">Item / Model</th>
                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase;">Type</th>
                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase;">Serial / Loc</th>
                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${assetRowsHtml}
                </tbody>
              </table>

              ${
                note
                  ? `
                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;">
                  <strong style="color: #166534; font-size: 13px;">Return Note / Remarks:</strong>
                  <p style="margin: 4px 0 0; color: #14532d; font-size: 13px;">${note}</p>
                </div>
              `
                  : ""
              }

              <!-- Discharge of Custody Notice -->
              <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 28px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #334155;">
                  <strong>Discharge of Custody:</strong> The items listed above have been verified and accepted back into central inventory. You are officially relieved of custody and responsibility for these items in the company asset register.
                </p>
              </div>

              <p style="margin: 0 0 4px; font-size: 14px; color: #1e293b;">Thank you,</p>
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #047857;">Asset Management Administration</p>
              <p style="margin: 2px 0 0; font-size: 12px; color: #64748b;">AssetFlow Automated Notifications${ccList.length ? ` · CC: ${ccList.join(", ")}` : ""}</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 36px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                This is an automated system confirmation from AssetFlow. Please do not reply directly to this email unless directed.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // 1. Try sending with Resend API if RESEND_API_KEY is present
    if (resendApiKey) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: smtpFrom.includes("<") ? smtpFrom : `AssetFlow <${smtpFrom}>`,
          to: [employeeEmail],
          ...(ccList.length ? { cc: ccList } : {}),
          subject: emailSubject,
          html: emailHtml,
        }),
      });

      if (resendRes.ok) {
        return NextResponse.json({
          success: true,
          provider: "resend",
          message: `Return confirmation email successfully sent to ${employeeEmail}${ccList.length ? ` (CC: ${ccList.join(", ")})` : ""}`,
        });
      } else {
        const errorText = await resendRes.text();
        console.error("Resend API error:", errorText);
      }
    }

    // 2. Try sending with SMTP if configured
    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: smtpFrom,
        to: employeeEmail,
        ...(ccList.length ? { cc: ccList } : {}),
        subject: emailSubject,
        html: emailHtml,
      });

      return NextResponse.json({
        success: true,
        provider: "smtp",
        message: `Return confirmation email successfully sent to ${employeeEmail}${ccList.length ? ` (CC: ${ccList.join(", ")})` : ""}`,
      });
    }

    // 3. Fallback: Neither Resend nor SMTP is configured
    console.warn(
      `[AssetFlow Email Simulation] Return email requested for ${employeeEmail} (CC: ${ccList.join(", ")}) with ${assets.length} assets, but neither SMTP nor RESEND_API_KEY is set in environment variables.`
    );

    return NextResponse.json({
      success: false,
      notConfigured: true,
      message: `Assets returned successfully! Note: To deliver real emails, configure SMTP_HOST, SMTP_USER, SMTP_PASS or RESEND_API_KEY in your Vercel Environment Variables.`,
    });
  } catch (err: unknown) {
    console.error("Error sending return confirmation email:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to send return confirmation email.",
      },
      { status: 500 }
    );
  }
}
