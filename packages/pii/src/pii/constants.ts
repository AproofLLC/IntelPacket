/** Built-in field name hints → category (normalized key lookup). Industry-agnostic defaults; extend via {@link DetectPIIOptions.sensitiveFieldNames}. */
export const SENSITIVE_NAME_CATEGORIES: Readonly<Record<string, string>> = {
  // Identity — general
  name: "name",
  first_name: "name",
  last_name: "name",
  full_name: "name",
  client_name: "name",
  guardian_name: "name",
  cardholder_name: "name",
  email: "email",
  parent_email: "email",
  phone: "phone",
  mobile: "phone",
  address: "address",
  street: "address",
  city: "location",
  state: "location",
  zip: "zip",
  postal_code: "zip",

  // Government identifiers
  ssn: "ssn",
  social_security_number: "ssn",
  socialsecuritynumber: "ssn",
  national_id: "national_id",
  tax_id: "tax_id",
  driver_license: "driver_license",
  drivers_license: "driver_license",
  passport_number: "passport",

  // Finance
  account_number: "account",
  routing_number: "routing",
  iban: "iban",
  card_number: "payment_card",
  credit_card: "payment_card",
  debit_card: "payment_card",

  // HR / workforce
  employee_id: "employee",
  payroll_id: "payroll",
  emergency_contact: "contact",

  // Healthcare (one vertical among many)
  dob: "dob",
  date_of_birth: "dob",
  birth_date: "dob",
  dateofbirth: "dob",
  mrn: "mrn",
  medical_record_number: "mrn",
  patient_name: "name",
  patient_id: "patient_id",
  insurance_id: "insurance",
  member_id: "insurance",
  policy_number: "insurance",
  subscriber_id: "insurance",

  // Education
  student_id: "student",

  // Unstructured blobs often sensitive
  raw_notes: "notes",
};

/** Regexes for value-based detection (avoid classifying operational timestamps as DOB). */
export const VALUE_PATTERNS = {
  ssn: /\b\d{3}-\d{2}-\d{4}\b/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/i,
  /** US-style phone digits */
  phone: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/,
  /** YYYY-MM-DD when field suggests DOB */
  dobIso: /^\d{4}-\d{2}-\d{2}$/,
  /** US bank routing (9 digits, checksum not validated here) */
  routingDigits: /^\d{9}$/,
  /** IBAN — loose; spacing allowed */
  ibanLoose: /^[A-Z]{2}\d{2}[A-Z0-9\s]{10,32}$/i,
  /** Payment card — grouped or continuous 13–19 digits */
  paymentCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b|\b\d{13,19}\b/,
} as const;

export const REDACT_LITERAL = "[REDACTED]" as const;
