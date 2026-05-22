<script setup lang="ts">
import { format } from "date-fns";
import type { DataTableHeader, DataTableSortItem } from "vuetify";

type ProductStatus = "ACTIVE" | "RESERVED" | "SOLD" | "DELETED";

type ProductRow = {
  id: string;
  sku?: string;
  slug?: string;
  name?: string;
  category_name?: string;
  brand_name?: string;
  sell_price?: number;
  sold_price?: number | null;
  sold_at?: unknown;
  sold_channel?: string | null;
  sold_ref?: string | null;
  created_at?: unknown;
  updated_at?: unknown;
  status?: Exclude<ProductStatus, "DELETED">;
  show?: boolean;
  cover_image?: string;
  is_deleted?: boolean;
  last_status_before_sold?: Exclude<ProductStatus, "DELETED"> | null;
};

const isProductRow = (value: Record<string, any>): value is ProductRow =>
  typeof value.id === "string";

const { getProducts, toggleShow, deleteProduct, setReserved, setActive } = useProductsFirestore();
const { confirmSale, undoSale } = useOrdersFirestore();
const appToast = useAppToast();

const loading = ref(false);
const products = ref<ProductRow[]>([]);
const showUpdatingId = ref<string | null>(null);
const statusUpdatingId = ref<string | null>(null);
const saleDialog = ref(false);
const saleSubmitting = ref(false);
const saleTarget = ref<ProductRow | null>(null);
const undoingSaleId = ref<string | null>(null);
const search = ref("");
const sortBy = ref<DataTableSortItem[]>([
  { key: "status", order: "asc" },
  { key: "updated_at", order: "desc" },
]);
const saleForm = reactive({
  sold_price: "",
  sold_at: "",
  sold_channel: "",
});
const saleErrors = reactive({
  sold_price: "",
  sold_at: "",
  sold_channel: "",
});
const saleChannelOptions = [
  { title: "หน้าร้าน", value: "หน้าร้าน" },
  { title: "Facebook", value: "Facebook" },
  { title: "LINE", value: "LINE" },
  { title: "Shopee", value: "Shopee" },
  { title: "Lazada", value: "Lazada" },
  { title: "TikTok Shop", value: "TikTok Shop" },
  { title: "อื่นๆ", value: "อื่นๆ" },
];

const statusMetaMap: Record<ProductStatus, { label: string; color: string; rank: number }> = {
  ACTIVE: { label: "พร้อมขาย", color: "#67c86a", rank: 0 },
  RESERVED: { label: "จอง", color: "#5b8def", rank: 1 },
  SOLD: { label: "ขายแล้ว", color: "#f39a3d", rank: 2 },
  DELETED: { label: "ลบแล้ว", color: "#8c8c8c", rank: 3 },
};

const loadProducts = async () => {
  loading.value = true;
  try {
    const result = await getProducts(50, { includeDeleted: true });
    products.value = result.filter(isProductRow);
  } catch (error) {
    console.error("โหลดสินค้าไม่สำเร็จ", error);
    appToast.error(error, "โหลดสินค้าไม่สำเร็จ");
  } finally {
    loading.value = false;
  }
};

const toDate = (value: unknown) => {
  if (!value) return null;

  const date =
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
      ? (value as { toDate: () => Date }).toDate()
      : new Date(value as string | number | Date);

  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value: unknown) => {
  const date = toDate(value);
  return date ? format(date, "dd/MM/yyyy HH:mm") : "-";
};

const formatPrice = (value?: number) => {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat("th-TH").format(value);
};

const hasSalePriceOverride = (item: ProductRow) =>
  getDisplayStatus(item) === "SOLD"
  && typeof item.sold_price === "number"
  && typeof item.sell_price === "number"
  && item.sold_price !== item.sell_price;

const getSortableTime = (value: unknown) => toDate(value)?.getTime() ?? 0;

const getDisplayStatus = (item: ProductRow): ProductStatus => {
  if (item.is_deleted) return "DELETED";
  return item.status ?? "ACTIVE";
};

const canDeleteProduct = (item: ProductRow) =>
  !item.is_deleted && getDisplayStatus(item) === "ACTIVE";

