# Backoffice System Flows

เอกสารนี้สรุปการทำงานของระบบหลังบ้านแบบแยกตามหน้า พร้อม sequence diagram สำหรับใช้เป็น reference ของทีม

## โครงสร้างระบบ

องค์ประกอบหลักของระบบ:

- `Nuxt Backoffice UI`
- `Firestore`
- `Firebase Storage`
- `stats_ledger`
- `dashboard_stats`
- `dashboard_brand_stats`

กติกาหลัก:

- แบรนด์อยู่ใน global collection `brands/{brandId}`
- ความสัมพันธ์ Category -> Brand ใช้ `category_brands` เท่านั้น
- สถานะสินค้าที่ persist จริงมีแค่ `ACTIVE | RESERVED | SOLD`
- `DELETED` เป็น derived state จาก `is_deleted=true`
- `show=true` คือเปิดแสดงบนหน้าเว็บ
- `confirmSale` และ `undoSale` ต้องทำผ่าน transaction
- `stats_ledger` ใช้สำหรับ idempotency
- dashboard docs เป็น cached aggregates และต้องอัปเดตตอน write

## 1. Login Page

หน้าที่:

- ให้ผู้ใช้เข้าสู่ระบบด้วย Google
- ตรวจสิทธิ์เข้าใช้งานหลังบ้าน

```mermaid
sequenceDiagram
    actor User
    participant UI as Login Page
    participant Auth as Firebase Auth
    participant Owners as owners/{uid}

    User->>UI: กดเข้าสู่ระบบด้วย Google
    UI->>Auth: signInWithGoogle()
    Auth-->>UI: auth result
    UI->>Owners: check allowlist by uid
    alt uid ได้รับสิทธิ์
        UI-->>User: เข้า backoffice ได้
    else uid ไม่มีสิทธิ์
        UI-->>User: แสดงข้อความปฏิเสธสิทธิ์
    end
```

## 2. Dashboard Page

หน้าที่:

- แสดงภาพรวมสินค้า
- แสดงยอดขาย ต้นทุน กำไร
- แสดงยอดขายแยกตามแบรนด์

แหล่งข้อมูล:

- `dashboard_stats/global`
- `dashboard_brand_stats/*`

```mermaid
sequenceDiagram
    actor User
    participant UI as Dashboard Page
    participant Dash as Dashboard Logic
    participant FS as Firestore

    User->>UI: เปิดหน้า Dashboard
    UI->>Dash: loadDashboard()
    Dash->>FS: read dashboard_stats/global
    Dash->>FS: read dashboard_brand_stats/*
    FS-->>Dash: aggregate docs
    Dash-->>UI: render summary cards + chart
```

## 3. Categories Page

หน้าที่:

- เพิ่ม/แก้ไขหมวดหมู่
- เพิ่ม/แก้ไขแบรนด์
- จัดการลำดับหมวดหมู่
- จัดการลำดับแบรนด์
- จัดการ mapping `category_brands`

### 3.1 Create / Edit Category

```mermaid
sequenceDiagram
    actor User
    participant UI as Categories Page
    participant C as Categories Logic
    participant ST as Storage
    participant FS as Firestore

    User->>UI: กรอกข้อมูลหมวดหมู่ + เลือกรูป
    UI->>C: createCategory/updateCategory
    alt มีรูปใหม่
        C->>ST: upload image
        ST-->>C: image_url
    end
    C->>FS: write categories/{categoryId}
    alt เป็นการแก้ไขและมีรูปใหม่
        C->>ST: delete old image
    end
    C-->>UI: success
```

### 3.2 Create / Edit Brand

```mermaid
sequenceDiagram
    actor User
    participant UI as Categories Page
    participant C as Categories Logic
    participant ST as Storage
    participant FS as Firestore

    User->>UI: กรอกข้อมูลแบรนด์ + เลือกหมวดหมู่ + ตั้งลำดับในหมวดหมู่
    UI->>C: createSubcategory/updateSubcategory
    alt มีรูปใหม่
        C->>ST: upload image
        ST-->>C: image_url
    end
    C->>FS: write brands/{brandId}
    C->>FS: write category_brands/{categoryId__brandId}
    alt เป็นการแก้ไขและมีรูปใหม่
        C->>ST: delete old image
    end
    C-->>UI: success
```

### 3.3 Toggle Active

