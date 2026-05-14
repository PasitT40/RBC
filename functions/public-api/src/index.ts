import type { Firestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { getDbForDatabase } from "./lib/admin.js";
import { createHttpError, methodNotAllowed, notFound, sendJson, sendNoContent } from "./lib/http.js";
import {
  getCategoryBySlugRoute,
  getCategoryBrandsRoute,
  getCategoryBrandProductsRoute,
  listCategoriesRoute,
} from "./routes/categories.js";
import { listBrandsRoute } from "./routes/brands.js";
import { getProductBySlugRoute, listProductsRoute, searchProductsRoute } from "./routes/products.js";
import { getSiteSettingsRoute } from "./routes/settings.js";

const region = process.env.FUNCTION_REGION || "asia-southeast1";

setGlobalOptions({
  region,
  maxInstances: 10,
});

const DATABASE_IDS = {
  dev: "ratchaburi-camera-dev",
  prod: "ratchaburi-camera-prod",
} as const;

type ApiEnvironment = keyof typeof DATABASE_IDS;

const CACHE_HEADERS = {
  search: "public, s-maxage=10, stale-while-revalidate=60",
  siteSettings: "public, s-maxage=60, stale-while-revalidate=300",
  navigation: "public, s-maxage=300, stale-while-revalidate=1800",
  productList: "public, s-maxage=60, stale-while-revalidate=300",
  productDetail: "public, s-maxage=30, stale-while-revalidate=120",
} as const;

const CORS_PREFLIGHT_HEADERS = {
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  Allow: "GET, HEAD, OPTIONS",
};

function normalizePath(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

function matchPath(pathname: string, pattern: RegExp) {
  const matched = pathname.match(pattern);
  return matched ? matched.slice(1).map(decodeURIComponent) : null;
}

function createPublicApiHandler(environment: ApiEnvironment, db: Firestore) {
  const databaseId = DATABASE_IDS[environment];

  return onRequest(async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        return sendNoContent(res, 204, CORS_PREFLIGHT_HEADERS);
      }

      if (req.method !== "GET" && req.method !== "HEAD") throw methodNotAllowed();

      const pathname = normalizePath(new URL(req.url, "https://public-api.local").pathname);

      if (pathname === "/api/health") {
        return sendJson(
          res,
          200,
          {
            item: {
              environment,
              database_id: databaseId,
              function_region: region,
            },
          },
          {
            "Cache-Control": "no-store",
          }
        );
      }

      if (pathname === "/api/search") {
        const payload = await searchProductsRoute(db, req);
        return sendJson(res, 200, payload, {
          "Cache-Control": CACHE_HEADERS.search,
        });
      }

      if (pathname === "/api/brands") {
        const payload = await listBrandsRoute(db);
        return sendJson(res, 200, payload, {
          "Cache-Control": CACHE_HEADERS.navigation,
        });
      }

      if (pathname === "/api/settings/site") {
        const payload = await getSiteSettingsRoute(db);
        return sendJson(res, 200, payload, {
          "Cache-Control": CACHE_HEADERS.siteSettings,
        });
      }

      if (pathname === "/api/products") {
        const payload = await listProductsRoute(db, req);
        return sendJson(res, 200, payload, {
          "Cache-Control": CACHE_HEADERS.productList,
        });
      }

      const productDetailMatch = matchPath(pathname, /^\/api\/products\/([^/]+)$/);
      if (productDetailMatch) {
        const payload = await getProductBySlugRoute(db, productDetailMatch[0]);
        return sendJson(res, 200, payload, {
          "Cache-Control": CACHE_HEADERS.productDetail,
        });
      }

      if (pathname === "/api/categories") {
        const payload = await listCategoriesRoute(db);
        return sendJson(res, 200, payload, {
          "Cache-Control": CACHE_HEADERS.navigation,
        });
      }

      const categoryBrandsMatch = matchPath(pathname, /^\/api\/categories\/([^/]+)\/brands$/);
      if (categoryBrandsMatch) {
        const payload = await getCategoryBrandsRoute(db, categoryBrandsMatch[0]);
        return sendJson(res, 200, payload, {
          "Cache-Control": CACHE_HEADERS.navigation,
        });
      }

      const categoryBrandProductsMatch = matchPath(pathname, /^\/api\/categories\/([^/]+)\/([^/]+)\/products$/);
      if (categoryBrandProductsMatch) {
        const payload = await getCategoryBrandProductsRoute(db, req, categoryBrandProductsMatch[0], categoryBrandProductsMatch[1]);
        return sendJson(res, 200, payload, {
          "Cache-Control": CACHE_HEADERS.productList,
        });
      }

      const categoryDetailMatch = matchPath(pathname, /^\/api\/categories\/([^/]+)$/);
      if (categoryDetailMatch) {
        const payload = await getCategoryBySlugRoute(db, categoryDetailMatch[0]);
        return sendJson(res, 200, payload, {
          "Cache-Control": CACHE_HEADERS.navigation,
        });
      }

      throw notFound("Route not found");
    } catch (error) {
      const httpError = createHttpError(error);
      if (httpError.status >= 500) {
        const safeError = error instanceof Error
          ? { message: error.message, code: (error as { code?: string }).code }
          : { message: String(error) };
        console.error("public-api request failed", {
          environment,
          databaseId,
          method: req.method,
          url: req.url,
          error: safeError,
        });
      }
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
}

const devDb = getDbForDatabase(DATABASE_IDS.dev);
const prodDb = getDbForDatabase(DATABASE_IDS.prod);

export const publicApiDev = createPublicApiHandler("dev", devDb);
export const publicApiProd = createPublicApiHandler("prod", prodDb);

// Keep the existing hosting rewrite stable. The hosted /api/** surface remains production.
export const publicApi = publicApiProd;
