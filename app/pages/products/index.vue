<script setup lang="ts">
import { format } from "date-fns";
import type { DataTableHeader, DataTableSortItem } from "vuetify";

type ProductStatus = "ACTIVE" | "RESERVED" | "SOLD" | "DELETED";

type ProductRow = {
  id: string;
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
const statusUpdatingId = ref<string | null>(null);
const saleDialog = ref(false);
const saleSubmitting = ref(false);
const saleTarget = ref<ProductRow | null>(null);
const undoingSaleId = ref<string | null>(null);
const sortBy = ref<DataTableSortItem[]>([{ key: "updated_at", order: "desc" }]);
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
  ACTIVE: { label: "Active", color: "#67c86a", rank: 0 },
  RESERVED: { label: "Reserved", color: "#5b8def", rank: 1 },
  SOLD: { label: "SOLD", color: "#f39a3d", rank: 2 },
  DELETED: { label: "DELETED", color: "#8c8c8c", rank: 3 },
};

const loadProducts = async () => {
  loading.value = true;
  try {
    const result = await getProducts(50);
    products.value = result.filter(isProductRow);
  } catch (error) {
    console.error("โหลดสินค้าไม่สำเร็จ", error);
    appToast.error("โหลดสินค้าไม่สำเร็จ");
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
  getDisplayStatus(item) === "RESERVED" ? "Set Active" : "Reserve";

const statusMeta = (item: ProductRow) => statusMetaMap[getDisplayStatus(item)];

const statusSortRank = (item: ProductRow) => statusMeta(item).rank;

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
    saleErrors.sold_channel = "กรุณาเลือกช่องทางการขาย";
  }

  return !saleErrors.sold_price && !saleErrors.sold_at && !saleErrors.sold_channel;
};

const headers: DataTableHeader[] = [
  { title: "ID", key: "rowIndex", sortable: false },
  { title: "Image", key: "cover_image", sortable: false },
  { title: "Name", key: "name", sortable: true },
  { title: "Category", key: "category_name", sortable: true },
  { title: "Brands", key: "brand_name", sortable: true },
  { title: "ราคาขาย", key: "sell_price", sortable: true },
  {
    title: "Create At",
    key: "created_at",
    sortable: true,
    sortRaw: (a, b) => getSortableTime(a.created_at) - getSortableTime(b.created_at),
  },
  {
    title: "Update At",
    key: "updated_at",
    sortable: true,
    sortRaw: (a, b) => getSortableTime(a.updated_at ?? a.created_at) - getSortableTime(b.updated_at ?? b.created_at),
  },
  {
    title: "Sold At",
    key: "sold_at",
    sortable: true,
    sortRaw: (a, b) => getSortableTime((a as ProductRow).sold_at) - getSortableTime((b as ProductRow).sold_at),
  },
  {
    title: "Status",
    key: "status",
    sortable: true,
    sortRaw: (a, b) => statusSortRank(a as ProductRow) - statusSortRank(b as ProductRow),
  },
  { title: "Action", key: "actions", sortable: false },
  { title: "Switch", key: "show", sortable: false },
];

const onToggleShow = async (item: ProductRow, nextValue: boolean | null) => {
  const normalizedValue = Boolean(nextValue);
  const previousValue = Boolean(item.show);
  item.show = normalizedValue;

  try {
    await toggleShow(item.id, normalizedValue);
    appToast.success("อัปเดตการแสดงผลสำเร็จ");
  } catch (error) {
    item.show = previousValue;
    console.error("อัปเดตการแสดงผลไม่สำเร็จ", error);
    appToast.error("อัปเดตการแสดงผลไม่สำเร็จ");
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
    appToast.error("ลบสินค้าไม่สำเร็จ");
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
      appToast.success("เปลี่ยนสถานะเป็น Reserved สำเร็จ");
    } else {
      await setActive(item.id);
      appToast.success("เปลี่ยนสถานะเป็น Active สำเร็จ");
    }

    item.updated_at = new Date();
    products.value = [...products.value];
  } catch (error) {
    item.status = previousStatus;
    console.error("อัปเดตสถานะสินค้าไม่สำเร็จ", error);
    appToast.error("อัปเดตสถานะสินค้าไม่สำเร็จ");
  } finally {
    statusUpdatingId.value = null;
  }
};

