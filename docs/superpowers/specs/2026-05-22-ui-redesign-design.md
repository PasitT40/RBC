# RBC Backoffice — UI Redesign Spec

**Date:** 2026-05-22  
**Status:** Approved  
**Approach:** Design Token System + Page-by-Page Rebuild (Approach B)

---

## Context

ระบบปัจจุบันใช้ Vuetify 3 + Tailwind CSS v4 แบบ hybrid ซึ่งทำให้ style ไม่ consistent — บางหน้าใช้ Vuetify default, บางหน้า override ด้วย Tailwind `tw:` prefix ทำให้ดูไม่เป็นระบบเดียวกัน จุดประสงค์ของ redesign นี้คือให้ UI ทั้งระบบสวยงาม consistent และ production-ready โดยไม่ตัดฟีเจอร์ใดออก พร้อมปรับปรุง UX flow บางจุดให้ดีขึ้น

---

## Design Decisions

| หัวข้อ | การตัดสินใจ |
|--------|------------|
| Direction | Warm Modern |
| Sidebar | White + Orange left-border active |
| Cards | Rounded (14px) + Warm orange-tinted shadow |
| Primary color | `#f97316` (orange-500) |
| Tech stack | คง Vuetify + Tailwind ไว้ (ไม่เปลี่ยน) |

---

## Design Token System

สร้าง CSS custom properties ใน `app/assets/main.css` และ Tailwind config:

```css
/* Color Tokens */
--rbc-orange-50: #fff7ed;
--rbc-orange-100: #ffedd5;
--rbc-orange-200: #fed7aa;
--rbc-orange-500: #f97316;
--rbc-orange-600: #ea580c;
--rbc-orange-700: #c2410c;
--rbc-orange-800: #9a3412;

/* Shadow Tokens */
--rbc-shadow-card: 0 4px 20px rgba(249,115,22,0.10);
--rbc-shadow-modal: 0 20px 60px rgba(15,23,42,0.18);

/* Radius Tokens */
--rbc-radius-card: 14px;
--rbc-radius-btn: 8px;
--rbc-radius-badge: 20px;
```

---

## Layout Architecture

### Shell
- `display: grid; grid-template-columns: 240px 1fr`
- Sidebar: fixed 240px, `height: 100vh`, `overflow: hidden`
- Main: `overflow-y: auto`, background `#f8fafc`

### Sidebar (`app/layouts/default.vue`)
- Background: `#ffffff`, `border-right: 1px solid #e2e8f0`
- Logo section: gradient icon (orange-500 → orange-600), ชื่อร้าน + subtitle
- Nav items: padding 9px 12px, border-radius 8px, สี `#64748b`
- **Active state:** `background: #fff7ed`, `border-left: 3px solid #f97316`, สี `#c2410c`, font-weight 600
- Badge count: pill orange บนเมนูสินค้า
- Footer: logout button + Firestore DB ID

### Topbar (sticky)
- Background: white, `border-bottom: 1px solid #e2e8f0`, `position: sticky; top: 0; z-index: 10`
- Left: page title (700) + subtitle/date (slate-400, 11px)
- Right: action buttons (secondary ghost + primary orange gradient)

---

## Component Standards

### Stat Cards (Dashboard)
- Border-radius: 14px, box-shadow: `var(--rbc-shadow-card)`
- Bottom color strip (3px gradient) ต่างสีตาม category
- Icon badge มุมขวาบน (background tinted ตามสี)
- Delta indicator: trend text ขนาด 10px

### Data Table
- Wrapper: border-radius 14px, warm shadow, overflow hidden
- Toolbar: search input (`background: #f8fafc`) + filter chips
- **Table header:** `background: #fff7ed`, สี `#9a3412`, 11px, font-weight 600
- Row hover: `background: #fff7ed`
- **Action buttons:** context-aware ตาม status — สินค้าขายแล้ว ปุ่ม edit/sell ถูก disable + opacity 0.4
- Status badges: pill shape (border-radius 20px), green/blue/orange/red ตาม status
- Pagination: เลขหน้าปัจจุบัน orange tinted

