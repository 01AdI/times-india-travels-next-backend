const { codeToName } = require("./countryNames");

const normalizeCode = (code) => {
  if (!code || typeof code !== "string") return null;
  return code.trim().toUpperCase();
};

const detectRisk = ({ nationality = null, ipCountryCode = null, phoneCountryCode = null }) => {
  const riskReasons = [];

  const nat = normalizeCode(nationality);
  const ip = normalizeCode(ipCountryCode);
  const phoneC = normalizeCode(phoneCountryCode);

  if (nat && ip && nat !== ip) {
    riskReasons.push(`Nationality ≠ IP country — ${codeToName(nat)} ≠ ${codeToName(ip)}`);
  }
  if (nat && phoneC && nat !== phoneC) {
    riskReasons.push(`Nationality ≠ Phone country — ${codeToName(nat)} ≠ ${codeToName(phoneC)}`);
  }
  if (ip && phoneC && ip !== phoneC) {
    riskReasons.push(`IP country ≠ Phone country — ${codeToName(ip)} ≠ ${codeToName(phoneC)}`);
  }

  let riskLevel = "normal";
  if (riskReasons.length === 1) riskLevel = "suspicious";
  if (riskReasons.length >= 2) riskLevel = "high-risk";

  return { riskLevel, riskReasons };
};

module.exports = { detectRisk };