const onConfirmSale = async () => {
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
    appToast.error("บันทึกการขายไม่สำเร็จ");
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
    appToast.error("ยกเลิกการขายไม่สำเร็จ");
  } finally {
    undoingSaleId.value = null;
  }
};

onMounted(loadProducts);
</script>

<template>
<v-row>
    <v-col cols="12" class="tw:px-4 tw:py-6 md:tw:px-8 md:tw:py-10">
    <div class="tw:mb-8 tw:flex tw:flex-col tw:gap-4 md:tw:flex-row md:tw:items-center md:tw:justify-between">
      <div>
        <h1 class="tw:text-4xl tw:font-black tw:text-black md:tw:text-5xl">Products</h1>
      </div>

      <v-btn
        color="#f5962f"
        rounded="pill"
        size="large"
        class="tw:self-start tw:px-7 tw:font-bold tw:normal-case tw:text-white md:tw:self-auto"
        to="/products/create"
      >
        <v-icon start>mdi-plus</v-icon>
        New
      </v-btn>
    </div>
  </v-col>
  <v-col cols="12">
    <v-card
      rounded="xl"
      elevation="0"
      class="tw:overflow-hidden tw:border tw:border-black/5"
    >
      <v-data-table
       class="pa-5"
        :headers="headers"
        :items="products"
        :loading="loading"
        v-model:sort-by="sortBy"
        item-value="id"
        items-per-page="10"
        hover
      >
        <template #item.rowIndex="{ index }">
          <span class="tw:text-md tw:text-black">{{ index + 1 }}</span>
        </template>

        <template #item.cover_image="{ item }">
          <div class="tw:flex tw:items-center tw:py-1">
            <div
              class="tw:h-16 tw:w-16 tw:overflow-hidden tw:rounded-full tw:bg-gray-200"
            >
              <img
                v-if="item.cover_image"
                :src="item.cover_image"
                :alt="item.name || 'product image'"
                class="tw:h-full tw:w-full tw:object-cover"
              >
            </div>
          </div>
        </template>

        <template #item.name="{ item }">
          <span class="tw:text-md tw:text-black">{{ item.name || "-" }}</span>
        </template>

        <template #item.category_name="{ item }">
          <span class="tw:text-md tw:font-bold tw:text-black">{{ item.category_name || "-" }}</span>
        </template>

        <template #item.brand_name="{ item }">
          <span class="tw:text-md tw:font-bold tw:text-black">{{ item.brand_name || "-" }}</span>
        </template>

        <template #item.sell_price="{ item }">
          <span class="tw:text-md tw:font-semibold tw:text-neutral-500">{{ formatPrice(item.sell_price) }}</span>
        </template>

        <template #item.created_at="{ item }">
          <span class="tw:text-md tw:font-semibold tw:text-black">{{ formatDateTime(item.created_at) }}</span>
        </template>

        <template #item.updated_at="{ item }">
          <span class="tw:text-md tw:font-semibold tw:text-black">{{ formatDateTime(item.updated_at) }}</span>
        </template>

        <template #item.sold_at="{ item }">
          <span class="tw:text-md tw:font-semibold tw:text-black">
            {{ getDisplayStatus(item) === "SOLD" ? formatDateTime(item.sold_at) : "-" }}
          </span>
        </template>

        <template #item.status="{ item }">
          <v-chip
            :color="statusMeta(item).color"
            rounded="pill"
            size="large"
            class="tw:min-w-[94px] tw:justify-center tw:font-medium tw:text-white"
          >
            {{ statusMeta(item).label }}
          </v-chip>
        </template>

        <template #item.actions="{ item }">
          <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            <v-btn
              v-if="canToggleProductStatus(item)"
              rounded="pill"
              variant="outlined"
              color="black"
              size="small"
              class="tw:px-4 tw:font-semibold tw:normal-case"
              :loading="statusUpdatingId === item.id"
              @click="onToggleStatus(item)"
            >
              {{ statusActionLabel(item) }}
            </v-btn>
            <div
              v-else class="tw:min-w-[94px]"
            >
            </div>
            <v-btn
              v-if="canMarkSold(item)"
              rounded="pill"
              color="#f5962f"
              size="small"
              class="tw:px-4 tw:font-semibold tw:normal-case tw:text-white"
              @click="openSaleDialog(item)"
            >
              Mark Sold
            </v-btn>
            <v-btn
              v-else-if="canUndoSold(item)"
              rounded="pill"
              variant="outlined"
              color="#f5962f"
              size="small"
              class="tw:px-4 tw:font-semibold tw:normal-case"
              :loading="undoingSaleId === item.id"
              @click="onUndoSale(item)"
            >
              Undo Sale
            </v-btn>
            <div
              v-else
              class="tw:min-w-[94px]"
            >
            </div>
            <v-btn
              icon
              variant="text"
              color="black"
              :to="item.id ? `/products/edit-${item.id}` : undefined"
              :disabled="!item.id || item.is_deleted"
            >
              <v-icon size="28">mdi-pencil</v-icon>
            </v-btn>
            <v-btn icon variant="text" color="black" :disabled="!canDeleteProduct(item)" @click="onDeleteProduct(item)">
              <v-icon size="28">mdi-delete</v-icon>
            </v-btn>
          </div>
        </template>

        <template #item.show="{ item }">
          <div class="tw:flex tw:items-center tw:gap-2">
            <v-switch
              :model-value="Boolean(item.show)"
              color="primary"
              density="compact"
              hide-details
              inset
              :disabled="item.is_deleted"
              @update:model-value="onToggleShow(item, $event)"
            />
            <span class="tw:text-sm tw:text-neutral-700">{{ item.show ? "on" : "off" }}</span>
          </div>
        </template>

        <template #no-data>
          <div class="tw:px-6 tw:py-14 tw:text-center tw:text-neutral-500">
            ยังไม่มีข้อมูลสินค้า
          </div>
        </template>
      </v-data-table>
    </v-card>
  </v-col>