### Buttons
- Primary: `background: linear-gradient(135deg, #f97316, #ea580c)`, box-shadow orange
- Secondary/Ghost: white background, slate border
- Danger: `background: #fee2e2`, สี `#dc2626`

### Form Fields
- Label: 10px, font-weight 600, slate-500
- Input default: `background: #f8fafc`, `border: 1px solid #e2e8f0`
- Input focus: `border-color: #fb923c`, `box-shadow: 0 0 0 3px rgba(249,115,22,0.10)`
- Input error: `border-color: #f87171`, `background: #fff5f5` + inline error text
- File upload: dashed orange border, orange-50 background

### Modals
- Overlay: `rgba(15,23,42,0.25)`
- Card: border-radius 16px, `var(--rbc-shadow-modal)`
- Header: title + close button (slate-100 background)
- Footer: slate-100 background, right-aligned buttons

### Toast Notifications
- แทน iziToast ด้วย component ของตัวเอง (หรือ configure iziToast ให้ match)
- Left border 4px ตามระดับ: green (success), orange (warning), red (error)
- Box-shadow: `0 4px 12px rgba(15,23,42,0.08)`
- มี title + subtitle message

---

## UX Improvements per Page

### Dashboard (`pages/index.vue`)
- เพิ่ม delta/trend indicator บน KPI cards
- เพิ่ม "Action required" warning card (สินค้าจองค้าง > 7 วัน)
- Chart period selector (เดือนนี้ / 3 เดือน / ปีนี้)
- "ดูทั้งหมด →" link บน product preview table

### Products (`pages/products/index.vue`)
- เพิ่ม filter chips (ทั้งหมด / พร้อมขาย / จองแล้ว / ขายแล้ว) แทน dropdown
- Action buttons เปลี่ยนตาม status (context-aware)
- Search box ใน table toolbar
- Badge แสดง serial number ใต้ชื่อสินค้า

### Product Form (`pages/products/create.vue`, `edit-[id].vue`)
- เพิ่ม **3-step indicator** (ข้อมูลทั่วไป → รูปภาพ & ราคา → ตรวจสอบ)
- คำนวณกำไรโดยประมาณ realtime จากราคาทุน/ขาย
- Inline validation ทันทีไม่รอ submit

### Sale Modal
- เพิ่ม product mini-card แสดงข้อมูลสินค้าที่กำลังขาย
- Channel picker เป็น chips (หน้าร้าน / Facebook / Line / Shopee) แทน dropdown

### Categories (`pages/categories/index.vue`)
- ปรับ layout ให้ category / subcategory เห็นชัดขึ้น
- Drag handle แสดง cursor เพื่อบอกว่า drag ได้

### Report (`pages/report/index.vue`)
- Date range filter โดดเด่นขึ้น (ไม่ซ่อน)
- Export CSV button อยู่ topbar ไม่ต้องเลื่อนหา

### Settings (`pages/settings/index.vue`)
- Section headers ชัดขึ้น (banner / credit แยกส่วนชัดเจน)
- Preview banner แบบ inline ก่อน save
- **Image constraint enforcement** ต่อประเภท (ดูตาราง Image Specs ด้านล่าง)

---

## Image Upload Specifications

Source of truth จาก FE project — backoffice ต้องแสดงและบังคับ constraint เหล่านี้ทุก upload field

| ประเภท | ขนาด (px) | Ratio | Format | Max size | หมายเหตุ |
|--------|-----------|-------|--------|----------|---------|
| Banner slideshow | 1920 × 600 | ~16:5 | JPG / PNG | 500 KB | เนื้อหาสำคัญไว้กลางภาพ เผื่อขอบถูก crop บน mobile |
| หมวดหมู่สินค้า | 800 × 450 | 16:9 | JPG / PNG | 300 KB | ใช้ใน category card บน storefront |
| โลโก้แบรนด์ | 600 × 400 | 3:2 | PNG | 300 KB | พื้นหลังขาว/โปร่งใส โลโก้อยู่กลาง |
| ภาพสินค้า | 800 × 600 | 4:3 | JPG / PNG | 300 KB | ถ่ายบนพื้นขาว/เรียบ |
| ภาพรีวิวลูกค้า | 800 × 800 | 1:1 | JPG / PNG | 300 KB | square เหมือน Instagram |

