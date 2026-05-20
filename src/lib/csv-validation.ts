/**
 * CSV Import Validation
 * 
 * Validates CSV data before importing leads into the system.
 * Checks for required fields, data types, formats, and business rules.
 */

import { sanitizeText } from "./sanitize";

export interface CSVValidationError {
  row: number;
  column: string;
  value: string;
  error: string;
  severity: "error" | "warning";
}

export interface CSVValidationResult {
  valid: boolean;
  errors: CSVValidationError[];
  warnings: CSVValidationError[];
  validRows: number;
  totalRows: number;
  summary: string;
}

export interface LeadCSVRow {
  name: string;
  email: string;
  phone: string;
  budget?: string;
  source?: string;
  notes?: string;
  stage?: string;
  [key: string]: string | undefined;
}

// Required fields for lead import
const REQUIRED_FIELDS = ["name", "email", "phone"];

// Valid lead sources
const VALID_SOURCES = ["widget", "manual", "referral", "facebook", "google", "import"];

// Valid lead stages
const VALID_STAGES = ["new", "contacted", "qualified", "viewing", "negotiation", "won", "lost"];

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (international format)
 */
function isValidPhone(phone: string): boolean {
  // Remove common separators
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
  
  // Check if it's a valid phone number (7-15 digits, optionally starting with +)
  const phoneRegex = /^\+?[0-9]{7,15}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Validate budget (must be a positive number)
 */
function isValidBudget(budget: string): boolean {
  const num = parseFloat(budget.replace(/[,$]/g, ""));
  return !isNaN(num) && num >= 0;
}

/**
 * Normalize phone number
 */
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\.]/g, "");
}

/**
 * Normalize budget
 */
function normalizeBudget(budget: string): number {
  return parseFloat(budget.replace(/[,$]/g, ""));
}

/**
 * Validate a single CSV row
 */
function validateRow(
  row: LeadCSVRow,
  rowIndex: number
): CSVValidationError[] {
  const errors: CSVValidationError[] = [];

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!row[field] || row[field].trim() === "") {
      errors.push({
        row: rowIndex,
        column: field,
        value: row[field] || "",
        error: `Required field '${field}' is missing or empty`,
        severity: "error",
      });
    }
  }

  // Validate name
  if (row.name) {
    const sanitized = sanitizeText(row.name);
    if (sanitized.length < 2) {
      errors.push({
        row: rowIndex,
        column: "name",
        value: row.name,
        error: "Name must be at least 2 characters long",
        severity: "error",
      });
    }
    if (sanitized.length > 100) {
      errors.push({
        row: rowIndex,
        column: "name",
        value: row.name,
        error: "Name is too long (maximum 100 characters)",
        severity: "error",
      });
    }
  }

  // Validate email
  if (row.email) {
    const sanitized = sanitizeText(row.email);
    if (!isValidEmail(sanitized)) {
      errors.push({
        row: rowIndex,
        column: "email",
        value: row.email,
        error: "Invalid email format",
        severity: "error",
      });
    }
  }

  // Validate phone
  if (row.phone) {
    const sanitized = sanitizeText(row.phone);
    if (!isValidPhone(sanitized)) {
      errors.push({
        row: rowIndex,
        column: "phone",
        value: row.phone,
        error: "Invalid phone format (expected: +1234567890 or similar)",
        severity: "warning",
      });
    }
  }

  // Validate budget (optional)
  if (row.budget && row.budget.trim() !== "") {
    if (!isValidBudget(row.budget)) {
      errors.push({
        row: rowIndex,
        column: "budget",
        value: row.budget,
        error: "Invalid budget format (expected: number or currency)",
        severity: "warning",
      });
    } else {
      const budgetNum = normalizeBudget(row.budget);
      if (budgetNum > 100000000) {
        errors.push({
          row: rowIndex,
          column: "budget",
          value: row.budget,
          error: "Budget seems unrealistically high",
          severity: "warning",
        });
      }
    }
  }

  // Validate source (optional)
  if (row.source && row.source.trim() !== "") {
    const sanitized = sanitizeText(row.source.toLowerCase());
    if (!VALID_SOURCES.includes(sanitized)) {
      errors.push({
        row: rowIndex,
        column: "source",
        value: row.source,
        error: `Invalid source. Must be one of: ${VALID_SOURCES.join(", ")}`,
        severity: "warning",
      });
    }
  }

  // Validate stage (optional)
  if (row.stage && row.stage.trim() !== "") {
    const sanitized = sanitizeText(row.stage.toLowerCase());
    if (!VALID_STAGES.includes(sanitized)) {
      errors.push({
        row: rowIndex,
        column: "stage",
        value: row.stage,
        error: `Invalid stage. Must be one of: ${VALID_STAGES.join(", ")}`,
        severity: "warning",
      });
    }
  }

  // Validate notes length (optional)
  if (row.notes && row.notes.length > 1000) {
    errors.push({
      row: rowIndex,
      column: "notes",
      value: row.notes.substring(0, 50) + "...",
      error: "Notes are too long (maximum 1000 characters)",
      severity: "warning",
    });
  }

  return errors;
}

