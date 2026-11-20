function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

const MONEY = "(\\d+(?:[.,]\\d+)?)\\s*(trieu|m|k|nghin|ngan|dong|d)?";

function moneyValue(numberText, unitText) {
  const number = Number(String(numberText).replace(",", "."));
  const unit = normalize(unitText);
  if (!Number.isFinite(number)) return null;
  if (unit === "trieu" || unit === "m") return number * 1_000_000;
  if (["k", "nghin", "ngan"].includes(unit)) return number * 1_000;
  return number;
}

function parsePrice(normalizedQuery) {
  const range = new RegExp(`(?:tu)\\s*${MONEY}\\s*(?:den|toi|-)\\s*${MONEY}`, "i").exec(normalizedQuery);
  if (range) {
    return {
      minPrice: moneyValue(range[1], range[2]),
      maxPrice: moneyValue(range[3], range[4]),
    };
  }

  const maximum = new RegExp(`(?:duoi|toi da|khong qua|nho hon|<=?)\\s*${MONEY}`, "i").exec(normalizedQuery);
  const minimum = new RegExp(`(?:tren|tu|it nhat|lon hon|>=?)\\s*${MONEY}`, "i").exec(normalizedQuery);
  return {
    minPrice: minimum ? moneyValue(minimum[1], minimum[2]) : null,
    maxPrice: maximum ? moneyValue(maximum[1], maximum[2]) : null,
  };
}

function byNormalizedName(rows, wanted) {
  const target = normalize(wanted);
  return rows.find((row) => normalize(row.Name) === target) || null;
}

function parseCategory(query, categories) {
  const aliases = [
    { terms: ["ao khoac", "jacket", "coat"], name: "áo khoác" },
    { terms: ["chan vay", "dam", "vay"], name: "váy" },
    { terms: ["quan"], name: "quần" },
  ];
  for (const alias of aliases) {
    if (alias.terms.some((term) => query.includes(term))) {
      const match = byNormalizedName(categories, alias.name);
      if (match) return { rows: [match], label: match.Name };
    }
  }
  if (/(?:^|\s)ao(?:\s|$)/.test(query)) {
    const shirts = byNormalizedName(categories, "áo");
    const coats = byNormalizedName(categories, "áo khoác");
    const rows = [shirts, coats].filter(Boolean);
    if (rows.length) return { rows, label: "Áo và áo khoác" };
  }
  return null;
}

function semanticTextFrom(query, parsed) {
  const money = "\\d+(?:[.,]\\d+)?\\s*(?:triệu|trieu|m|k|nghìn|nghin|ngàn|ngan|đồng|dong|đ|d)?";
  let value = String(query).toLowerCase();
  value = value
    .replace(new RegExp(`(?:giá|gia)?\\s*(?:từ|tu)\\s*${money}\\s*(?:đến|den|tới|toi|-)\\s*${money}`, "giu"), " ")
    .replace(new RegExp(`(?:giá|gia)?\\s*(?:dưới|duoi|tối đa|toi da|không quá|khong qua|nhỏ hơn|nho hon|<=?)\\s*${money}`, "giu"), " ")
    .replace(new RegExp(`(?:giá|gia)?\\s*(?:trên|tren|từ|tu|ít nhất|it nhat|lớn hơn|lon hon|>=?)\\s*${money}`, "giu"), " ")
    .replace(/(?:size|kích cỡ|kich co|cỡ|co)\s*(?:s\/m|l\/xl|xxl|xl|xs|s|m|l)(?:\b|$)/giu, " ")
    .replace(/(?:còn hàng|con hang|có sẵn|co san|sản phẩm sẵn có|san pham san co)/giu, " ");
  if (parsed.colorName) {
    const escapedColor = parsed.colorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    value = value.replace(new RegExp(escapedColor, "giu"), " ");
  }
  return value.replace(/\s+/g, " ").trim() || parsed.categoryName || String(query).trim();
}

function parseSize(query, sizes) {
  const match = /(?:size|kich co|co)\s*(s\/m|l\/xl|xxl|xl|xs|s|m|l)(?:\b|$)/i.exec(query);
  return match ? byNormalizedName(sizes, match[1]) : null;
}

function parseColor(query, colors) {
  return [...colors]
    .sort((left, right) => normalize(right.Name).length - normalize(left.Name).length)
    .find((color) => query.includes(normalize(color.Name))) || null;
}

function parseSearchQuery(rawQuery, lookups) {
  const query = String(rawQuery || "").trim();
  if (!query) {
    const error = new Error("query không được để trống.");
    error.status = 400;
    throw error;
  }
  if (query.length > 500) {
    const error = new Error("query tối đa 500 ký tự.");
    error.status = 400;
    throw error;
  }

  const normalizedQuery = normalize(query);
  const prices = parsePrice(normalizedQuery);
  const category = parseCategory(normalizedQuery, lookups.categories || []);
  const size = parseSize(normalizedQuery, lookups.sizes || []);
  const color = parseColor(normalizedQuery, lookups.colors || []);
  const inStock = /(con hang|co san|san pham san co)/.test(normalizedQuery);

  const parsed = {
    rawQuery: query,
    semanticText: query,
    categoryId: category?.rows.length === 1 ? Number(category.rows[0].CategoryID) : null,
    categoryIds: category ? category.rows.map((row) => Number(row.CategoryID)) : [],
    categoryName: category?.label || null,
    sizeId: size ? Number(size.SizeID) : null,
    sizeName: size?.Name || null,
    colorId: color ? Number(color.ColorID) : null,
    colorName: color?.Name || null,
    minPrice: prices.minPrice,
    maxPrice: prices.maxPrice,
    inStock,
  };
  parsed.semanticText = semanticTextFrom(query, parsed);
  return parsed;
}

module.exports = { normalize, parseSearchQuery };