const canToggleProductStatus = (item: ProductRow) => {
  const status = getDisplayStatus(item);
  return status === "ACTIVE" || status === "RESERVED";
};

const canMarkSold = (item: ProductRow) => {
  const status = getDisplayStatus(item);
  return !item.is_deleted && (status === "ACTIVE" || status === "RESERVED");
};

const canUndoSold = (item: ProductRow) => !item.is_deleted && getDisplayStatus(item) === "SOLD" && Boolean(item.sold_ref);

const statusActionLabel = (item: ProductRow) =>
  getDisplayStatus(item) === "RESERVED" ? "พร้อมขาย" : "จอง";

const statusMeta = (item: ProductRow) => statusMetaMap[getDisplayStatus(item)];

const statusSortRank = (item: ProductRow) => statusMeta(item).rank;

const summaryItems = computed(() => {
  const rows = products.value;
  return [
    { label: "ทั้งหมด", value: rows.length },
    { label: "พร้อมขาย", value: rows.filter((item) => getDisplayStatus(item) === "ACTIVE").length },
    { label: "จอง", value: rows.filter((item) => getDisplayStatus(item) === "RESERVED").length },
    { label: "ขายแล้ว", value: rows.filter((item) => getDisplayStatus(item) === "SOLD").length },
  ];
});

const formatDateInputValue = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const date = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
};

