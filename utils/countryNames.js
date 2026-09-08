const countries = require("i18n-iso-countries");
countries.registerLocale(require("i18n-iso-countries/langs/en.json"));

function codeToName(code) {
  if (!code) return null;
  const name = countries.getName(code.toUpperCase(), "en", { select: "official" });
  return name || code;
}

// True only for codes that are real ISO 3166-1 alpha-2 countries —
// catches "ZZ", "XX", or any other well-formed-but-fake code that a
// plain /^[A-Z]{2}$/ regex would let through.
function isValidCountryCode(code) {
  if (!code || typeof code !== "string") return false;
  return countries.isValid(code.toUpperCase());
}

module.exports = { codeToName, isValidCountryCode };