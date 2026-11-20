const test = require("node:test");
const assert = require("node:assert/strict");
const { parseSearchQuery } = require("../src/services/search-query.service");

const lookups = {
  categories: [
    { CategoryID: 1, Name: "Áo" },
    { CategoryID: 2, Name: "Váy" },
    { CategoryID: 3, Name: "Quần" },
    { CategoryID: 4, Name: "Áo khoác" },
  ],
  sizes: [{ SizeID: 4, Name: "L" }, { SizeID: 5, Name: "XL" }],
  colors: [{ ColorID: 1, Name: "Trắng" }, { ColorID: 8, Name: "Đen" }],
};

test("extracts category and maximum price from Vietnamese query", () => {
  const parsed = parseSearchQuery("quần giá dưới 500k", lookups);
  assert.equal(parsed.categoryId, 3);
  assert.equal(parsed.maxPrice, 500000);
  assert.equal(parsed.minPrice, null);
  assert.equal(parsed.semanticText, "quần");
});

test("extracts range, color and dress category", () => {
  const parsed = parseSearchQuery("váy trắng từ 300k đến 700k", lookups);
  assert.equal(parsed.categoryId, 2);
  assert.equal(parsed.colorId, 1);
  assert.equal(parsed.minPrice, 300000);
  assert.equal(parsed.maxPrice, 700000);
  assert.equal(parsed.semanticText, "váy");
});

test("extracts size and stock requirement", () => {
  const parsed = parseSearchQuery("áo ấm size L còn hàng", lookups);
  assert.equal(parsed.categoryId, null);
  assert.deepEqual(parsed.categoryIds, [1, 4]);
  assert.equal(parsed.sizeId, 4);
  assert.equal(parsed.inStock, true);
  assert.equal(parsed.semanticText, "áo ấm");
});

test("prefers coat over generic shirt category", () => {
  const parsed = parseSearchQuery("áo khoác denim đen", lookups);
  assert.equal(parsed.categoryId, 4);
  assert.equal(parsed.colorId, 8);
});