const parseDateInputValue = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const parsed = new Date(year, month - 1, date, 12, 0, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resetSaleForm = () => {
  saleForm.sold_price = "";
  saleForm.sold_at = formatDateInputValue(new Date());
  saleForm.sold_channel = "";
  saleErrors.sold_price = "";
  saleErrors.sold_at = "";
  saleErrors.sold_channel = "";
};

const openSaleDialog = (item: ProductRow) => {
  saleTarget.value = item;
  saleForm.sold_price = typeof item.sell_price === "number" ? String(item.sell_price) : "";
  saleForm.sold_at = formatDateInputValue(new Date());
  saleForm.sold_channel = "";
  saleErrors.sold_price = "";
  saleErrors.sold_at = "";
  saleErrors.sold_channel = "";
  saleDialog.value = true;
};

const closeSaleDialog = () => {
  saleDialog.value = false;
  saleTarget.value = null;
  resetSaleForm();
};

const validateSaleForm = () => {
  saleErrors.sold_price = "";
  saleErrors.sold_at = "";
  saleErrors.sold_channel = "";

  const soldPrice = Number(saleForm.sold_price);
  const soldAt = parseDateInputValue(saleForm.sold_at);
  if (!saleForm.sold_price.trim() || Number.isNaN(soldPrice) || soldPrice < 0) {
    saleErrors.sold_price = "กรุณากรอกราคาขายให้ถูกต้อง";
  }

  if (!soldAt) {
    saleErrors.sold_at = "กรุณาเลือกวันที่ขาย";
  }

  if (!saleForm.sold_channel.trim()) {
    saleErrors.sold_channel = "กรุณาเลือกช่องทางขาย";
  }

  return !saleErrors.sold_price && !saleErrors.sold_at && !saleErrors.sold_channel;
};

const headers: DataTableHeader[] = [
  { title: "SKU", key: "sku", sortable: true, width: 120 },
  { title: "รูป", key: "cover_image", sortable: false, width: 96 },
  { title: "สินค้า", key: "name", sortable: true, width: 320 },
  { title: "ราคา", key: "sell_price", sortable: true, width: 120 },
  {
    title: "อัปเดตล่าสุด",
    key: "updated_at",
    width: 150,
    sortable: true,
    sortRaw: (a, b) => getSortableTime(a.updated_at ?? a.created_at) - getSortableTime(b.updated_at ?? b.created_at),
  },
  {
    title: "วันที่ขาย",
    key: "sold_at",
    width: 150,
    sortable: true,
    sortRaw: (a, b) => getSortableTime((a as ProductRow).sold_at) - getSortableTime((b as ProductRow).sold_at),
  },
  {
    title: "สถานะ",
    key: "status",
    width: 140,
    sortable: true,
    sortRaw: (a, b) => statusSortRank(a as ProductRow) - statusSortRank(b as ProductRow),
  },
  { title: "แสดงหน้าเว็บ", key: "show", sortable: false,width:220 },
  { title: "จัดการ", key: "actions", sortable: false, width: 340, align:'center' as const},
];

const onToggleShow = async (item: ProductRow, nextValue: boolean | null) => {
  const normalizedValue = Boolean(nextValue);
  const previousValue = Boolean(item.show);
  if (previousValue === normalizedValue) return;
  showUpdatingId.value = item.id;

  try {
    await toggleShow(item.id, normalizedValue);
    item.show = normalizedValue;
    products.value = [...products.value];
    appToast.success("อัปเดตการแสดงผลสำเร็จ");
  } catch (error) {
    console.error("อัปเดตการแสดงผลไม่สำเร็จ", error);
    appToast.error(error, "อัปเดตการแสดงผลไม่สำเร็จ");
  } finally {
    showUpdatingId.value = null;
  }
};

const onDeleteProduct = async (item: ProductRow) => {
  try {
    await deleteProduct(item.id);
    item.is_deleted = true;
    item.show = false;
    item.updated_at = new Date();
    products.value = [...products.value];
    appToast.success("ลบสินค้าสำเร็จ");
  } catch (error) {
    console.error("ลบสินค้าไม่สำเร็จ", error);
    appToast.error(error, "ลบสินค้าไม่สำเร็จ");
  }
};

const onToggleStatus = async (item: ProductRow) => {
  const currentStatus = getDisplayStatus(item);
  if (!canToggleProductStatus(item)) return;

  const nextStatus = currentStatus === "ACTIVE" ? "RESERVED" : "ACTIVE";
  const previousStatus = item.status ?? "ACTIVE";
  statusUpdatingId.value = item.id;
  item.status = nextStatus;

  try {
    if (nextStatus === "RESERVED") {
      await setReserved(item.id);
      appToast.success("อัปเดตเป็นจองแล้ว");
    } else {
      await setActive(item.id);
      appToast.success("อัปเดตเป็นพร้อมขายแล้ว");
    }

    item.updated_at = new Date();
    products.value = [...products.value];
  } catch (error) {
    item.status = previousStatus;
    console.error("อัปเดตสถานะสินค้าไม่สำเร็จ", error);
    appToast.error(error, "อัปเดตสถานะสินค้าไม่สำเร็จ");
  } finally {
    statusUpdatingId.value = null;
  }
};

const onConfirmSale = async () => {
  if (saleSubmitting.value) return;
  if (!saleTarget.value || !validateSaleForm()) return;

  const item = saleTarget.value;
  const previousStatus = item.status ?? "ACTIVE";
  const soldAt = parseDateInputValue(saleForm.sold_at);
  if (!soldAt) return;
  saleSubmitting.value = true;

  try {
    const result = await confirmSale({
      productId: item.id,
      sold_price: Number(saleForm.sold_price),
      sold_at: soldAt,
      sold_channel: saleForm.sold_channel.trim(),
    });

    item.last_status_before_sold = previousStatus;
    item.status = "SOLD";
    item.sold_ref = result.orderId;
    item.sold_price = Number(saleForm.sold_price);
    item.sold_at = soldAt;
    item.sold_channel = saleForm.sold_channel.trim();
    item.updated_at = new Date();
    products.value = [...products.value];
    appToast.success("บันทึกการขายสำเร็จ");
    closeSaleDialog();
  } catch (error) {
    console.error("บันทึกการขายไม่สำเร็จ", error);
    appToast.error(error, "บันทึกการขายไม่สำเร็จ");
  } finally {
    saleSubmitting.value = false;
  }
};

const onUndoSale = async (item: ProductRow) => {
  if (!item.sold_ref || !canUndoSold(item)) return;

  const restoreStatus = item.last_status_before_sold ?? "ACTIVE";
  undoingSaleId.value = item.id;

  try {
    await undoSale(item.sold_ref);
    item.status = restoreStatus;
    item.sold_ref = null;
    item.sold_price = null;
    item.sold_channel = null;
    item.last_status_before_sold = null;
    item.updated_at = new Date();
    products.value = [...products.value];
    appToast.success("ยกเลิกการขายสำเร็จ");
  } catch (error) {
    console.error("ยกเลิกการขายไม่สำเร็จ", error);
    appToast.error(error, "ยกเลิกการขายไม่สำเร็จ");
  } finally {
    undoingSaleId.value = null;
  }
};

const statusFilter = ref<string>('ALL')

const filteredProducts = computed(() => {
  if (statusFilter.value === 'ALL') return products.value
  return products.value.filter(p => getDisplayStatus(p) === statusFilter.value)
})

const filterKey = (label: string) => {
  const map: Record<string, string> = { 'ทั้งหมด': 'ALL', 'พร้อมขาย': 'ACTIVE', 'จอง': 'RESERVED', 'ขายแล้ว': 'SOLD' }
  return map[label] ?? 'ALL'
}

const statusBadgeClass = (item: ProductRow) => {
  const status = getDisplayStatus(item)
  return {
    'rbc-badge--green': status === 'ACTIVE',
    'rbc-badge--blue': status === 'RESERVED',
    'rbc-badge--orange': status === 'SOLD',
    'rbc-badge--gray': status === 'DELETED',
  }
}

onMounted(loadProducts);
</script>

<template>
  <div>
    <Teleport to="#rbc-topbar-subtitle">
      <span>{{ products.length }} รายการ</span>
    </Teleport>
    <Teleport to="#rbc-topbar-actions">
      <v-btn class="rbc-btn-primary" to="/products/create" prepend-icon="mdi-plus">
        เพิ่มสินค้า
      </v-btn>
    </Teleport>

    <div class="tw:px-5 tw:pt-5 tw:pb-6 tw:flex tw:flex-col tw:gap-4">

      <!-- Filter + search row -->
      <div class="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3">
        <div class="tw:flex tw:flex-wrap tw:gap-2">
          <button
            v-for="item in summaryItems"
            :key="item.label"
            :class="['rbc-filter-chip', statusFilter === filterKey(item.label) ? 'rbc-filter-chip--active' : '']"
            @click="statusFilter = filterKey(item.label)"
          >
            {{ item.label }}
            <span class="tw:ml-1 tw:text-xs tw:opacity-70">({{ item.value }})</span>
          </button>
        </div>
        <v-text-field
          v-model="search"
          variant="outlined"
          density="compact"
          prepend-inner-icon="mdi-magnify"
          placeholder="ค้นหาสินค้า / หมวดหมู่ / แบรนด์..."
          hide-details
          clearable
          class="rbc-search"
          style="max-width: 320px;"
        />
      </div>

      <!-- Table -->
      <div class="rbc-table-wrap">
        <v-data-table
          class="product-list-table"
          :headers="headers"
          :items="filteredProducts"
          :loading="loading"
          :search="search"
          v-model:sort-by="sortBy"
          item-value="id"
          items-per-page="10"
          density="comfortable"
          no-data-text="ไม่พบข้อมูลสินค้า"
          hover
        >
          <template #item.cover_image="{ item }">
            <div class="tw:py-1">
              <v-img
                v-if="item.cover_image"
                :src="item.cover_image"
                width="52" height="52"
                contain
                class="rbc-table-thumb"
              />
              <div v-else class="rbc-table-thumb--empty">
                <v-icon size="20" color="grey-lighten-1">mdi-image-off</v-icon>
              </div>
            </div>
          </template>
        <template #item.name="{ item }">
          <div>
            <div class="tw:text-[15px] tw:font-semibold tw:text-slate-900">{{ item.name || "-" }}</div>
            <div class="tw:text-[12px] tw:font-semibold tw:text-slate-600">SKU: {{ item.sku || "-" }}</div>
            <div class="tw:text-[12px] tw:text-slate-400">{{ item.slug || "-" }}</div>
            <div class="tw:text-[12px] tw:text-slate-600">
              {{ item.category_name || "-" }} / {{ item.brand_name || "-" }}
            </div>
          </div>
        </template>

        <template #item.updated_at="{ item }">
          <span class="tw:whitespace-nowrap tw:text-sm tw:text-slate-600">{{ formatDateTime(item.updated_at) }}</span>
        </template>

        <template #item.sell_price="{ item }">
          <div class="tw:flex tw:flex-col tw:items-start tw:gap-0.5">
            <span
              v-if="hasSalePriceOverride(item)"
              class="tw:text-xs tw:text-slate-400 tw:line-through"
            >
              {{ formatPrice(item.sell_price) }}
            </span>
            <span class="tw:text-sm tw:font-semibold tw:text-slate-700">
              {{ formatPrice(hasSalePriceOverride(item) ? Number(item.sold_price) : item.sell_price) }}
            </span>
            <span
              v-if="hasSalePriceOverride(item)"
              class="tw:text-[11px] tw:font-medium tw:text-emerald-600"
            >
              ขายจริง
            </span>
          </div>
        </template>

        <template #item.sold_at="{ item }">
          <span class="tw:whitespace-nowrap tw:text-sm tw:text-slate-600">
            {{ getDisplayStatus(item) === "SOLD" ? formatDateTime(item.sold_at) : "-" }}
          </span>
        </template>

        <template #item.status="{ item }">
          <v-row no-gutters>
          <v-col cols="12">
            <span :class="statusBadgeClass(item)">{{ statusMeta(item).label }}</span>
          </v-col>
          <v-col cols="12"
            v-if="getDisplayStatus(item) === 'SOLD'"
            class="tw:mt-1 tw:text-[12px] tw:text-slate-500"
          >
            {{ formatDateTime(item.sold_at) }}
          </v-col>
          </v-row>

        </template>

        <template #item.actions="{ item }">
          <v-row no-gutters align="center" class="tw:min-w-[320px]">
            <v-col cols="9">
              <div class="tw:flex tw:items-center tw:justify-center tw:gap-2">
              <v-btn
                v-if="canToggleProductStatus(item)"
                rounded="pill"
                variant="outlined"
                color="black"
                size="small"
              class="tw:min-w-[88px] tw:font-semibold tw:normal-case"
                :loading="statusUpdatingId === item.id"
                @click="onToggleStatus(item)"
              >
                {{ statusActionLabel(item) }}
              </v-btn>
              <v-btn
                v-if="canMarkSold(item)"
                rounded="pill"
                color="#f5962f"
                size="small"
                class="tw:min-w-[96px] tw:font-semibold tw:normal-case tw:text-white"
                @click="openSaleDialog(item)"
              >
                บันทึกการขาย
              </v-btn>
              <v-btn
                v-else-if="canUndoSold(item)"
                rounded="pill"
                variant="outlined"
                color="#f5962f"
                size="small"
                class="tw:min-w-[88px] tw:font-semibold tw:normal-case"
                :loading="undoingSaleId === item.id"
                @click="onUndoSale(item)"
              >
                ยกเลิกการขาย
              </v-btn>
              </div>
            </v-col>
            
            <v-col cols="3" class="tw:flex tw:justify-end">
              <div class="rbc-table-actions">
                <v-btn
                  icon
                  variant="text"
                  size="small"
                  color="primary"
                  :to="item.id ? `/products/edit-${item.id}` : undefined"
                  :disabled="!item.id || item.is_deleted"
                >
                  <v-icon size="16">mdi-pencil</v-icon>
                </v-btn>
                <v-btn
                  icon
                  variant="text"
                  size="small"
                  color="error"
                  :disabled="!canDeleteProduct(item)"
                  @click="onDeleteProduct(item)"
                >
                  <v-icon size="16">mdi-delete</v-icon>
                </v-btn>
              </div>
            </v-col>
          </v-row>
        </template>

        <template #item.show="{ item }">
          <div class="tw:flex tw:items-center tw:gap-2">
            <form-vee-switch
              :model-value="Boolean(item.show)"
              color="primary"
              density="compact"
              :loading="showUpdatingId === item.id"
              hide-details
              inset
              :disabled="item.is_deleted || showUpdatingId === item.id"
              @update:model-value="onToggleShow(item, $event)"
            />
            <span :class="['tw:text-xs tw:font-semibold', item.show ? 'tw:text-emerald-600' : 'tw:text-slate-400']">
              {{ item.show ? "แสดง" : "ซ่อน" }}
            </span>
          </div>
        </template>

        <template #no-data>
          <div class="tw:py-8 tw:text-center tw:text-sm tw:text-slate-400">ยังไม่มีข้อมูลสินค้า</div>
        </template>
        </v-data-table>
      </div>
    </div>

  <v-dialog v-model="saleDialog" max-width="480" persistent>
    <div class="rbc-modal">
      <!-- Header -->
      <div class="rbc-modal__header">
        <div class="rbc-modal__header-left">
          <div class="rbc-modal__icon">
            <v-icon icon="mdi-receipt-text-plus-outline" size="18" color="white" />
          </div>
          <span class="rbc-modal__title">บันทึกการขาย</span>
        </div>
        <button class="rbc-modal__close" :disabled="saleSubmitting" @click="closeSaleDialog()">
          <v-icon size="20">mdi-close</v-icon>
        </button>
      </div>

      <!-- Body -->
      <div class="rbc-modal__body tw:flex tw:flex-col tw:gap-4">
        <!-- Product preview card -->
        <div class="tw:flex tw:items-center tw:gap-3 tw:rounded-xl tw:bg-slate-50 tw:p-3">
          <v-img
            v-if="saleTarget?.cover_image"
            :src="saleTarget.cover_image"
            width="64" height="64"
            cover
            rounded="lg"
            class="tw:shrink-0"
          />
          <div v-else class="tw:flex tw:h-16 tw:w-16 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:bg-slate-200">
            <v-icon size="28" color="grey-lighten-1">mdi-image-off</v-icon>
          </div>
          <div class="tw:min-w-0">
            <div class="tw:truncate tw:font-semibold tw:text-slate-900">{{ saleTarget?.name || '-' }}</div>
            <div class="tw:text-xs tw:text-slate-500">SKU: {{ saleTarget?.sku || '-' }}</div>
            <div class="tw:mt-1 tw:text-xs tw:font-bold tw:text-orange-500">ราคาตั้ง {{ formatPrice(saleTarget?.sell_price) }} ฿</div>
          </div>
        </div>

        <v-text-field
          v-model="saleForm.sold_price"
          label="ราคาขาย"
          type="number"
          min="0"
          variant="outlined"
          density="comfortable"
          hide-details="auto"
          :error-messages="saleErrors.sold_price"
          prepend-inner-icon="mdi-currency-thb"
        />

        <v-text-field
          v-model="saleForm.sold_at"
          label="วันที่ขาย"
          type="date"
          variant="outlined"
          density="comfortable"
          hide-details="auto"
          :error-messages="saleErrors.sold_at"
          prepend-inner-icon="mdi-calendar-outline"
        />

        <div>
          <div class="rbc-section-label mb-2">ช่องทางขาย *</div>
          <div class="tw:flex tw:flex-wrap tw:gap-2">
            <button
              v-for="ch in saleChannelOptions"
              :key="ch.value"
              :class="['rbc-filter-chip', saleForm.sold_channel === ch.value ? 'rbc-filter-chip--active' : '']"
              @click="saleForm.sold_channel = ch.value; saleErrors.sold_channel = ''"
            >
              {{ ch.title }}
            </button>
          </div>
          <div v-if="saleErrors.sold_channel" class="tw:mt-1 tw:text-xs tw:text-red-500">{{ saleErrors.sold_channel }}</div>
        </div>
      </div>

      <!-- Footer -->
      <div class="rbc-modal__footer">
        <v-btn variant="outlined" color="grey-darken-1" rounded="lg" :disabled="saleSubmitting" @click="closeSaleDialog()">
          ยกเลิก
        </v-btn>
        <v-btn
          class="rbc-btn-primary"
          :loading="saleSubmitting"
          @click="onConfirmSale()"
        >
          <v-icon start size="16">mdi-check</v-icon>
          บันทึกการขาย
        </v-btn>
      </div>
    </div>
  </v-dialog>
  </div>
</template>

<style scoped>
.product-list-table :deep(.v-data-table__td),
.product-list-table :deep(.v-data-table__th) {
  padding: 8px 10px !important;
}

.product-list-table :deep(.v-data-table__tr) {
  height: 64px;
}
</style>
