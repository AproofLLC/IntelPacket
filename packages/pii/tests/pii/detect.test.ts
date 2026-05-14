import { describe, expect, it } from "vitest";
import { detectPII } from "../../src/index.js";

function expectFieldCategory(field: string, category: string, extra?: { value?: string }) {
  const val = extra?.value ?? "x";
  const r = detectPII({ [field]: val });
  expect(r.fields.some((f) => f.field === field && f.category === category)).toBe(true);
}

describe("detectPII — industry-neutral fields", () => {
  const identity: [string, string][] = [
    ["name", "name"],
    ["first_name", "name"],
    ["last_name", "name"],
    ["full_name", "name"],
    ["email", "email"],
    ["phone", "phone"],
    ["address", "address"],
    ["street", "address"],
    ["city", "location"],
    ["state", "location"],
    ["zip", "zip"],
    ["postal_code", "zip"],
  ];

  it.each(identity)("field %s → category %s", (field, cat) => {
    expectFieldCategory(field, cat);
  });

  const gov: [string, string][] = [
    ["ssn", "ssn"],
    ["social_security_number", "ssn"],
    ["national_id", "national_id"],
    ["tax_id", "tax_id"],
    ["driver_license", "driver_license"],
    ["passport_number", "passport"],
  ];

  it.each(gov)("government field %s → %s", (field, cat) => {
    expectFieldCategory(field, cat);
  });

  const finance: [string, string][] = [
    ["account_number", "account"],
    ["routing_number", "routing"],
    ["iban", "iban"],
    ["card_number", "payment_card"],
    ["credit_card", "payment_card"],
    ["debit_card", "payment_card"],
    ["cardholder_name", "name"],
  ];

  it.each(finance)("finance field %s → %s", (field, cat) => {
    expectFieldCategory(field, cat);
  });

  const hr: [string, string][] = [
    ["employee_id", "employee"],
    ["payroll_id", "payroll"],
    ["emergency_contact", "contact"],
  ];

  it.each(hr)("HR field %s → %s", (field, cat) => {
    expectFieldCategory(field, cat);
  });

  const health: [string, string][] = [
    ["mrn", "mrn"],
    ["medical_record_number", "mrn"],
    ["dob", "dob"],
    ["date_of_birth", "dob"],
    ["insurance_id", "insurance"],
    ["member_id", "insurance"],
    ["policy_number", "insurance"],
  ];

  it.each(health)("healthcare-shaped field %s → %s", (field, cat) => {
    expectFieldCategory(field, cat);
  });

  it("patient_id detected by built-in name hint", () => {
    expectFieldCategory("patient_id", "patient_id");
  });

  const edu: [string, string][] = [
    ["student_id", "student"],
    ["guardian_name", "name"],
    ["parent_email", "email"],
  ];

  it.each(edu)("education field %s → %s", (field, cat) => {
    expectFieldCategory(field, cat);
  });

  it("client_name → name", () => {
    expectFieldCategory("client_name", "name");
  });

  it("case_number only when configured sensitive", () => {
    expect(detectPII({ case_number: "LF-1" }).detected).toBe(false);
    const r = detectPII({ case_number: "LF-1" }, { sensitiveFieldNames: { case_number: "legal_ref" } });
    expect(r.detected).toBe(true);
    expect(r.fields.some((f) => f.field === "case_number" && f.category === "legal_ref")).toBe(true);
  });

  it("salary only when configured sensitive", () => {
    expect(detectPII({ salary: "100000" }).detected).toBe(false);
    const r = detectPII({ salary: "100000" }, { sensitiveFieldNames: { salary: "compensation" } });
    expect(r.fields.some((f) => f.field === "salary")).toBe(true);
  });

  it("SSN pattern detection", () => {
    const r = detectPII({ ref: "123-45-6789" });
    expect(r.fields.some((f) => f.detection === "pattern" && f.category === "ssn")).toBe(true);
  });

  it("email pattern detection", () => {
    const r = detectPII({ note: "x@y.co" });
    expect(r.fields.some((f) => f.detection === "pattern" && f.category === "email")).toBe(true);
  });

  it("phone-like pattern detection", () => {
    const r = detectPII({ note: "555-222-3333" });
    expect(r.fields.some((f) => f.category === "phone")).toBe(true);
  });

  it("operational timestamp is not classified as DOB by pattern", () => {
    const r = detectPII({ last_login_at: "1980-01-01T12:00:00Z" });
    const bad = r.fields.filter((f) => f.category === "dob" && f.field === "last_login_at");
    expect(bad.length).toBe(0);
  });

  it("generic id field name does not imply PII without pattern", () => {
    const r = detectPII({ transaction_id: "TX-1001", batch_seq: 42 });
    expect(r.detected).toBe(false);
  });

  it("nested object detection preserves dot paths", () => {
    const r = detectPII({ patient: { ssn: "nope" } });
    expect(r.fields.some((f) => f.path === "patient.ssn")).toBe(true);
  });

  it("array detection uses index segments", () => {
    const r = detectPII({ rows: [{ email: "a@b.co" }] });
    expect(r.fields.some((f) => f.path.startsWith("rows["))).toBe(true);
  });

  it("custom sensitiveFieldNames merges with built-ins", () => {
    const r = detectPII(
      { custom_vendor_uid: "VU-1" },
      { sensitiveFieldNames: { custom_vendor_uid: "external_id" } },
    );
    expect(r.fields.some((f) => f.field === "custom_vendor_uid" && f.category === "external_id")).toBe(true);
  });
});
