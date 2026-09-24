import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

type AssignedAsset = {
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
  assignedDate: string;
  note?: string;
  assets: AssignedAsset[];
};

export async function POST(req: Request) {
  try {
    const body: EmailRequestBody = await req.json();
    const {
      employeeName,
      employeeEmail,
      employeeDepartment = "N/A",
      employeeEmpNo = "",
      assignedDate,
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
    const adminCcEmail = process.env.SMTP_CC || "admin@scot.lk";
    const ccList = adminCcEmail && adminCcEmail.trim().toLowerCase() !== employeeEmail.trim().toLowerCase()
      ? [adminCcEmail.trim()]
      : [];

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
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; background: #e0f2fe; color: #0369a1; font-weight: 500; font-size: 12px;">${asset.condition || "Good"}</span>
          </td>
        </tr>
      `
      )
      .join("");

    const emailSubject = `Asset Allocation Confirmation - ${assets.length} Item${assets.length > 1 ? "s" : ""} Assigned (${assignedDate})`;

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
            <td style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 32px 36px; text-align: left;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">AssetFlow Inventory</h1>
                    <p style="color: #c7d2fe; margin: 6px 0 0; font-size: 14px;">Asset Allocation & Custody Confirmation</p>
                  </td>
                  <td align="right">
                    <span style="background: rgba(255, 255, 255, 0.15); color: #ffffff; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Official Notice</span>
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
                This is an official confirmation from the Asset Management team. The company asset${assets.length > 1 ? "s" : ""} listed below ${assets.length > 1 ? "have" : "has"} been assigned to you on <strong>${assignedDate}</strong>.
              </p>

              <!-- Employee Details Panel -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 28px; padding: 16px;">
                <tr>
                  <td width="33%" style="padding: 6px 12px;">
                    <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600;">Employee Name</span>
                    <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 2px;">${employeeName}</div>
                  </td>
                  <td width="33%" style="padding: 6px 12px;">
                    <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600;">Employee No</span>
                    <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 2px;">${employeeEmpNo || "N/A"}</div>
                  </td>
                  <td width="33%" style="padding: 6px 12px;">
                    <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600;">Department</span>
                    <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 2px;">${employeeDepartment}</div>
                  </td>
                </tr>
              </table>

              <!-- Asset List Heading -->
              <h2 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                Assigned Asset${assets.length > 1 ? "s" : ""} (${assets.length})
              </h2>

              <!-- Asset Table -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
                <thead>
                  <tr style="background-color: #f1f5f9; text-align: left;">
                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase;">Asset Code</th>
                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase;">Item / Model</th>
                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase;">Type</th>
                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase;">Serial / Loc</th>
                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase;">Condition</th>
                  </tr>
                </thead>
                <tbody>
                  ${assetRowsHtml}
                </tbody>
              </table>

              ${
                note
                  ? `
                <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;">
                  <strong style="color: #854d0e; font-size: 13px;">Allocation Note:</strong>
                  <p style="margin: 4px 0 0; color: #713f12; font-size: 13px;">${note}</p>
                </div>
              `
                  : ""
              }

              <!-- Terms / Important Notice -->
              <div style="background-color: #f8fafc; border-left: 4px solid #6366f1; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 28px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #334155;">
                  <strong>Important Notice:</strong> You are responsible for the proper care and custody of the assigned equipment. In case of any damage, malfunction, loss or upon employment clearance, please notify the IT/Asset department immediately.
                </p>
              </div>

              <p style="margin: 0 0 4px; font-size: 14px; color: #1e293b;">Thank you,</p>
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #4338ca;">Asset Management Administration</p>
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
          message: `Confirmation email successfully sent to ${employeeEmail}${ccList.length ? ` (CC: ${ccList.join(", ")})` : ""}`,
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
        message: `Confirmation email successfully sent to ${employeeEmail}${ccList.length ? ` (CC: ${ccList.join(", ")})` : ""}`,
      });
    }

    // 3. Fallback: Neither Resend nor SMTP is configured
    console.warn(
      `[AssetFlow Email Simulation] Email requested for ${employeeEmail} (CC: ${ccList.join(", ")}) with ${assets.length} assets, but neither SMTP nor RESEND_API_KEY is set in environment variables.`
    );

    return NextResponse.json({
      success: false,
      notConfigured: true,
      message: `Assets assigned successfully! Note: To deliver real emails, configure SMTP_HOST, SMTP_USER, SMTP_PASS or RESEND_API_KEY in your Vercel Environment Variables.`,
    });
  } catch (err: unknown) {
    console.error("Error sending assignment confirmation email:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to send confirmation email.",
      },
      { status: 500 }
    );
  }
}
