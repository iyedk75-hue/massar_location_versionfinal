export function normalizeClientName(value?: string | null) {
  return (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b[\p{L}\p{N}]/gu, (match) => match.toUpperCase());
}

export function formatPhoneNumber(value?: string | null) {
  const raw = (value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "-";

  if (raw.startsWith("+")) {
    const parsed = splitPhoneNumber(raw);
    return `${parsed.countryCode} ${formatLocalPhoneNumber(parsed.localNumber)}`.trim();
  }

  if (digits.length > 8) {
    const local = digits.slice(-8);
    const country = digits.slice(0, -8);
    return `+${country} ${formatLocalPhoneNumber(local)}`.trim();
  }

  return formatLocalPhoneNumber(digits);
}

export function formatClientIdentity(client?: { cin?: string | null; passportNumber?: string | null } | null) {
  if (!client) return "CIN: -";
  if (client.cin) return `CIN: ${client.cin}`;
  if (client.passportNumber) return `Passeport: ${client.passportNumber}`;
  return "CIN: -";
}

export function splitPhoneNumber(value?: string | null) {
  const raw = (value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  const localNumber = digits.slice(-8);
  const countryDigits = digits.length > 8 ? digits.slice(0, -8) : "216";

  return {
    countryCode: `+${countryDigits || "216"}`,
    localNumber,
  };
}

export function joinPhoneNumber(countryCode: string, localNumber: string) {
  const countryDigits = countryCode.replace(/\D/g, "") || "216";
  const localDigits = localNumber.replace(/\D/g, "");
  return `+${countryDigits}${localDigits}`;
}

export function formatLocalPhoneNumber(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "-";
  if (digits.length === 8) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }

  return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

export function normalizeDrivingLicense(value?: string | null) {
  return (value ?? "").replace(/\s+/g, "").toUpperCase();
}

export function splitDrivingLicense(value?: string | null) {
  const normalized = normalizeDrivingLicense(value);
  const [prefix = "", number = ""] = normalized.includes("/")
    ? normalized.split("/")
    : [normalized.slice(0, 2), normalized.slice(2)];

  return { number, prefix };
}

export function joinDrivingLicense(prefix: string, number: string) {
  const cleanPrefix = prefix.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 2);
  const cleanNumber = number.replace(/\D/g, "").slice(0, 6);
  return cleanPrefix && cleanNumber ? `${cleanPrefix}/${cleanNumber}` : "";
}

export function isValidDrivingLicense(value?: string | null) {
  return /^[A-Z0-9]{2}\/\d{5,6}$/.test(normalizeDrivingLicense(value));
}

export function formatDrivingLicense(value?: string | null) {
  const normalized = normalizeDrivingLicense(value);
  return normalized || "-";
}

export function hasCompleteClientName(value?: string | null) {
  return normalizeClientName(value).split(" ").filter(Boolean).length >= 2;
}
