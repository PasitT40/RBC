import { useCategoriesFirestore } from "./useCategoriesFirestore";
import { useDashboardFirestore } from "./useDashboardFirestore";
import { useOrdersFirestore } from "./useOrdersFirestore";
import { useProductsFirestore } from "./useProductsFirestore";

export function useBackofficeFirestore() {
  const { getCategoriesPage, getSubcategoriesPage, getCategories, getBrandsByCategory } = useCategoriesFirestore();
  const { getProductsPage, getProducts, getProductById, createProduct, updateProduct, deleteProduct, toggleShow, setReserved, setActive } = useProductsFirestore();
  const { getReportPage, confirmSale, undoSale } = useOrdersFirestore();
  const { getDashboardStats, getDashboardBrandStats } = useDashboardFirestore();

  return {
    // Categories & Brands
    getCategoriesPage,
    getSubcategoriesPage,
    getCategories,
    getBrandsByCategory,
    
    // Products
    getProductsPage,
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleShow,
    setReserved,
    setActive,
    
    // Orders & Sales
    getReportPage,
    confirmSale,
    undoSale,
    
    // Dashboard Stats
    getDashboardStats,
    getDashboardBrandStats,
  };
}