### UX ของ Upload Fields (ทุก field ที่รับรูป)

1. **แสดง constraint ชัดเจนก่อน upload** — ใน upload zone ระบุ: ขนาด, ratio, format, max size
2. **Client-side validation ก่อน upload** — ตรวจ file size และ image dimension ใน browser ก่อนส่งขึ้น Firebase Storage
3. **Warning เมื่อ ratio ไม่ตรง** — แจ้งว่า "ภาพจะถูก crop เป็น X:Y อัตโนมัติ" พร้อม highlight แดงบน item
4. **Error เมื่อ file size เกิน** — block upload ทันที แสดง inline error
5. **Preview หลัง upload** — แสดง thumbnail ในสัดส่วนจริงของประเภทนั้น ไม่ใช่ square ทุกอัน

### Component: `VeeFileInput.vue` ต้องรับ props เพิ่ม

```ts
interface ImageConstraint {
  width: number       // expected width px
  height: number      // expected height px
  maxSizeKB: number   // max file size
  formats: string[]   // ['image/jpeg', 'image/png', 'image/webp']
  label: string       // แสดงใน UI เช่น "1920 × 600 px · ≤500 KB"
}
```

ใช้งาน:
```vue
<!-- Banner upload -->
<form-vee-file-input
  name="bannerImage"
  :constraint="{ width: 1920, height: 600, maxSizeKB: 500, formats: ['image/jpeg','image/png'], label: '1920 × 600 px · JPG/PNG · ≤500 KB' }"
/>

<!-- Product image upload -->
<form-vee-file-input
  name="productImage"
  :constraint="{ width: 800, height: 600, maxSizeKB: 300, formats: ['image/jpeg','image/png'], label: '800 × 600 px · JPG/PNG · ≤300 KB' }"
/>
```

---

## Implementation Order

1. **Design tokens** — `app/assets/main.css` + Vuetify theme config ใน `nuxt.config.ts`
2. **Layout** — `app/layouts/default.vue` (sidebar + topbar)
3. **Shared components** — buttons, badges, form fields, toast
4. **Dashboard** — `pages/index.vue`
5. **Products list** — `pages/products/index.vue`
6. **Product form** — `components/ProductEditorForm.vue`, create/edit pages
7. **Sale modal** — `components/modal/` (ถ้ามี) หรือใน products page
8. **Categories** — `pages/categories/index.vue`
9. **Report** — `pages/report/index.vue`
10. **Settings** — `pages/settings/index.vue`
11. **Login page** — `pages/login.vue` (ปัจจุบันดีอยู่แล้ว ปรับ minor เท่านั้น)

---

## Files to Modify

| ไฟล์ | งาน |
|------|-----|
| `app/assets/main.css` | เพิ่ม CSS custom properties / design tokens |
| `nuxt.config.ts` | ปรับ Vuetify theme (primary color, border-radius) |
| `app/layouts/default.vue` | Rebuild sidebar + topbar |
| `app/layouts/login.vue` | Minor polish |
| `app/components/form/Vee*.vue` | Restyle ทุก field component |
| `app/components/ProductEditorForm.vue` | เพิ่ม step indicator, restyle |
| `app/pages/index.vue` | Dashboard rebuild |
| `app/pages/products/index.vue` | Table + filter chips |
| `app/pages/products/create.vue` | Step form |
| `app/pages/products/edit-[id].vue` | Step form |
| `app/pages/categories/index.vue` | Layout polish |
| `app/pages/report/index.vue` | Filter + export UX |
| `app/pages/settings/index.vue` | Section layout |

---

## Verification

1. รัน `npm run dev` และเปิดแต่ละหน้าตรวจ visual consistency
2. ทดสอบ flow: เพิ่มสินค้า → จอง → ยืนยันขาย → ดูรายงาน
3. ตรวจ responsive บน viewport 1280px และ 1440px
4. ตรวจ toast notification แสดงถูกต้องใน success/error cases
5. ตรวจ form validation inline ทำงานก่อน submit
6. Deploy ไป Firebase Hosting dev: `npm run deploy:hosting:dev`
