import { supabase } from "./supabaseClient.js";

/* --- mapping helpers: DB (snake_case) <-> app state (camelCase) --- */

function clientFromRow(r) {
  return { id: r.id, name: r.name || "", contact: r.contact || "", channel: r.channel || "whatsapp", segment: r.segment || "Другое", notes: r.notes || "" };
}
function clientToRow(c) {
  return { id: c.id, name: c.name, contact: c.contact, channel: c.channel, segment: c.segment, notes: c.notes };
}

function orderFromRow(r) {
  return {
    id: r.id, name: r.name || "", clientId: r.client_id || "",
    material: r.material || "", sheetSize: r.sheet_size || "",
    materialPrice: r.material_price || "", materialPriceUnit: r.material_price_unit || "сум/кг",
    cutSize: r.cut_size || "", printSpec: r.print_spec || "", postPress: r.post_press || "",
    notes: r.notes || "", runs: r.runs || [],
  };
}
function orderToRow(o) {
  return {
    id: o.id, name: o.name, client_id: o.clientId || null,
    material: o.material, sheet_size: o.sheetSize,
    material_price: o.materialPrice, material_price_unit: o.materialPriceUnit,
    cut_size: o.cutSize, print_spec: o.printSpec, post_press: o.postPress,
    notes: o.notes, runs: o.runs || [],
  };
}

/* --- clients --- */

export async function fetchClients() {
  const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(clientFromRow);
}

export async function upsertClient(client) {
  const { error } = await supabase.from("clients").upsert(clientToRow(client));
  if (error) throw error;
}

export async function deleteClientRow(id) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

/* --- orders --- */

export async function fetchOrders() {
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(orderFromRow);
}

export async function upsertOrder(order) {
  const { error } = await supabase.from("orders").upsert(orderToRow(order));
  if (error) throw error;
}

export async function deleteOrderRow(id) {
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
}