```mermaid
sequenceDiagram
    actor User
    participant UI as Categories Page
    participant C as Categories Logic
    participant FS as Firestore

    User->>UI: เปิด/ปิด สถานะหมวดหมู่หรือแบรนด์
    UI->>C: updateCategory/updateSubcategory
    C->>FS: update is_active
    FS-->>C: success
    C-->>UI: refresh state
```

## 4. Products List Page

หน้าที่:

- ดูรายการสินค้า
- ค้นหา/กรองสินค้า
- เปิด/ซ่อนสินค้า
- เปลี่ยนสถานะ `ACTIVE <-> RESERVED`
- บันทึกขาย
- ยกเลิกขาย
- เข้าไปแก้ไขสินค้า

### 4.1 Load Products Page

```mermaid
sequenceDiagram
    actor User
    participant UI as Products List
    participant P as Products Logic
    participant FS as Firestore

    User->>UI: เปิดหน้า Products
    UI->>P: getProductsPage()
    P->>FS: query products
    FS-->>P: product docs
    P-->>UI: render table + counters
```

### 4.2 Toggle Show

```mermaid
sequenceDiagram
    actor User
    participant UI as Products List
    participant P as Products Logic
    participant FS as Firestore
    participant DB as dashboard_stats

    User->>UI: กดเปิดแสดงสินค้า
    UI->>P: toggleShow(productId, true)
    P->>P: validate publish readiness
    P->>FS: batch update product.show = true
    P->>DB: update visible counters
    P-->>UI: success
```

### 4.3 Set Reserved / Set Active

```mermaid
sequenceDiagram
    actor User
    participant UI as Products List
    participant P as Products Logic
    participant FS as Firestore
    participant DB as dashboard_stats

    User->>UI: เปลี่ยนสถานะสินค้า
    UI->>P: setReserved() หรือ setActive()
    P->>P: check valid transition
    P->>FS: batch update product.status
    P->>DB: update cached counters
    P-->>UI: success
```

### 4.4 Confirm Sale

```mermaid
sequenceDiagram
    actor User
    participant UI as Products List
    participant O as Orders Logic
    participant FS as Firestore
    participant Ledger as stats_ledger
    participant DB as dashboard_stats/dashboard_brand_stats

    User->>UI: กรอกข้อมูลขายแล้วกดบันทึก
    UI->>O: confirmSale(productId, saleData)
    O->>FS: start transaction
    O->>FS: read product
    O->>Ledger: check SALE_APPLIED_<orderId>
    alt ledger ยังไม่มี
        O->>FS: create orders/{orderId}
        O->>FS: update product -> SOLD
        O->>Ledger: write SALE_APPLIED_<orderId>
        O->>DB: increment sales aggregates
    else ledger มีอยู่แล้ว
        O->>O: skip duplicate apply
    end
    O->>FS: commit transaction
    O-->>UI: success
```

### 4.5 Undo Sale

```mermaid
sequenceDiagram
    actor User
    participant UI as Products List
    participant O as Orders Logic
    participant FS as Firestore
    participant Ledger as stats_ledger
    participant DB as dashboard_stats/dashboard_brand_stats

    User->>UI: กดยกเลิกการขาย
    UI->>O: undoSale(orderId)
    O->>FS: start transaction
    O->>FS: read order + product
    O->>Ledger: check SALE_REVERTED_<orderId>
    alt ledger ยังไม่มี
        O->>FS: restore product status from last_status_before_sold
        O->>Ledger: write SALE_REVERTED_<orderId>
        O->>DB: decrement aggregates
    else ledger มีอยู่แล้ว
        O->>O: skip duplicate revert
    end
    O->>FS: commit transaction
    O-->>UI: success
```

## 5. Product Create Page

หน้าที่:

- สร้างสินค้าใหม่
- ใส่ข้อมูลสินค้า
- อัปโหลดรูป
- เลือกว่าจะ publish เลยหรือเก็บเป็น draft

```mermaid
sequenceDiagram
    actor User
    participant UI as Product Create Page
    participant P as Products Logic
    participant C as counters/products
    participant ST as Storage
    participant FS as Firestore
    participant DB as dashboard_stats

    User->>UI: กรอกข้อมูลสินค้า + เลือกรูป
    UI->>P: createProduct(payload)
    P->>P: validate required fields
    P->>P: normalize slug
    P->>P: check duplicate slug
    P->>C: reserve next SKU sequence
    C-->>P: sku = RBC-###
    alt มีรูป
        P->>ST: upload images as WebP
        ST-->>P: image urls
    end
    P->>P: set cover_image from first image
    alt show=true
        P->>P: validate publish readiness
    end
    P->>FS: batch create product
    P->>DB: update cached counters
    P-->>UI: success
```

