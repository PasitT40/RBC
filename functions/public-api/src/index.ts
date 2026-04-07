import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { createHttpError, methodNotAllowed, notFound, sendJson } from "./lib/http.js";
import {
  getCategoryBySlugRoute,
  getCategoryBrandsRoute,
  getCategoryBrandProductsRoute,
  listCategoriesRoute,
} from "./routes/categories.js";
import { getProductBySlugRoute, listProductsRoute } from "./routes/products.js";

const region = process.env.FUNCTION_REGION || "asia-southeast1";

setGlobalOptions({
  region,
  maxInstances: 10,
});

function normalizePath(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

function matchPath(pathname: string, pattern: RegExp) {
  const matched = pathname.match(pattern);
  return matched ? matched.slice(1).map(decodeURIComponent) : null;
}

export const publicApi = onRequest(async (req, res) => {
  try {
    if (req.method !== "GET") throw methodNotAllowed();

    const pathname = normalizePath(new URL(req.url, "https://public-api.local").pathname);

    if (pathname === "/api/products") {
      const payload = await listProductsRoute(req);
      return sendJson(res, 200, payload);
    }

    const productDetailMatch = matchPath(pathname, /^\/api\/products\/([^/]+)$/);
    if (productDetailMatch) {
      const payload = await getProductBySlugRoute(productDetailMatch[0]);
      return sendJson(res, 200, payload);
    }

    if (pathname === "/api/categories") {
      const payload = await listCategoriesRoute();
      return sendJson(res, 200, payload, {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
      });
    }

    const categoryBrandsMatch = matchPath(pathname, /^\/api\/categories\/([^/]+)\/brands$/);
    if (categoryBrandsMatch) {
      const payload = await getCategoryBrandsRoute(categoryBrandsMatch[0]);
      return sendJson(res, 200, payload, {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
      });
    }

    const categoryBrandProductsMatch = matchPath(pathname, /^\/api\/categories\/([^/]+)\/([^/]+)\/products$/);
    if (categoryBrandProductsMatch) {
      const payload = await getCategoryBrandProductsRoute(req, categoryBrandProductsMatch[0], categoryBrandProductsMatch[1]);
      return sendJson(res, 200, payload);
    }

    const categoryDetailMatch = matchPath(pathname, /^\/api\/categories\/([^/]+)$/);
    if (categoryDetailMatch) {
      const payload = await getCategoryBySlugRoute(categoryDetailMatch[0]);
      return sendJson(res, 200, payload, {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
      });
    }

    throw notFound("Route not found");
  } catch (error) {
    const httpError = createHttpError(error);
    return sendJson(
      res,
      httpError.status,
      {
        error: {
          code: httpError.code,
          message: httpError.message,
        },
      },
      httpError.headers
    );
  }
});
