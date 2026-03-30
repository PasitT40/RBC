const fs = require("fs");
const path = require("path");

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

function main() {
  const categoriesPage = read("app/pages/categories/index.vue");
  const createProductPage = read("app/pages/products/create.vue");
  const editProductPage = read("app/pages/products/edit-[id].vue");
  const settingsPage = read("app/pages/settings/index.vue");
  const categoriesComposable = read("app/composables/useCategoriesFirestore.ts");

  assertIncludes(categoriesPage, 'name="order"', "category order field");
  assertIncludes(categoriesPage, 'name="category_brand_order"', "category-brand order field");
  assertIncludes(categoriesPage, "global `brands/{brandId}`", "global brand helper copy");
  assertIncludes(categoriesPage, "`category_brands.order`", "category-brand dropdown order helper copy");

  assertIncludes(createProductPage, "`cover_image`", "create cover image helper");
  assertIncludes(createProductPage, "SEO ว่างได้", "create seo fallback helper");

  assertIncludes(editProductPage, "`cover_image`", "edit cover image helper");
  assertIncludes(editProductPage, "SEO ว่างได้", "edit seo fallback helper");

  assertIncludes(settingsPage, "getSiteSettings", "settings read flow");
  assertIncludes(settingsPage, "updateSiteSettings", "settings write flow");

  assertIncludes(categoriesComposable, 'collection($db, "brands")', "global brands collection usage");
  assertIncludes(categoriesComposable, 'collection($db, "category_brands")', "category_brands collection usage");

  console.log("Phase 4 management surface checks passed");
}

main();
