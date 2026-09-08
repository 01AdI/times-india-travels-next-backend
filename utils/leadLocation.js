const { parsePhoneNumberFromString } = require("libphonenumber-js");
// getCountryCallingCode was imported but never used — dropped it

const getClientIp = (req) => {
  let ip = req.ip || null;
  if (ip && ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }
  return ip;
};

const getIpLocation = async (ipAddress) => {
  if (!ipAddress || ipAddress === "127.0.0.1" || ipAddress === "::1" || ipAddress === "localhost") {
    return { countryCode: null, region: null, city: null };
  }

  try {
    // Timeout added — this was previously unbounded, meaning a slow or
    // down ipapi.co could stall the entire enquiry submission.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ipAddress)}/json/`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`IP location request failed with status ${response.status}`);
    }

    const data = await response.json();

    return {
      // country_code is ISO 3166-1 alpha-2 — this is the actual fix.
      // Previously this stored data.country_name (a display string
      // that disagrees with other sources for ~10-15 countries).
      countryCode: data.country_code || null,
      region: data.region || null,
      city: data.city || null,
    };
  } catch (error) {
    console.error("Error getting IP location:", error);
    return { countryCode: null, region: null, city: null };
  }
};

const getPhoneCountry = (phone) => {
  if (!phone) return null;

  try {
    let normalizedPhone = String(phone).trim();
  
    if (/^\d+$/.test(normalizedPhone)) {
      normalizedPhone = `+${normalizedPhone}`;
    }

    const phoneNumber = parsePhoneNumberFromString(normalizedPhone);

    if (!phoneNumber || !phoneNumber.isValid()) {
      return null;
    }

    return phoneNumber.country || null;
  } catch (error) {
    console.error("Error detecting phone country:", error);
    return null;
  }
};

const getLeadLocation = async (req, phone = null) => {
  const ipAddress = getClientIp(req);
  const ipLocation = await getIpLocation(ipAddress);
  const phoneCountryCode = getPhoneCountry(phone);

  return {
    ipAddress,
    ipCountryCode: ipLocation.countryCode,
    ipRegion: ipLocation.region,
    ipCity: ipLocation.city,
    phoneCountryCode,
  };
};

module.exports = { getClientIp, getIpLocation, getPhoneCountry, getLeadLocation };