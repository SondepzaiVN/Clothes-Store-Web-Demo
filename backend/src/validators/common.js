function nullableNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveInteger(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${fieldName} phải là số nguyên dương.`);
    error.status = 400;
    throw error;
  }
  return parsed;
}

function requiredText(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    const error = new Error(`${fieldName} không được để trống.`);
    error.status = 400;
    throw error;
  }
  return value.trim();
}

module.exports = { nullableNumber, positiveInteger, requiredText };