## 6. Product Edit Page

หน้าที่:

- แก้ไขข้อมูลสินค้า
- เปลี่ยนรูป / เรียงรูป
- แก้การแสดงผลหน้าเว็บ

```mermaid
sequenceDiagram
    actor User
    participant UI as Product Edit Page
    participant P as Products Logic
    participant ST as Storage
    participant FS as Firestore
    participant DB as dashboard_stats

    User->>UI: เปิดหน้าแก้ไข
    UI->>P: getProductById(id)
    P->>FS: read product
    FS-->>P: product doc
    P-->>UI: hydrate form

    User->>UI: แก้ข้อมูล + เพิ่ม/ลบ/เรียงรูป
    UI->>P: updateProduct(id, payload)
    P->>P: normalize slug + validate fields
    alt มีรูปใหม่
        P->>ST: upload new images
        ST-->>P: new image urls
    end
    P->>P: recompute cover_image
    alt show=true
        P->>P: validate publish readiness
    end
    P->>FS: batch update product
    alt มีรูปเก่าถูกแทนที่หรือลบ
        P->>ST: cleanup old images
    end
    P->>DB: update cached counters if needed
    P-->>UI: success
```

## 7. Report Page

หน้าที่:

- ดูยอดขายตามช่วงเดือน
- ดูยอดขายรวม ต้นทุน กำไร
- ส่งออก CSV

```mermaid
sequenceDiagram
    actor User
    participant UI as Report Page
    participant R as Report Logic
    participant FS as Firestore

    User->>UI: เปิดหน้า report หรือเปลี่ยนช่วงเดือน
    UI->>R: loadReport(fromMonth, toMonth)
    R->>FS: read dashboard_stats/global
    R->>FS: read dashboard_brand_stats/*
    R->>FS: query orders by month range
    FS-->>R: report data
    R-->>UI: render summary + chart + table

    User->>UI: กดส่งออก
    UI->>R: exportCsv(rows)
    R-->>UI: download csv
```

## 8. Settings Page

หน้าที่:

- ตั้งค่าแบนเนอร์หน้าแรก
- ตั้งค่าเครดิต / โลโก้
- ตั้งค่าเวลาเลื่อน banner

### 8.1 Load Settings

```mermaid
sequenceDiagram
    actor User
    participant UI as Settings Page
    participant S as Site Settings Logic
    participant FS as Firestore

    User->>UI: เปิดหน้า Settings
    UI->>S: getSiteSettings()
    S->>FS: read settings/site
    FS-->>S: settings doc
    S-->>UI: fill form
```

### 8.2 Save Settings

```mermaid
sequenceDiagram
    actor User
    participant UI as Settings Page
    participant S as Site Settings Logic
    participant ST as Storage
    participant FS as Firestore

    User->>UI: เปลี่ยน banner/credit แล้วกดบันทึก
    UI->>S: updateSiteSettings(payload)
    alt มีรูปใหม่
        S->>ST: upload new image
        ST-->>S: image_url
    end
    S->>FS: update settings/site
    alt มีรูปเก่าที่ถูกแทน
        S->>ST: delete old image
    end
    S-->>UI: success
```

## 9. Dashboard Aggregate Rebuild Flow

ใช้ในกรณีข้อมูล cached aggregate เพี้ยนหรือหลัง cleanup/reseed

```mermaid
sequenceDiagram
    participant Script as rebuild-dashboard-aggregates.cjs
    participant FS as Firestore
    participant DB as dashboard_stats/dashboard_brand_stats

    Script->>FS: read products
    Script->>FS: read confirmed orders
    Script->>DB: recompute global counters
    Script->>DB: recompute brand counters
    Script-->>FS: write rebuilt aggregate docs
```

## 10. Dev Dataset Cleanup And Reseed Flow

ใช้สำหรับ reset dev data แล้วสร้าง demo data ใหม่

