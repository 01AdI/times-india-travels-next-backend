const nodemailer = require("nodemailer");
const { codeToName } = require("./countryNames");

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// ============================================================
// ESCAPE HTML
// ============================================================

const escapeHtml = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// ============================================================
// SANITIZE EMAIL HEADER
// ============================================================

const sanitizeHeaderValue = (value) =>
  String(value ?? "").replace(/[\r\n]/g, " ");

// ============================================================
// SEND ADMIN PAY NOW EMAIL
// ============================================================

async function sendAdminPayNowEmail(enquiry) {
  const {
    _id,
    amount,
    description,
    customer,
    billing,
    status,
    leadMetadata,
  } = enquiry;

  const riskLevel = leadMetadata?.riskLevel || "normal";
  const riskReasons = leadMetadata?.riskReasons || [];

  const riskReasonsHtml =
    riskReasons.length > 0
      ? riskReasons
          .map((reason) => `<li>${escapeHtml(reason)}</li>`)
          .join("")
      : "<li>No risk indicators detected</li>";

  const customerCountry =
    codeToName(customer?.country) || customer?.country || "Unknown";

  const billingCountry =
    codeToName(billing?.country) || billing?.country || "Unknown";

  const ipCountry =
    codeToName(leadMetadata?.ipCountry) ||
    leadMetadata?.ipCountry ||
    "Unknown";

  const phoneCountry =
    codeToName(leadMetadata?.phoneCountry) ||
    leadMetadata?.phoneCountry ||
    "Unknown";

  const submittedAt = enquiry.createdAt
    ? new Date(enquiry.createdAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      })
    : "Unknown";

  await transporter.sendMail({
    from: `"Times India Travels" <${process.env.EMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL,

    subject: `New Pay Now Request - ${sanitizeHeaderValue(
      customer?.name
    )}`,

    html: `
      <h2>New Pay Now Request</h2>

      <h3>Payment Details</h3>

      <p>
        <strong>Request ID:</strong>
        ${escapeHtml(_id)}
      </p>

      <p>
        <strong>Amount:</strong>
        ${escapeHtml(amount)}
      </p>

      <p>
        <strong>Description:</strong>
        ${escapeHtml(description || "Not specified")}
      </p>

      <p>
        <strong>Status:</strong>
        ${escapeHtml(status || "new")}
      </p>

      <p>
        <strong>Submitted At:</strong>
        ${escapeHtml(submittedAt)}
      </p>


      <h3>Customer Details</h3>

      <p>
        <strong>Name:</strong>
        ${escapeHtml(customer?.name)}
      </p>

      <p>
        <strong>Email:</strong>
        ${escapeHtml(customer?.email)}
      </p>

      <p>
        <strong>Telephone:</strong>
        ${escapeHtml(customer?.telephone)}
      </p>

      <p>
        <strong>Address:</strong><br>
        ${escapeHtml(customer?.address)}<br>
        ${escapeHtml(customer?.city)},
        ${escapeHtml(customer?.state)}<br>
        ${escapeHtml(customer?.postalCode)}<br>
        ${escapeHtml(customerCountry)}
      </p>


      <h3>Billing Details</h3>

      <p>
        <strong>Name:</strong>
        ${escapeHtml(billing?.name)}
      </p>

      <p>
        <strong>Telephone:</strong>
        ${escapeHtml(billing?.telephone)}
      </p>

      <p>
        <strong>Address:</strong><br>
        ${escapeHtml(billing?.address)}<br>
        ${escapeHtml(billing?.city)},
        ${escapeHtml(billing?.state)}<br>
        ${escapeHtml(billing?.postalCode)}<br>
        ${escapeHtml(billingCountry)}
      </p>


      <h3>Lead Information</h3>

      <p>
        <strong>IP Address:</strong>
        ${escapeHtml(leadMetadata?.ipAddress || "Unknown")}
      </p>

      <p>
        <strong>IP Country:</strong>
        ${escapeHtml(ipCountry)}
      </p>

      <p>
        <strong>IP Region:</strong>
        ${escapeHtml(leadMetadata?.ipRegion || "Unknown")}
      </p>

      <p>
        <strong>IP City:</strong>
        ${escapeHtml(leadMetadata?.ipCity || "Unknown")}
      </p>

      <p>
        <strong>Phone Country:</strong>
        ${escapeHtml(phoneCountry)}
      </p>

      <p>
        <strong>Source:</strong>
        ${escapeHtml(leadMetadata?.source || "Unknown")}
      </p>

      <p>
        <strong>Source Page:</strong>
        ${escapeHtml(leadMetadata?.sourcePage || "Unknown")}
      </p>


      <h3>Lead Risk Assessment</h3>

      <p>
        <strong>Risk Level:</strong>
        ${escapeHtml(riskLevel)}
      </p>

      <h3>Risk Reasons</h3>

      <ul>
        ${riskReasonsHtml}
      </ul>


      <h3>User Agent</h3>

      <p style="word-break: break-all;">
        ${escapeHtml(
          leadMetadata?.userAgent || "Unknown"
        )}
      </p>
    `,
  });
}

module.exports = sendAdminPayNowEmail;