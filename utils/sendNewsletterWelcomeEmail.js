const nodemailer = require("nodemailer");

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
// SEND NEWSLETTER WELCOME EMAIL
// ============================================================

async function sendNewsletterWelcomeEmail(subscriber) {
  const { email, preferenceToken } = subscriber;

  const websiteUrl =
    process.env.CLIENT_URL ||
    "http://localhost:3000";

  const preferenceUrl =
    `${websiteUrl}/api/newsletter/preferences/${preferenceToken}`;

  await transporter.sendMail({
    from: `"Times India Travels" <${process.env.EMAIL_USER}>`,

    to: email,

    subject:
      "Welcome to Times India Travels — Let's Plan Your Next Journey",

    html: `
      <!DOCTYPE html>

      <html>
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>
            Welcome to Times India Travels
          </title>
        </head>

        <body
          style="
            margin: 0;
            padding: 0;
            background-color: #f2fafb;
            font-family: Arial, Helvetica, sans-serif;
            color: #0B3C49;
          "
        >

          <div
            style="
              max-width: 600px;
              margin: 0 auto;
              padding: 40px 20px;
            "
          >

            <div
              style="
                background-color: #124d56;
                padding: 40px 30px;
                border-radius: 18px 18px 0 0;
                text-align: center;
              "
            >

              <p
                style="
                  margin: 0 0 10px;
                  color: #F58634;
                  font-size: 11px;
                  font-weight: bold;
                  letter-spacing: 3px;
                  text-transform: uppercase;
                "
              >
                Times India Travels
              </p>

              <h1
                style="
                  margin: 0;
                  color: #ffffff;
                  font-size: 30px;
                  line-height: 1.2;
                  font-weight: 500;
                "
              >
                Welcome to the Journey
              </h1>

            </div>

            <div
              style="
                background-color: #ffffff;
                padding: 35px 30px;
                border-radius: 0 0 18px 18px;
              "
            >

              <p
                style="
                  font-size: 16px;
                  line-height: 1.7;
                  margin-top: 0;
                "
              >
                Thank you for joining the Times India Travels
                community.
              </p>

              <p
                style="
                  font-size: 15px;
                  line-height: 1.7;
                  color: #124d56;
                "
              >
                We'll share travel inspiration, destination
                ideas and carefully curated journeys with you.
              </p>

              <h2
                style="
                  margin-top: 30px;
                  font-size: 22px;
                  color: #0B3C49;
                "
              >
                What would you love to explore?
              </h2>

              <p
                style="
                  font-size: 14px;
                  line-height: 1.6;
                  color: #124d56;
                "
              >
                Tell us what kind of journeys interest you.
                You can choose as many as you like.
              </p>

              <div
                style="
                  margin-top: 25px;
                  text-align: center;
                "
              >

                <a
                  href="${preferenceUrl}?interest=rajasthan"
                  style="
                    display: inline-block;
                    margin: 5px;
                    padding: 12px 18px;
                    background-color: #124d56;
                    color: #ffffff;
                    text-decoration: none;
                    border-radius: 25px;
                    font-size: 13px;
                  "
                >
                  Rajasthan & Heritage
                </a>

                <a
                  href="${preferenceUrl}?interest=golden-triangle"
                  style="
                    display: inline-block;
                    margin: 5px;
                    padding: 12px 18px;
                    background-color: #124d56;
                    color: #ffffff;
                    text-decoration: none;
                    border-radius: 25px;
                    font-size: 13px;
                  "
                >
                  Golden Triangle
                </a>

                <a
                  href="${preferenceUrl}?interest=wildlife"
                  style="
                    display: inline-block;
                    margin: 5px;
                    padding: 12px 18px;
                    background-color: #124d56;
                    color: #ffffff;
                    text-decoration: none;
                    border-radius: 25px;
                    font-size: 13px;
                  "
                >
                  Wildlife & Nature
                </a>

                <a
                  href="${preferenceUrl}?interest=south-india"
                  style="
                    display: inline-block;
                    margin: 5px;
                    padding: 12px 18px;
                    background-color: #124d56;
                    color: #ffffff;
                    text-decoration: none;
                    border-radius: 25px;
                    font-size: 13px;
                  "
                >
                  South India
                </a>

                <a
                  href="${preferenceUrl}?interest=himalayas"
                  style="
                    display: inline-block;
                    margin: 5px;
                    padding: 12px 18px;
                    background-color: #124d56;
                    color: #ffffff;
                    text-decoration: none;
                    border-radius: 25px;
                    font-size: 13px;
                  "
                >
                  Himalayas
                </a>

                <a
                  href="${preferenceUrl}?interest=luxury"
                  style="
                    display: inline-block;
                    margin: 5px;
                    padding: 12px 18px;
                    background-color: #F58634;
                    color: #ffffff;
                    text-decoration: none;
                    border-radius: 25px;
                    font-size: 13px;
                    font-weight: bold;
                  "
                >
                  Luxury Journeys
                </a>

              </div>

              <p
                style="
                  margin-top: 30px;
                  font-size: 13px;
                  line-height: 1.6;
                  color: #124d56;
                  opacity: 0.65;
                "
              >
                You can select multiple interests by clicking
                more than one option.
              </p>

              <p
                style="
                  margin-top: 30px;
                  font-size: 13px;
                  line-height: 1.6;
                  color: #124d56;
                  opacity: 0.65;
                "
              >
                We look forward to helping you discover
                your next journey.
              </p>

              <p
                style="
                  margin-top: 30px;
                  font-size: 14px;
                  color: #124d56;
                "
              >
                Warm regards,<br />
                <strong>
                  Times India Travels
                </strong>
              </p>

            </div>

          </div>

        </body>
      </html>
    `,
  });
}

module.exports = sendNewsletterWelcomeEmail;