```mermaid
sequenceDiagram
    participant Operator as Team Operator
    participant Cleanup as cleanup-dev-dataset.cjs
    participant Seed as seed-final.cjs
    participant Rebuild as rebuild-dashboard-aggregates.cjs
    participant FS as Firestore
    participant ST as Storage

    Operator->>Cleanup: run cleanup
    Cleanup->>FS: delete business collections
    Cleanup->>FS: delete dashboard/global docs
    Cleanup->>ST: delete storage prefixes
    Cleanup-->>Operator: cleanup summary

    Operator->>Seed: run seed
    Seed->>FS: create categories
    Seed->>FS: create brands
    Seed->>FS: create category_brands
    Seed->>FS: create products
    Seed->>FS: create orders + stats_ledger
    Seed->>FS: create settings/site

    Operator->>Rebuild: run rebuild
    Rebuild->>FS: read products + confirmed orders
    Rebuild->>FS: write dashboard_stats/global
    Rebuild->>FS: write dashboard_brand_stats/*
```

## 11. Verification Flow

ใช้ยืนยันว่าระบบพร้อมใช้งานทั้งด้านโค้ดและข้อมูล

```mermaid
sequenceDiagram
    participant Operator as Team Operator
    participant Build as Nuxt Build
    participant Verify1 as verify-phase1.cjs
    participant Verify2 as verify-phase2-mutations.cjs
    participant Verify3 as verify-phase3-guardrails.cjs
    participant VerifyImg as verify-image-flows.cjs

    Operator->>Build: run typecheck + generate
    Build-->>Operator: build result
    Operator->>Verify1: check data integrity
    Operator->>Verify2: check mutation flows
    Operator->>Verify3: check publish guardrails
    Operator->>VerifyImg: check image upload/replace/cleanup
    Verify1-->>Operator: result
    Verify2-->>Operator: result
    Verify3-->>Operator: result
    VerifyImg-->>Operator: result
```

## 12. Field Mapping By Page

ส่วนนี้สรุปว่าแต่ละหน้าหลักของ backoffice อ่านหรือเขียน collection ไหน และแตะ field สำคัญอะไรบ้าง

### 12.1 Login Page

collections:

- `owners/{uid}`

fields ที่เกี่ยวข้อง:

- `uid`
- owner allowlist presence

หมายเหตุ:

- ใช้เช็กว่าบัญชี Google ที่ login เข้ามาได้รับสิทธิ์เข้า backoffice หรือไม่

### 12.2 Dashboard Page

collections:

- `dashboard_stats/global`
- `dashboard_brand_stats/{brandId}`

fields ที่เกี่ยวข้องใน `dashboard_stats/global`:

- `total_products`
- `active_products`
- `reserved_products`
- `sold_products`
- `visible_products`
- `total_sales_count`
- `total_sales_amount`
- `total_cost_amount`
- `total_profit_amount`
- `updated_at`

fields ที่เกี่ยวข้องใน `dashboard_brand_stats/{brandId}`:

- `brand_id`
- `brand_name`
- `sales_count`
- `sales_amount`
- `cost_amount`
- `profit_amount`
- `updated_at`

### 12.3 Categories Page

collections:

- `categories/{categoryId}`
- `brands/{brandId}`
- `category_brands/{categoryId__brandId}`

fields ใน `categories/{categoryId}`:

- `name`
- `slug`
- `image_url`
- `order`
- `is_active`
- `seo_title`
- `seo_description`
- `seo_image`
- `created_at`
- `updated_at`

fields ใน `brands/{brandId}`:

- `name`
- `slug`
- `image_url`
- `order`
- `is_active`
- `seo_title`
- `seo_description`
- `seo_image`
- `created_at`
- `updated_at`

fields ใน `category_brands/{categoryId__brandId}`:

- `category_id`
- `category_name`
- `category_slug`
- `brand_id`
- `brand_name`
- `brand_image_url`
- `order`
- `is_active`
- `created_at`
- `updated_at`

### 12.4 Products List Page

collections:

- `products/{productId}`
- `orders/{orderId}`
- `stats_ledger/{ledgerId}`
- `dashboard_stats/global`
- `dashboard_brand_stats/{brandId}`

fields ใน `products/{productId}` ที่หน้า list ใช้บ่อย:

- `sku`
- `name`
- `slug`
- `category_id`
- `category_name`
- `brand_id`
- `brand_name`
- `cover_image`
- `status`
- `show`
- `is_deleted`
- `is_sellable`
- `sell_price`
- `updated_at`
- `sold_at`
- `sold_price`
- `sold_channel`

