// seed-final.js
// NOTE: reads serviceAccountKey.json from project root and FIRESTORE_DATABASE_ID from .env
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");
const { formatProductSku, PRODUCT_SKU_PREFIX } = require("./lib/product-sku.cjs");

const projectRoot = path.resolve(__dirname, "..");
function resolveEnvPath(rootDir) {
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
  const candidates = appEnv === "production"
    ? [".env.production", ".env"]
    : [".env.development", ".env"];
  for (const name of candidates) {
    const fullPath = path.join(rootDir, name);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return path.join(rootDir, ".env");
}

const envPath = resolveEnvPath(projectRoot);
const serviceAccount = require(path.join(projectRoot, "serviceAccountKey.json"));

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const text = fs.readFileSync(filePath, "utf8");
  const result = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

const env = parseEnvFile(envPath);
const databaseId = env.FIRESTORE_DATABASE_ID || "(default)";
const app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = getFirestore(app, databaseId);
const TS = admin.firestore.FieldValue.serverTimestamp;

function slugify(s){return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)]}
function rand(min,max){return Math.floor(Math.random()*(max-min+1))+min}
function money(v){return Math.round(v)}
function yyyymmNow(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function buildLedgerPayload(type, orderId, productId){
  return {
    type,
    ref_id: orderId,
    entity_type: "order",
    entity_id: orderId,
    operation_key: `${type}_${orderId}`,
    product_id: productId,
    created_at: TS(),
  };
}

async function commitInChunks(ops, size=450){
  for(let i=0;i<ops.length;i+=size){
    const batch=db.batch();
    ops.slice(i,i+size).forEach(fn=>fn(batch));
    await batch.commit();
  }
}

const categories=[
  {id:"camera",name:"CAMERA",order:1},
  {id:"lens",name:"LEN",order:2},
  {id:"accessories",name:"ACCESSORIES",order:3},
];

const brands=["Canon","Nikon","Sony","Fujifilm","Sigma","Tamron","DJI","Godox"];
const map={
  camera:["Canon","Nikon","Sony","Fujifilm","DJI"],
  lens:["Canon","Nikon","Sony","Sigma","Tamron"],
  accessories:["Godox","DJI","Sony"],
};
const soldChannels=["FB","LINE","TIKTOK","IG","WALKIN"];
const conditions=["NEW","LIKE_NEW","GOOD","FAIR"];

function computeGlobal(products, orders){
  const s={total_products:products.length,active_products:0,reserved_products:0,sold_products:0,visible_products:0,total_sales_count:0,total_sales_amount:0,total_cost_amount:0,total_profit_amount:0};
  for(const p of products){
    if(p.show) s.visible_products++;
    if(p.status==="ACTIVE") s.active_products++;
    if(p.status==="RESERVED") s.reserved_products++;
    if(p.status==="SOLD") s.sold_products++;
  }
  for(const o of orders){
    if(o.status!=="CONFIRMED") continue;
    s.total_sales_count++;
    s.total_sales_amount+=o.sold_price;
    s.total_cost_amount+=o.cost_price_at_sale;
    s.total_profit_amount+=o.profit;
  }
  return s;
}

function computeBrandStats(orders){
  const m=new Map();
  for(const o of orders){
    if(o.status!=="CONFIRMED") continue;
    if(!m.has(o.brand_id)){
      m.set(o.brand_id,{brand_id:o.brand_id,brand_name:o.brand_name,sales_count:0,sales_amount:0,cost_amount:0,profit_amount:0});
    }
    const s=m.get(o.brand_id);
    s.sales_count++;
    s.sales_amount+=o.sold_price;
    s.cost_amount+=o.cost_price_at_sale;
    s.profit_amount+=o.profit;
  }
  return m;
}

async function seed(){
  const ops=[];

  ops.push(b=>b.set(db.collection("settings").doc("site"),{
    banner_auto_slide_sec:5,
    banners:[{id:"banner1",image_url:"",order:1,active:true}],
    credits:[{id:"credit1",image_url:"",order:1}],
    updated_at:TS(),
  },{merge:true}));

  for(const c of categories){
    ops.push(b=>b.set(db.collection("categories").doc(c.id),{
      name:c.name,slug:slugify(c.name),image_url:"",order:c.order,is_active:true,created_at:TS(),updated_at:TS()
    },{merge:true}));
  }

  brands.forEach((name,idx)=>{
    const id=slugify(name);
    ops.push(b=>b.set(db.collection("brands").doc(id),{
      name,slug:id,image_url:"",order:idx+1,is_active:true,created_at:TS(),updated_at:TS()
    },{merge:true}));
  });

  for(const [catId,list] of Object.entries(map)){
    const cat=categories.find(c=>c.id===catId);
    list.forEach((name,i)=>{
      const bid=slugify(name);
      ops.push(b=>b.set(db.collection("category_brands").doc(`${catId}__${bid}`),{
        category_id:catId,category_name:cat.name,category_slug:slugify(cat.name),
        brand_id:bid,brand_name:name,brand_image_url:"",
        order:i+1,is_active:true,created_at:TS(),updated_at:TS()
      },{merge:true}));
    });
  }

  const products=[]; const orders=[];
  const monthKey=yyyymmNow();

  for(let i=1;i<=18;i++){
    const cat=pick(categories);
    const bname=pick(map[cat.id]);
    const bid=slugify(bname);

    let status="ACTIVE";
    if(i%6===0) status="RESERVED";
    if(i%4===0) status="SOLD";

    const hasSeedImage = false;
    const show=hasSeedImage ? i%7!==0 : false;
    const cost=rand(4000,35000);
    const sell=money(cost*(1.15+Math.random()*0.35));

    const pref=db.collection("products").doc();
    const pid=pref.id;
    const skuSeq=i;

    const p={
      sku:formatProductSku(skuSeq),
      sku_seq:skuSeq,
      name:`${bname} ${cat.name} ${100+i}`,
      slug:`${bid}-${cat.id}-${i}`,
      category_id:cat.id, category_name:cat.name,
      brand_id:bid, brand_name:bname,
      condition:pick(conditions),
      cost_price:cost, sell_price:sell,
      shutter:cat.id==="camera"?rand(500,120000):null,
      defect_detail:i%5===0?"มีรอยเล็กน้อย":"",
      free_gift_detail:i%4===0?"แถมฝาปิด/สายคล้อง":"",
      cover_image:"", images:[],
      status, show,
      is_sellable: status==="ACTIVE",
      last_status_before_sold:null,
      sold_at:null, sold_price:null, sold_channel:null, sold_ref:null,
      created_at:TS(), updated_at:TS()
    };

    if(status==="SOLD"){
      const soldPrice=money(sell*(0.9+Math.random()*0.1));
      const fee=money(soldPrice*(Math.random()*0.03));
      const profit=money(soldPrice-cost-fee);
      const oref=db.collection("orders").doc();
      const oid=oref.id;
      const orderStatus=i%12===0?"CANCELLED":"CONFIRMED";
      const channel=pick(soldChannels);

      p.last_status_before_sold=pick(["ACTIVE","RESERVED"]);
      p.status="SOLD"; p.is_sellable=false;
      p.sold_price=soldPrice; p.sold_channel=channel; p.sold_ref=oid; p.sold_at=TS();

      const o={
        status:orderStatus,
        product_id:pid,
        category_id:cat.id,
        brand_id:bid,
        brand_name:bname,
        sold_channel:channel,
        sold_price:soldPrice,
        sold_yyyymm:monthKey,
        cost_price_at_sale:cost,
        fee, profit,
        sold_at:TS(), created_at:TS(), updated_at:TS(),
        product_snapshot:{name:p.name,slug:p.slug,cover_image:"",category_name:cat.name,brand_name:bname}
      };
      orders.push(o);
      ops.push(b=>b.set(oref,o,{merge:true}));
      ops.push(b=>b.set(db.collection("stats_ledger").doc(`SALE_APPLIED_${oid}`),buildLedgerPayload("SALE_APPLIED", oid, pref.id),{merge:true}));
      if(orderStatus==="CANCELLED"){
        ops.push(b=>b.set(db.collection("stats_ledger").doc(`SALE_REVERTED_${oid}`),buildLedgerPayload("SALE_REVERTED", oid, pref.id),{merge:true}));
      }
    }

    products.push(p);
    ops.push(b=>b.set(pref,p,{merge:true}));
  }

  const global=computeGlobal(products,orders);
  ops.push(b=>b.set(db.collection("dashboard_stats").doc("global"),{...global,updated_at:TS()},{merge:true}));

  const brandStats=computeBrandStats(orders);
  for(const [bid,s] of brandStats.entries()){
    ops.push(b=>b.set(db.collection("dashboard_brand_stats").doc(bid),{...s,updated_at:TS()},{merge:true}));
  }
  ops.push(b=>b.set(db.collection("counters").doc("products"),{
    prefix:PRODUCT_SKU_PREFIX,
    last_sku_seq:products.length,
    updated_at:TS(),
  },{merge:true}));

  await commitInChunks(ops);
  console.log(`seed-final done for database ${databaseId}`);
}

seed().catch(err=>{console.error(err);process.exit(1)});