/**
 * Validate entire CSV data
 */
export function validateCSVData(
  data: LeadCSVRow[]
): CSVValidationResult {
  const allErrors: CSVValidationError[] = [];
  let validRows = 0;

  // Check if data is empty
  if (!data || data.length === 0) {
    return {
      valid: false,
      errors: [{
        row: 0,
        column: "file",
        value: "",
        error: "CSV file is empty or could not be parsed",
        severity: "error",
      }],
      warnings: [],
      validRows: 0,
      totalRows: 0,
      summary: "No data to import",
    };
  }

  // Check for required columns (case-insensitive)
  const firstRow = data[0];
  const firstRowKeys = Object.keys(firstRow).map(k => k.toLowerCase().trim());
  const missingColumns = REQUIRED_FIELDS.filter(
    field => !firstRowKeys.includes(field.toLowerCase())
  );

  if (missingColumns.length > 0) {
    return {
      valid: false,
      errors: [{
        row: 0,
        column: "headers",
        value: "",
        error: `Missing required columns: ${missingColumns.join(", ")}`,
        severity: "error",
      }],
      warnings: [],
      validRows: 0,
      totalRows: data.length,
      summary: "CSV file is missing required columns",
    };
  }

  // Validate each row
  data.forEach((row, index) => {
    const rowErrors = validateRow(row, index + 2); // +2 because row 1 is headers
    allErrors.push(...rowErrors);

    // Count as valid if no errors (warnings are ok)
    const hasErrors = rowErrors.some(e => e.severity === "error");
    if (!hasErrors) {
      validRows++;
    }
  });

  // Separate errors and warnings
  const errors = allErrors.filter(e => e.severity === "error");
  const warnings = allErrors.filter(e => e.severity === "warning");

  // Check for duplicate emails within the CSV
  const emailMap = new Map<string, number[]>();
  data.forEach((row, index) => {
    if (row.email) {
      const email = row.email.toLowerCase().trim();
      if (!emailMap.has(email)) {
        emailMap.set(email, []);
      }
      emailMap.get(email)!.push(index + 2);
    }
  });

  // Add warnings for duplicate emails
  emailMap.forEach((rows, email) => {
    if (rows.length > 1) {
      rows.forEach(rowNum => {
        warnings.push({
          row: rowNum,
          column: "email",
          value: email,
          error: `Duplicate email found in rows: ${rows.join(", ")}`,
          severity: "warning",
        });
      });
    }
  });

  // Generate summary
  let summary = "";
  if (errors.length === 0 && warnings.length === 0) {
    summary = `All ${data.length} rows are valid and ready to import`;
  } else if (errors.length === 0) {
    summary = `${validRows} of ${data.length} rows are valid. ${warnings.length} warnings found.`;
  } else {
    summary = `${validRows} of ${data.length} rows are valid. ${errors.length} errors and ${warnings.length} warnings found.`;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    validRows,
    totalRows: data.length,
    summary,
  };
}

/**
 * Sanitize and normalize CSV row data
 */
export function sanitizeCSVRow(row: LeadCSVRow): LeadCSVRow {
  const sanitized: LeadCSVRow = {
    name: sanitizeText(row.name || "").trim(),
    email: sanitizeText(row.email || "").toLowerCase().trim(),
    phone: normalizePhone(sanitizeText(row.phone || "").trim()),
  };

  if (row.budget && row.budget.trim() !== "") {
    sanitized.budget = normalizeBudget(row.budget).toString();
  }

  if (row.source && row.source.trim() !== "") {
    sanitized.source = sanitizeText(row.source.toLowerCase().trim());
  }

  if (row.stage && row.stage.trim() !== "") {
    sanitized.stage = sanitizeText(row.stage.toLowerCase().trim());
  }

  if (row.notes && row.notes.trim() !== "") {
    sanitized.notes = sanitizeText(row.notes.trim()).substring(0, 1000);
  }

  return sanitized;
}

/**
 * Get validation error summary for display
 */
export function getValidationSummary(result: CSVValidationResult): string {
  if (result.valid) {
    return `✅ ${result.summary}`;
  }

  const parts = [];
  if (result.errors.length > 0) {
    parts.push(`❌ ${result.errors.length} error${result.errors.length > 1 ? "s" : ""}`);
  }
  if (result.warnings.length > 0) {
    parts.push(`⚠️ ${result.warnings.length} warning${result.warnings.length > 1 ? "s" : ""}`);
  }

  return `${parts.join(", ")} - ${result.summary}`;
}

// Made with Bob
