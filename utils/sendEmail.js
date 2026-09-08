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

// Strips CR/LF from a value before it goes into an email header. Modern
// nodemailer already guards against header injection internally, but
// this costs nothing and removes the dependency on that behavior.
const sanitizeHeaderValue = (value) => String(value ?? "").replace(/[\r\n]/g, " ");

// ============================================================
// SEND ADMIN ENQUIRY EMAIL
// ============================================================

async function sendAdminEnquiryEmail(enquiry) {
  const {
    name,
    email,
    phone,
    nationality, // stored as ISO code, e.g. "IN"
    tourPackageName,
    travelDate,
    duration,
    adults,
    children,
    hotelType,
    details,
    leadMetadata,
  } = enquiry;

  const riskLevel = leadMetadata?.riskLevel || "normal";
  const riskReasons = leadMetadata?.riskReasons || [];

  const riskReasonsHtml =
    riskReasons.length > 0
      ? riskReasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")
      : "<li>No risk indicators detected</li>";

  await transporter.sendMail({
    from: `"Times India Travels" <${process.env.EMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `New Tour Enquiry - ${sanitizeHeaderValue(name)}`,
    html: `
      <h2>New Tour Enquiry</h2>

      <h3>Customer Details</h3>

      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
      <p><strong>Nationality:</strong> ${escapeHtml(codeToName(nationality) || "Not specified")}</p>

      <h3>Trip Details</h3>

      <p><strong>Tour Package:</strong> ${escapeHtml(tourPackageName || "Custom Enquiry")}</p>
      <p><strong>Travel Date:</strong> ${escapeHtml(travelDate || "Not specified")}</p>
      <p><strong>Duration:</strong> ${duration ? `${escapeHtml(duration)} days` : "Not specified"}</p>
      <p><strong>Adults:</strong> ${escapeHtml(adults)}</p>
      <p><strong>Children:</strong> ${escapeHtml(children)}</p>
      <p><strong>Hotel:</strong> ${escapeHtml(hotelType || "Not specified")}</p>
      <p><strong>Customer Request:</strong> ${escapeHtml(details || "No additional details")}</p>

      <h3>Lead Information</h3>

      <p><strong>IP Country:</strong> ${escapeHtml(codeToName(leadMetadata?.ipCountry) || "Unknown")}</p>
      <p><strong>IP Region:</strong> ${escapeHtml(leadMetadata?.ipRegion || "Unknown")}</p>
      <p><strong>IP City:</strong> ${escapeHtml(leadMetadata?.ipCity || "Unknown")}</p>
      <p><strong>Phone Country:</strong> ${escapeHtml(codeToName(leadMetadata?.phoneCountry) || "Unknown")}</p>
      <p><strong>Risk Level:</strong> ${escapeHtml(riskLevel)}</p>

      <h3>Risk Reasons</h3>
      <ul>${riskReasonsHtml}</ul>
    `,
  });
}

module.exports = sendAdminEnquiryEmail;