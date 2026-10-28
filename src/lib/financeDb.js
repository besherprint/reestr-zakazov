import { supabase } from "./supabaseClient.js";

/* --- generic row <-> entity helpers (suppliers / workshops) --- */

function entityFromRow(r) {
  return { id: r.id, name: r.name || "", contact: r.contact || "", notes: r.notes || "" };
}
function entityToRow(e) {
  return { id: e.id, name: e.name, contact: e.contact, notes: e.notes };
}

/* charges = накладные (suppliers) / заказы (workshops) / отгрузки (clients) */
function chargeFromRow(r, fkField) {
  return {
    id: r.id,
    entityId: r[fkField],
    date: r.date,
    items: r.items || [],
    extra: r.extra || "",
    total: Number(r.total) || 0,
    note: r.note || "",
  };
}
function chargeToRow(c, fkField) {
  return {
    id: c.id,
    [fkField]: c.entityId,
    date: c.date,
    items: c.items || [],
    extra: c.extra || "",
    total: c.total || 0,
    note: c.note || "",
  };
}

function paymentFromRow(r, fkField) {
  return { id: r.id, entityId: r[fkField], date: r.date, amount: Number(r.amount) || 0, note: r.note || "" };
}
function paymentToRow(p, fkField) {
  return { id: p.id, [fkField]: p.entityId, date: p.date, amount: p.amount, note: p.note || "" };
}

async function fetchTable(table, mapFn, ...mapArgs) {
  const { data, error } = await supabase.from(table).select("*").order("date", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => mapFn(r, ...mapArgs));
}
async function upsertTable(table, row) {
  const { error } = await supabase.from(table).upsert(row);
  if (error) throw error;
}
async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}
async function fetchEntities(table) {
  const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(entityFromRow);
}

/* --- Suppliers (поставщики бумаги) --- */
export const fetchSuppliers = () => fetchEntities("suppliers");
export const upsertSupplier = (e) => upsertTable("suppliers", entityToRow(e));
export const deleteSupplier = (id) => deleteRow("suppliers", id);

export const fetchSupplierInvoices = () => fetchTable("supplier_invoices", chargeFromRow, "supplier_id");
export const upsertSupplierInvoice = (c) => upsertTable("supplier_invoices", chargeToRow(c, "supplier_id"));
export const deleteSupplierInvoice = (id) => deleteRow("supplier_invoices", id);

export const fetchSupplierPayments = () => fetchTable("supplier_payments", paymentFromRow, "supplier_id");
export const upsertSupplierPayment = (p) => upsertTable("supplier_payments", paymentToRow(p, "supplier_id"));
export const deleteSupplierPayment = (id) => deleteRow("supplier_payments", id);

/* --- Workshops (цеха) --- */
export const fetchWorkshops = () => fetchEntities("workshops");
export const upsertWorkshop = (e) => upsertTable("workshops", entityToRow(e));
export const deleteWorkshop = (id) => deleteRow("workshops", id);

export const fetchWorkshopOrders = () => fetchTable("workshop_orders", chargeFromRow, "workshop_id");
export const upsertWorkshopOrder = (c) => upsertTable("workshop_orders", chargeToRow(c, "workshop_id"));
export const deleteWorkshopOrder = (id) => deleteRow("workshop_orders", id);

export const fetchWorkshopPayments = () => fetchTable("workshop_payments", paymentFromRow, "workshop_id");
export const upsertWorkshopPayment = (p) => upsertTable("workshop_payments", paymentToRow(p, "workshop_id"));
export const deleteWorkshopPayment = (id) => deleteRow("workshop_payments", id);

/* --- Client finance ledger (отгрузки клиентам / их оплаты) --- */
export const fetchClientDeliveries = () => fetchTable("client_deliveries", chargeFromRow, "client_id");
export const upsertClientDelivery = (c) => upsertTable("client_deliveries", chargeToRow(c, "client_id"));
export const deleteClientDelivery = (id) => deleteRow("client_deliveries", id);

export const fetchClientPayments = () => fetchTable("client_payments", paymentFromRow, "client_id");
export const upsertClientPayment = (p) => upsertTable("client_payments", paymentToRow(p, "client_id"));
export const deleteClientPayment = (id) => deleteRow("client_payments", id);
