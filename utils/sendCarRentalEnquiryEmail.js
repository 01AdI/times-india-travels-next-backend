const nodemailer = require("nodemailer");
const { codeToName } = require("./countryNames");

// ============================================================
// EMAIL TRANSPORTER
// ============================================================

const transporter =
  nodemailer.createTransport({
    service:
      process.env.EMAIL_SERVICE,

    auth: {
      user:
        process.env.EMAIL_USER,

      pass:
        process.env.EMAIL_PASSWORD,
    },
  });

// ============================================================
// ESCAPE HTML
// ============================================================

const escapeHtml = (value) => {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
};

// ============================================================
// SANITIZE EMAIL HEADER
// ============================================================

const sanitizeHeaderValue = (
  value
) =>
  String(
    value ?? ""
  ).replace(
    /[\r\n]/g,
    " "
  );

// ============================================================
// FORMAT DATE
// ============================================================

function formatTravelDate(
  travelDate
) {
  if (!travelDate) {
    return "Not specified";
  }

  const date =
    new Date(travelDate);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not specified";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  );
}

// ============================================================
// SEND ADMIN CAR RENTAL ENQUIRY EMAIL
// ============================================================

async function sendCarRentalEnquiryEmail(
  enquiry
) {
  const {
    name,
    email,
    phone,
    nationality,

    tourPackageName,

    travelDate,
    duration,

    adults,
    children,

    vehicle,

    reference,
    details,

    leadMetadata,
  } = enquiry;

  // ==========================================================
  // RISK
  // ==========================================================

  const riskLevel =
    leadMetadata?.riskLevel ||
    "normal";

  const riskReasons =
    leadMetadata?.riskReasons ||
    [];

  const riskReasonsHtml =
    riskReasons.length > 0
      ? riskReasons
          .map(
            (reason) =>
              `<li>${escapeHtml(
                reason
              )}</li>`
          )
          .join("")
      : "<li>No risk indicators detected</li>";

  // ==========================================================
  // COUNTRY NAMES
  //
  // Database stores ISO codes.
  // Email displays full country names.
  // ==========================================================

  const nationalityName =
    codeToName(
      nationality
    ) ||
    "Not specified";

  const ipCountryName =
    codeToName(
      leadMetadata?.ipCountry
    ) ||
    "Unknown";

  const phoneCountryName =
    codeToName(
      leadMetadata?.phoneCountry
    ) ||
    "Unknown";

  // ==========================================================
  // SEND EMAIL
  // ==========================================================

  await transporter.sendMail({
    from:
      `"Times India Travels" <${process.env.EMAIL_USER}>`,

    to:
      process.env.ADMIN_EMAIL,

    subject:
      `New Car Rental Enquiry - ${sanitizeHeaderValue(
        name
      )}`,

    html: `
      <h2>New Car Rental Enquiry</h2>

      <h3>Customer Details</h3>

      <p>
        <strong>Name:</strong>
        ${escapeHtml(name)}
      </p>

      <p>
        <strong>Email:</strong>
        ${escapeHtml(email)}
      </p>

      <p>
        <strong>Phone:</strong>
        ${escapeHtml(phone)}
      </p>

      <p>
        <strong>Nationality:</strong>
        ${escapeHtml(
          nationalityName
        )}
      </p>

      <h3>Rental Details</h3>

      <p>
        <strong>Tour Package:</strong>
        ${escapeHtml(
          tourPackageName ||
            "Not specified"
        )}
      </p>

      <p>
        <strong>Travel Date:</strong>
        ${escapeHtml(
          formatTravelDate(
            travelDate
          )
        )}
      </p>

      <p>
        <strong>Duration:</strong>
        ${
          duration
            ? `${escapeHtml(
                duration
              )} days`
            : "Not specified"
        }
      </p>

      <p>
        <strong>Adults:</strong>
        ${escapeHtml(
          adults ?? 1
        )}
      </p>

      <p>
        <strong>Children:</strong>
        ${escapeHtml(
          children ?? 0
        )}
      </p>

      <p>
        <strong>Vehicle:</strong>
        ${escapeHtml(
          vehicle ||
            "Not specified"
        )}
      </p>

      <h3>Customer Request</h3>

      <p>
        <strong>Reference:</strong>
        ${escapeHtml(
          reference ||
            "Not specified"
        )}
      </p>

      <p>
        <strong>Additional Details:</strong>
        ${escapeHtml(
          details ||
            "No additional details"
        )}
      </p>

      <h3>Lead Information</h3>

      <p>
        <strong>IP Address:</strong>
        ${escapeHtml(
          leadMetadata?.ipAddress ||
            "Unknown"
        )}
      </p>

      <p>
        <strong>IP Country:</strong>
        ${escapeHtml(
          ipCountryName
        )}
      </p>

      <p>
        <strong>IP Region:</strong>
        ${escapeHtml(
          leadMetadata?.ipRegion ||
            "Unknown"
        )}
      </p>

      <p>
        <strong>IP City:</strong>
        ${escapeHtml(
          leadMetadata?.ipCity ||
            "Unknown"
        )}
      </p>

      <p>
        <strong>Phone Country:</strong>
        ${escapeHtml(
          phoneCountryName
        )}
      </p>

      <p>
        <strong>Risk Level:</strong>
        ${escapeHtml(
          riskLevel
        )}
      </p>

      <h3>Risk Reasons</h3>

      <ul>
        ${riskReasonsHtml}
      </ul>
    `,
  });
}

module.exports =sendCarRentalEnquiryEmail;
