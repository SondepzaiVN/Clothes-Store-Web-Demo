export const formatCurrency = (value: number) =>
  `${value.toLocaleString("vi-VN")}đ`;

export const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const discountPercent = (originalPrice: number, salePrice: number) =>
  Math.round((1 - salePrice / originalPrice) * 100);
