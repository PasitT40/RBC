import type { Firestore } from "firebase-admin/firestore";
import { serializeBrand } from "../lib/serializers.js";

export async function listBrandsRoute(db: Firestore) {
  const snap = await db.collection("brands").where("is_active", "==", true).orderBy("order", "asc").get();
  return {
    items: snap.docs.map((doc) => serializeBrand(doc)),
  };
}