</v-row>

<v-dialog v-model="saleDialog" max-width="520" persistent>
  <v-card rounded="xl">
    <v-card-title class="tw:pb-1 tw:text-xl tw:font-bold tw:text-black">
      บันทึกการขายสินค้า
    </v-card-title>
    <v-card-text class="tw:flex tw:flex-col tw:gap-4 tw:pt-2">
      <div>
        <div class="tw:text-sm tw:text-neutral-500">สินค้า</div>
        <div class="tw:text-base tw:font-semibold tw:text-black">{{ saleTarget?.name || "-" }}</div>
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
      />

      <v-text-field
        v-model="saleForm.sold_at"
        label="วันที่ขาย"
        type="date"
        variant="outlined"
        density="comfortable"
        hide-details="auto"
        :error-messages="saleErrors.sold_at"
      />

      <v-select
        v-model="saleForm.sold_channel"
        label="ช่องทางการขาย"
        :items="saleChannelOptions"
        variant="outlined"
        density="comfortable"
        hide-details="auto"
        :error-messages="saleErrors.sold_channel"
      />
    </v-card-text>
    <v-card-actions class="tw:justify-end tw:gap-2 tw:px-6 tw:pb-5">
      <v-btn variant="text" color="black" :disabled="saleSubmitting" @click="closeSaleDialog()">
        ยกเลิก
      </v-btn>
      <v-btn
        color="#f5962f"
        variant="flat"
        :loading="saleSubmitting"
        class="tw:font-semibold tw:normal-case tw:text-white"
        @click="onConfirmSale()"
      >
        ยืนยันการขาย
      </v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
</template>