fields ใน `orders/{orderId}` ที่สัมพันธ์กับ list actions:

- `status`
- `product_id`
- `brand_id`
- `brand_name`
- `sold_channel`
- `sold_price`
- `sold_yyyymm`
- `cost_price_at_sale`
- `fee`
- `profit`
- `sold_at`
- `product_snapshot`

fields ใน `stats_ledger/{ledgerId}`:

- `type`
- `ref_id`
- `entity_type`
- `entity_id`
- `operation_key`
- `product_id`
- `created_at`

### 12.5 Product Create / Edit Pages

collections:

- `products/{productId}`
- `category_brands/{categoryId__brandId}`
- `dashboard_stats/global`

fields หลักใน `products/{productId}`:

- `sku`
- `sku_seq`
- `name`
- `slug`
- `category_id`
- `category_name`
- `brand_id`
- `brand_name`
- `condition`
- `cost_price`
- `sell_price`
- `shutter`
- `defect_detail`
- `free_gift_detail`
- `cover_image`
- `images`
- `seo_title`
- `seo_description`
- `seo_image`
- `status`
- `show`
- `is_sellable`
- `is_deleted`
- `deleted_at`
- `last_status_before_sold`
- `sold_at`
- `sold_price`
- `sold_channel`
- `sold_ref`
- `created_at`
- `updated_at`

fields ใน `category_brands/{categoryId__brandId}` ที่ใช้ตอน validate:

- `category_id`
- `brand_id`
- `is_active`
- `order`

หมายเหตุ:

- หน้า create/edit ใช้ `category_brands` เพื่อตรวจว่า brand ที่เลือกยังผูกกับ category นั้นจริง
- ถ้า `show=true` ระบบจะตรวจ public-readiness ก่อน write

### 12.6 Report Page

collections:

- `orders/{orderId}`
- `dashboard_stats/global`
- `dashboard_brand_stats/{brandId}`

fields ใน `orders/{orderId}` ที่ report ใช้:

- `status`
- `product_id`
- `brand_id`
- `brand_name`
- `category_id`
- `sold_channel`
- `sold_price`
- `sold_yyyymm`
- `cost_price_at_sale`
- `fee`
- `profit`
- `sold_at`
- `product_snapshot`

fields ใน `product_snapshot` ที่ report ใช้:

- `sku`
- `name`
- `category_name`
- `brand_name`

### 12.7 Settings Page

collections:

- `settings/site`

fields ใน `settings/site`:

- `banner_auto_slide_sec`
- `banners[]`
- `credits[]`
- `updated_at`

fields ใน `banners[]`:

- `id`
- `image_url`
- `order`
- `active`

fields ใน `credits[]`:

- `id`
- `image_url`
- `order`

### 12.8 Global Loading / Toast / Shared UI

ไฟล์ที่เกี่ยวข้อง:

- `app/app.vue`
- `app/composables/useGlobalLoading.ts`
- `app/composables/useAppToast.ts`

state สำคัญ:

- `global-loading:count`
- `global-loading:message`

หมายเหตุ:

- ไม่ได้เขียนลง Firestore โดยตรง
- ใช้คุม loading overlay และ toast กลางของระบบ

### 12.9 Operational Scripts

collections ที่ script แตะบ่อย:

- `products`
- `orders`
- `stats_ledger`
- `categories`
- `brands`
- `category_brands`
- `dashboard_stats`
- `dashboard_brand_stats`
- `settings`

script ที่เกี่ยวข้อง:

- `scripts/rebuild-dashboard-aggregates.cjs`
- `scripts/repair-stats-ledger.cjs`
- `scripts/cleanup-dev-dataset.cjs`
- `scripts/reseed-dev-dataset.cjs`
- `scripts/seed-final.cjs`

## สรุป collection สำคัญ

- `categories`
- `brands`
- `category_brands`
- `products`
- `orders`
- `stats_ledger`
- `dashboard_stats`
- `dashboard_brand_stats`
- `settings`

## สรุปความสัมพันธ์สำคัญ

- Category -> Brand ใช้ `category_brands`
- Product ใช้ `category_id` + `brand_id`
- Sale ผูกกับ `orders`
- Sale/Undo ใช้ `stats_ledger` กันการนับซ้ำ
- Dashboard อ่านจาก cached aggregates ไม่ได้ derive ใหม่ทุกครั้งบนหน้า UI
