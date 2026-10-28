import { useState, useEffect } from "react";
import {
  Plus, X, Search, Trash2, Edit3, ArrowLeft, ChevronRight, Wallet,
  Truck, Factory, Users2, FileBarChart, TrendingUp, TrendingDown,
} from "lucide-react";
import {
  fetchSuppliers, upsertSupplier, deleteSupplier,
  fetchSupplierInvoices, upsertSupplierInvoice, deleteSupplierInvoice,
  fetchSupplierPayments, upsertSupplierPayment, deleteSupplierPayment,
  fetchWorkshops, upsertWorkshop, deleteWorkshop,
  fetchWorkshopOrders, upsertWorkshopOrder, deleteWorkshopOrder,
  fetchWorkshopPayments, upsertWorkshopPayment, deleteWorkshopPayment,
  fetchClientDeliveries, upsertClientDelivery, deleteClientDelivery,
  fetchClientPayments, upsertClientPayment, deleteClientPayment,
} from "../lib/financeDb.js";

const uid = () => Math.random().toString(36).slice(2, 10);

function fmt(n) {
  if (n === "" || n === null || n === undefined || isNaN(n)) return "—";
  const num = Number(n);
  const sign = num < 0 ? "-" : "";
  return sign + Math.abs(num).toLocaleString("ru-RU");
}
function fmtMoney(n) {
  return `${fmt(n)} сум`;
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function daysAgo(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((today - d) / 86400000);
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const emptyEntity = () => ({ id: uid(), name: "", contact: "", notes: "" });
const emptyCharge = (extra = "") => ({ id: uid(), entityId: "", date: todayStr(), items: [emptyItem()], extra, total: 0, note: "" });
const emptyItem = () => ({ id: uid(), name: "", qty: "", price: "" });
const emptyPayment = () => ({ id: uid(), entityId: "", date: todayStr(), amount: "", note: "" });

/* Builds a chronological ledger (charges + payments) with running balance.
   direction "owe"  -> charge increases what WE owe the entity (suppliers/workshops)
   direction "owed" -> charge increases what the entity owes US (clients) */
function buildTimeline(entityId, charges, payments) {
  const chargeEntries = charges.filter((c) => c.entityId === entityId).map((c) => ({ kind: "charge", id: c.id, date: c.date, amount: c.total, raw: c }));
  const paymentEntries = payments.filter((p) => p.entityId === entityId).map((p) => ({ kind: "payment", id: p.id, date: p.date, amount: p.amount, raw: p }));
  const all = [...chargeEntries, ...paymentEntries].sort((a, b) => {
    const dt = new Date(a.date) - new Date(b.date);
    if (dt !== 0) return dt;
    return a.kind === "charge" ? -1 : 1;
  });
  let running = 0;
  const withBalance = all.map((e) => {
    const before = running;
    running += e.kind === "charge" ? e.amount : -e.amount;
    return { ...e, before, after: running };
  });
  return { entries: withBalance.slice().reverse(), balance: running };
}

function lastPayment(entityId, payments) {
  const list = payments.filter((p) => p.entityId === entityId).sort((a, b) => new Date(b.date) - new Date(a.date));
  return list[0] || null;
}
function lastCharge(entityId, charges) {
  const list = charges.filter((c) => c.entityId === entityId).sort((a, b) => new Date(b.date) - new Date(a.date));
  return list[0] || null;
}

/* ---------- Shared small bits ---------- */

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8578] mb-1">{label}</label>
      {children}
    </div>
  );
}
const inputCls = "w-full border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-3 py-2 bg-white";

function BalancePill({ amount, direction }) {
  if (amount === 0) {
    return <span className="text-sm font-mono font-semibold text-[#4A6B4E]">0</span>;
  }
  const bad = amount > 0; // owe > 0 means debt in both directions semantically (we owe / they owe us)
  return (
    <span className={`text-sm font-mono font-bold ${bad ? "text-[#B33A3A]" : "text-[#4A6B4E]"}`}>
      {fmt(amount)}
      {amount < 0 && <span className="text-xs font-sans font-normal ml-1">(переплата)</span>}
    </span>
  );
}

/* ---------- Entity (supplier/workshop) create/edit form ---------- */

function EntityForm({ initial, title, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="fixed inset-0 bg-[#1C2A39]/50 flex items-start sm:items-center justify-center z-50 p-3 overflow-y-auto">
      <div className="bg-[#F6F1E4] w-full max-w-md rounded-sm shadow-2xl border-2 border-[#1C2A39] my-6">
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#1C2A39]">
          <h2 className="font-bold text-lg">{title}</h2>
          <button onClick={onCancel}><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Название">
            <input autoFocus value={form.name} onChange={set("name")} className={inputCls} />
          </Field>
          <Field label="Контакт">
            <input value={form.contact} onChange={set("contact")} placeholder="Имя, телефон" className={inputCls} />
          </Field>
          <Field label="Заметки">
            <textarea value={form.notes} onChange={set("notes")} rows={2} className={inputCls + " resize-none"} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t-2 border-[#1C2A39]">
          <button onClick={onCancel} className="px-4 py-2 rounded-sm font-semibold border-2 border-[#1C2A39]/20">Отмена</button>
          <button onClick={() => onSave(form)} disabled={!form.name.trim()}
            className="px-4 py-2 rounded-sm bg-[#1C2A39] text-[#F6F1E4] font-semibold disabled:opacity-40">Сохранить</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Charge form (накладная / заказ / отгрузка) ---------- */

function ChargeForm({ initial, title, itemLabel, extraLabel, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setItem = (idx, k) => (e) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [k]: e.target.value };
    setForm({ ...form, items });
  };
  const addItem = () => setForm({ ...form, items: [...form.items, emptyItem()] });
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  const total = form.items.reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0), 0);
  const canSave = form.items.some((it) => it.name.trim() && it.qty && it.price);

  return (
    <div className="fixed inset-0 bg-[#1C2A39]/50 flex items-start sm:items-center justify-center z-50 p-3 overflow-y-auto">
      <div className="bg-[#F6F1E4] w-full max-w-xl rounded-sm shadow-2xl border-2 border-[#1C2A39] my-6">
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#1C2A39]">
          <h2 className="font-bold text-lg">{title}</h2>
          <button onClick={onCancel}><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Дата">
              <input type="date" value={form.date} onChange={set("date")} className={inputCls} />
            </Field>
            {extraLabel && (
              <Field label={extraLabel}>
                <input value={form.extra} onChange={set("extra")} className={inputCls + " font-mono"} />
              </Field>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="block text-xs font-bold uppercase tracking-wider text-[#8A8578]">{itemLabel}</span>
              <button onClick={addItem} className="text-xs font-semibold flex items-center gap-1 text-[#1C2A39] hover:opacity-70">
                <Plus size={12} /> Добавить строку
              </button>
            </div>
            <div className="space-y-1.5">
              <div className="grid grid-cols-[1fr_72px_84px_84px_22px] gap-1.5 text-[10px] uppercase tracking-wider text-[#8A8578] font-bold px-0.5">
                <span>Название</span><span>Кол-во</span><span>Цена</span><span className="text-right">Сумма</span><span />
              </div>
              {form.items.map((it, idx) => {
                const lineTotal = (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0);
                return (
                  <div key={it.id} className="grid grid-cols-[1fr_72px_84px_84px_22px] gap-1.5 items-center">
                    <input value={it.name} onChange={setItem(idx, "name")} placeholder="Позиция" className="border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-2 py-1.5 bg-white text-sm" />
                    <input value={it.qty} onChange={setItem(idx, "qty")} placeholder="0" inputMode="decimal" className="border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-2 py-1.5 bg-white text-sm font-mono" />
                    <input value={it.price} onChange={setItem(idx, "price")} placeholder="0" inputMode="decimal" className="border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-2 py-1.5 bg-white text-sm font-mono" />
                    <span className="text-xs font-mono text-right text-[#8A8578]">{lineTotal ? fmt(lineTotal) : "—"}</span>
                    <button onClick={() => removeItem(idx)} className="text-[#B33A3A] flex justify-center"><X size={14} /></button>
                  </div>
                );
              })}
              {form.items.length === 0 && <p className="text-xs text-[#8A8578] italic py-2">Нет позиций — добавьте строку.</p>}
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t-2 border-dashed border-[#1C2A39]/20">
            <span className="text-sm font-bold">Итого</span>
            <span className="font-mono font-bold text-lg">{fmtMoney(total)}</span>
          </div>

          <Field label="Заметка">
            <input value={form.note} onChange={set("note")} className={inputCls} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t-2 border-[#1C2A39]">
          <button onClick={onCancel} className="px-4 py-2 rounded-sm font-semibold border-2 border-[#1C2A39]/20">Отмена</button>
          <button onClick={() => onSave({ ...form, total })} disabled={!canSave}
            className="px-4 py-2 rounded-sm bg-[#1C2A39] text-[#F6F1E4] font-semibold disabled:opacity-40">Сохранить</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Payment form ---------- */

function PaymentForm({ initial, title, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="fixed inset-0 bg-[#1C2A39]/50 flex items-center justify-center z-50 p-3">
      <div className="bg-[#F6F1E4] w-full max-w-sm rounded-sm shadow-2xl border-2 border-[#1C2A39]">
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#1C2A39]">
          <h2 className="font-bold text-lg">{title}</h2>
          <button onClick={onCancel}><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Дата">
            <input type="date" value={form.date} onChange={set("date")} className={inputCls} />
          </Field>
          <Field label="Сумма">
            <input value={form.amount} onChange={set("amount")} inputMode="decimal" className={inputCls + " font-mono"} />
          </Field>
          <Field label="Заметка">
            <input value={form.note} onChange={set("note")} placeholder="Необязательно" className={inputCls} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t-2 border-[#1C2A39]">
          <button onClick={onCancel} className="px-4 py-2 rounded-sm font-semibold border-2 border-[#1C2A39]/20">Отмена</button>
          <button onClick={() => onSave(form)} disabled={!form.amount}
            className="px-4 py-2 rounded-sm bg-[#1C2A39] text-[#F6F1E4] font-semibold disabled:opacity-40">Сохранить</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Report modal (сверка) ---------- */

function ReportModal({ entity, charges, payments, chargeLabel, onClose }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayStr());
  const { entries } = buildTimeline(entity.id, charges, payments);
  const asc = [...entries].reverse();

  const inRange = (d) => (!from || d >= from) && (!to || d <= to);
  const rangeEntries = asc.filter((e) => inRange(e.date));
  const chargesInRange = rangeEntries.filter((e) => e.kind === "charge");
  const paymentsInRange = rangeEntries.filter((e) => e.kind === "payment");
  const totalCharged = chargesInRange.reduce((s, e) => s + e.amount, 0);
  const totalPaid = paymentsInRange.reduce((s, e) => s + e.amount, 0);
  const balanceBefore = asc.filter((e) => from && e.date < from).reduce((bal, e) => bal + (e.kind === "charge" ? e.amount : -e.amount), 0);
  const balanceAfter = balanceBefore + totalCharged - totalPaid;

  return (
    <div className="fixed inset-0 bg-[#1C2A39]/50 flex items-start sm:items-center justify-center z-50 p-3 overflow-y-auto">
      <div className="bg-[#F6F1E4] w-full max-w-2xl rounded-sm shadow-2xl border-2 border-[#1C2A39] my-6">
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#1C2A39]">
          <h2 className="font-bold text-lg flex items-center gap-2"><FileBarChart size={18} /> Отчёт · {entity.name}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="С даты">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
            </Field>
            <Field label="По дату">
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Баланс на начало", value: balanceBefore },
              { label: "Начислено", value: totalCharged },
              { label: "Оплачено", value: totalPaid },
              { label: "Баланс на конец", value: balanceAfter },
            ].map((s, i) => (
              <div key={i} className="border-2 border-[#1C2A39]/15 rounded-sm px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-[#8A8578] font-bold">{s.label}</div>
                <div className="font-mono font-bold">{fmt(s.value)}</div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-bold mb-2">{chargeLabel} за период</h3>
            {chargesInRange.length === 0 ? (
              <p className="text-xs text-[#8A8578] italic">Нет записей.</p>
            ) : (
              <div className="space-y-1">
                {chargesInRange.map((e) => (
                  <div key={e.id} className="flex justify-between text-sm border-b border-dashed border-[#1C2A39]/15 py-1.5">
                    <span>
                      <span className="font-semibold">{fmtDate(e.date)}</span>{" "}
                      <span className="text-[#8A8578]">
                        {e.raw.items.map((it) => it.name).filter(Boolean).join(", ") || e.raw.note || ""}
                      </span>
                    </span>
                    <span className="font-mono">{fmt(e.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold mb-2">Оплаты за период</h3>
            {paymentsInRange.length === 0 ? (
              <p className="text-xs text-[#8A8578] italic">Нет записей.</p>
            ) : (
              <div className="space-y-1">
                {paymentsInRange.map((e) => (
                  <div key={e.id} className="flex justify-between text-sm border-b border-dashed border-[#1C2A39]/15 py-1.5">
                    <span>
                      <span className="font-semibold">{fmtDate(e.date)}</span>{" "}
                      <span className="text-[#8A8578]">{e.raw.note || ""}</span>
                    </span>
                    <span className="font-mono">{fmt(e.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end px-5 py-4 border-t-2 border-[#1C2A39]">
          <button onClick={onClose} className="px-4 py-2 rounded-sm font-semibold border-2 border-[#1C2A39]/20">Закрыть</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Ledger detail (one supplier / workshop / client) ---------- */

function LedgerDetail({
  entity, charges, payments, direction,
  entityLabel, chargeLabel, chargeFormTitle, itemLabel, extraLabel, paymentLabel,
  onBack, onEditEntity, onDeleteEntity,
  onSaveCharge, onDeleteCharge, onSavePayment, onDeletePayment,
}) {
  const [addingCharge, setAddingCharge] = useState(false);
  const [addingPayment, setAddingPayment] = useState(false);
  const [editingCharge, setEditingCharge] = useState(null);
  const [showReport, setShowReport] = useState(false);

  const { entries, balance } = buildTimeline(entity.id, charges, payments);
  const lastPay = lastPayment(entity.id, payments);
  const lastChg = lastCharge(entity.id, charges);
  const owesLabel = direction === "owe" ? "Вы должны" : "Должны вам";

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-[#8A8578] hover:text-[#1C2A39] mb-4">
        <ArrowLeft size={15} /> Все {entityLabel.toLowerCase()}
      </button>

      <div className="bg-[#F6F1E4] border-2 border-[#1C2A39] rounded-sm p-5 mb-5">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div>
            <h2 className="display-font text-3xl leading-none">{entity.name}</h2>
            {entity.contact && <p className="text-[#8A8578] text-sm mt-1">{entity.contact}</p>}
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => setShowReport(true)} className="p-2 rounded-sm hover:bg-[#1C2A39]/10" title="Отчёт"><FileBarChart size={16} /></button>
            <button onClick={onEditEntity} className="p-2 rounded-sm hover:bg-[#1C2A39]/10"><Edit3 size={16} /></button>
            <button onClick={onDeleteEntity} className="p-2 rounded-sm hover:bg-[#B33A3A]/10 text-[#B33A3A]"><Trash2 size={16} /></button>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="border-2 border-[#1C2A39]/15 rounded-sm px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-[#8A8578] font-bold">{owesLabel}</div>
            <BalancePill amount={balance} direction={direction} />
          </div>
          <div className="border-2 border-[#1C2A39]/15 rounded-sm px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-[#8A8578] font-bold">Последняя оплата</div>
            {lastPay ? (
              <div className="text-sm font-semibold">
                {fmtMoney(lastPay.amount)} <span className="text-xs text-[#8A8578] font-normal">· {fmtDate(lastPay.date)} ({daysAgo(lastPay.date)} дн. назад)</span>
              </div>
            ) : (
              <div className="text-sm text-[#8A8578] italic">не было</div>
            )}
          </div>
          <div className="border-2 border-[#1C2A39]/15 rounded-sm px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-[#8A8578] font-bold">Последняя запись</div>
            {lastChg ? (
              <div className="text-sm font-semibold">
                {fmtDate(lastChg.date)} <span className="text-xs text-[#8A8578] font-normal">({daysAgo(lastChg.date)} дн. назад)</span>
              </div>
            ) : (
              <div className="text-sm text-[#8A8578] italic">нет записей</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setAddingCharge(true)} className="flex-1 flex items-center justify-center gap-1.5 bg-[#1C2A39] text-[#F6F1E4] px-3 py-2.5 rounded-sm text-sm font-semibold">
          <Plus size={14} /> {chargeFormTitle}
        </button>
        <button onClick={() => setAddingPayment(true)} className="flex-1 flex items-center justify-center gap-1.5 bg-[#4A6B4E] text-[#F6F1E4] px-3 py-2.5 rounded-sm text-sm font-semibold">
          <Plus size={14} /> {paymentLabel}
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-[#1C2A39]/20 rounded-sm text-[#8A8578] text-sm">
          Пока нет записей — добавьте первую.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.kind + e.id} className="bg-[#F6F1E4] border-2 border-[#1C2A39]/15 rounded-sm px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border-2 ${e.kind === "charge" ? "border-[#B33A3A] text-[#B33A3A]" : "border-[#4A6B4E] text-[#4A6B4E]"}`}>
                  {e.kind === "charge" ? chargeLabel : paymentLabel}
                </span>
                <span className="text-sm font-semibold">{fmtDate(e.date)}</span>
                {e.kind === "charge" && e.raw.extra && <span className="text-xs font-mono text-[#8A8578]">{e.raw.extra}</span>}
                <span className="flex-1" />
                <span className="font-mono font-bold">{e.kind === "charge" ? "+" : "-"}{fmt(e.amount)}</span>
                <span className="text-xs font-mono text-[#8A8578] hidden sm:inline">ост. {fmt(e.after)}</span>
                <button
                  onClick={() => (e.kind === "charge" ? setEditingCharge(e.raw) : null)}
                  className="p-1 rounded-sm hover:bg-[#1C2A39]/10 disabled:opacity-0"
                  disabled={e.kind !== "charge"}
                >
                  <Edit3 size={13} />
                </button>
                <button
                  onClick={() => (e.kind === "charge" ? onDeleteCharge(e.id) : onDeletePayment(e.id))}
                  className="p-1 rounded-sm hover:bg-[#B33A3A]/10 text-[#B33A3A]"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              {e.kind === "charge" && e.raw.items.some((it) => it.name) && (
                <div className="mt-1.5 pt-1.5 border-t border-dashed border-[#1C2A39]/10 text-xs text-[#8A8578] font-mono">
                  {e.raw.items.filter((it) => it.name).map((it) => `${it.name} ${fmt(it.qty)}×${fmt(it.price)}`).join(" · ")}
                </div>
              )}
              {e.raw.note && <div className="mt-1 text-xs text-[#8A8578] italic">{e.raw.note}</div>}
            </div>
          ))}
        </div>
      )}

      {addingCharge && (
        <ChargeForm
          initial={{ ...emptyCharge(extraLabel ? "" : undefined), entityId: entity.id }}
          title={chargeFormTitle}
          itemLabel={itemLabel}
          extraLabel={extraLabel}
          onSave={(form) => { onSaveCharge(form); setAddingCharge(false); }}
          onCancel={() => setAddingCharge(false)}
        />
      )}
      {editingCharge && (
        <ChargeForm
          initial={editingCharge}
          title={chargeFormTitle}
          itemLabel={itemLabel}
          extraLabel={extraLabel}
          onSave={(form) => { onSaveCharge(form); setEditingCharge(null); }}
          onCancel={() => setEditingCharge(null)}
        />
      )}
      {addingPayment && (
        <PaymentForm
          initial={{ ...emptyPayment(), entityId: entity.id }}
          title={paymentLabel}
          onSave={(form) => { onSavePayment(form); setAddingPayment(false); }}
          onCancel={() => setAddingPayment(false)}
        />
      )}
      {showReport && (
        <ReportModal entity={entity} charges={charges} payments={payments} chargeLabel={chargeLabel} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}

/* ---------- Entity list (suppliers / workshops) ---------- */

function EntityListSection({
  entities, charges, payments, direction,
  entityLabel, entityFormTitle, chargeLabel, chargeFormTitle, itemLabel, extraLabel, paymentLabel,
  onSaveEntity, onDeleteEntity, onSaveCharge, onDeleteCharge, onSavePayment, onDeletePayment,
  canCreate = true,
}) {
  const [editingEntity, setEditingEntity] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState("");

  const withBalance = entities.map((e) => ({ ...e, balance: buildTimeline(e.id, charges, payments).balance }));
  const filtered = withBalance.filter((e) => !query || e.name.toLowerCase().includes(query.toLowerCase()));
  const open = withBalance.find((e) => e.id === openId);

  if (open) {
    return (
      <LedgerDetail
        entity={open}
        charges={charges}
        payments={payments}
        direction={direction}
        entityLabel={entityLabel}
        chargeLabel={chargeLabel}
        chargeFormTitle={chargeFormTitle}
        itemLabel={itemLabel}
        extraLabel={extraLabel}
        paymentLabel={paymentLabel}
        onBack={() => setOpenId(null)}
        onEditEntity={() => setEditingEntity(open)}
        onDeleteEntity={() => { onDeleteEntity(open.id); setOpenId(null); }}
        onSaveCharge={onSaveCharge}
        onDeleteCharge={onDeleteCharge}
        onSavePayment={onSavePayment}
        onDeletePayment={onDeletePayment}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8578]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Поиск ${entityLabel.toLowerCase()}...`}
            className="w-full pl-9 pr-3 py-2.5 rounded-sm border-2 border-[#1C2A39]/15 focus:border-[#1C2A39] outline-none bg-[#F6F1E4]" />
        </div>
        {canCreate && (
          <button onClick={() => setEditingEntity(emptyEntity())}
            className="flex items-center gap-1.5 bg-[#1C2A39] text-[#F6F1E4] px-4 py-2.5 rounded-sm font-semibold whitespace-nowrap">
            <Plus size={16} /> {entityFormTitle}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-[#1C2A39]/20 rounded-sm text-[#8A8578]">
          {entities.length === 0 ? `Пока нет записей — добавьте первую.` : "Ничего не найдено."}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.sort((a, b) => b.balance - a.balance).map((e) => (
            <button key={e.id} onClick={() => setOpenId(e.id)}
              className="text-left bg-[#F6F1E4] border-2 border-[#1C2A39]/15 rounded-sm p-4 hover:border-[#1C2A39] transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold">{e.name}</div>
                  {e.contact && <div className="text-xs text-[#8A8578]">{e.contact}</div>}
                </div>
                <ChevronRight size={16} className="text-[#8A8578] mt-1" />
              </div>
              <div className="mt-2 pt-2 border-t border-dashed border-[#1C2A39]/15 flex justify-between items-center">
                <span className="text-xs text-[#8A8578]">{direction === "owe" ? "Вы должны" : "Должны вам"}</span>
                <BalancePill amount={e.balance} direction={direction} />
              </div>
            </button>
          ))}
        </div>
      )}

      {editingEntity && (
        <EntityForm
          initial={editingEntity}
          title={entityFormTitle}
          onSave={(form) => { onSaveEntity(form); setEditingEntity(null); }}
          onCancel={() => setEditingEntity(null)}
        />
      )}
    </div>
  );
}

/* ---------- Summary ---------- */

function SummaryTab({ suppliers, supplierInvoices, supplierPayments, workshops, workshopOrders, workshopPayments, clients, clientDeliveries, clientPayments, onOpen }) {
  const supplierBalances = suppliers.map((s) => ({ ...s, balance: buildTimeline(s.id, supplierInvoices, supplierPayments).balance })).filter((s) => s.balance > 0).sort((a, b) => b.balance - a.balance);
  const workshopBalances = workshops.map((w) => ({ ...w, balance: buildTimeline(w.id, workshopOrders, workshopPayments).balance })).filter((w) => w.balance > 0).sort((a, b) => b.balance - a.balance);
  const clientBalances = clients.map((c) => ({ ...c, balance: buildTimeline(c.id, clientDeliveries, clientPayments).balance })).filter((c) => c.balance > 0).sort((a, b) => b.balance - a.balance);

  const totalSuppliers = supplierBalances.reduce((s, x) => s + x.balance, 0);
  const totalWorkshops = workshopBalances.reduce((s, x) => s + x.balance, 0);
  const totalClients = clientBalances.reduce((s, x) => s + x.balance, 0);
  const net = totalClients - totalSuppliers - totalWorkshops;

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="bg-[#F6F1E4] border-2 border-[#1C2A39] rounded-sm p-4">
          <div className="text-xs uppercase tracking-wider text-[#8A8578] font-bold flex items-center gap-1.5"><Truck size={13} /> Вы должны поставщикам</div>
          <div className="display-font text-3xl text-[#B33A3A] mt-1">{fmt(totalSuppliers)}</div>
        </div>
        <div className="bg-[#F6F1E4] border-2 border-[#1C2A39] rounded-sm p-4">
          <div className="text-xs uppercase tracking-wider text-[#8A8578] font-bold flex items-center gap-1.5"><Factory size={13} /> Вы должны цехам</div>
          <div className="display-font text-3xl text-[#B33A3A] mt-1">{fmt(totalWorkshops)}</div>
        </div>
        <div className="bg-[#F6F1E4] border-2 border-[#1C2A39] rounded-sm p-4">
          <div className="text-xs uppercase tracking-wider text-[#8A8578] font-bold flex items-center gap-1.5"><Users2 size={13} /> Клиенты должны вам</div>
          <div className="display-font text-3xl text-[#4A6B4E] mt-1">{fmt(totalClients)}</div>
        </div>
      </div>

      <div className="bg-[#F6F1E4] border-2 border-[#1C2A39]/15 rounded-sm px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold flex items-center gap-2">
          {net >= 0 ? <TrendingUp size={16} className="text-[#4A6B4E]" /> : <TrendingDown size={16} className="text-[#B33A3A]" />}
          Чистая позиция (должны вам минус вы должны)
        </span>
        <span className={`font-mono font-bold text-lg ${net >= 0 ? "text-[#4A6B4E]" : "text-[#B33A3A]"}`}>{fmt(net)}</span>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { title: "Поставщики", list: supplierBalances, type: "suppliers", icon: Truck },
          { title: "Цеха", list: workshopBalances, type: "workshops", icon: Factory },
          { title: "Клиенты", list: clientBalances, type: "clients", icon: Users2 },
        ].map(({ title, list, type, icon: Icon }) => (
          <div key={type}>
            <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5"><Icon size={14} /> {title}</h3>
            {list.length === 0 ? (
              <p className="text-xs text-[#8A8578] italic">Долгов нет.</p>
            ) : (
              <div className="space-y-1.5">
                {list.map((x) => (
                  <button key={x.id} onClick={() => onOpen(type, x.id)}
                    className="w-full flex justify-between items-center text-sm bg-[#F6F1E4] border-2 border-[#1C2A39]/15 rounded-sm px-3 py-2 hover:border-[#1C2A39] text-left">
                    <span className="truncate">{x.name}</span>
                    <span className="font-mono font-semibold text-[#B33A3A] shrink-0 ml-2">{fmt(x.balance)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Root FinanceTab ---------- */

export default function FinanceTab({ clients }) {
  const [sub, setSub] = useState("summary");
  const [jumpTo, setJumpTo] = useState(null); // { type, id } from summary clicks

  const [suppliers, setSuppliers] = useState([]);
  const [supplierInvoices, setSupplierInvoices] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [workshopOrders, setWorkshopOrders] = useState([]);
  const [workshopPayments, setWorkshopPayments] = useState([]);
  const [clientDeliveries, setClientDeliveries] = useState([]);
  const [clientPayments, setClientPayments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const reload = async () => {
    try {
      const [sup, si, sp, ws, wo, wp, cd, cp] = await Promise.all([
        fetchSuppliers(), fetchSupplierInvoices(), fetchSupplierPayments(),
        fetchWorkshops(), fetchWorkshopOrders(), fetchWorkshopPayments(),
        fetchClientDeliveries(), fetchClientPayments(),
      ]);
      setSuppliers(sup); setSupplierInvoices(si); setSupplierPayments(sp);
      setWorkshops(ws); setWorkshopOrders(wo); setWorkshopPayments(wp);
      setClientDeliveries(cd); setClientPayments(cp);
      setLoadError(null);
    } catch (e) {
      setLoadError(e.message || "Не удалось загрузить данные");
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    reload();
    const interval = setInterval(reload, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (jumpTo) {
      setSub(jumpTo.type);
    }
  }, [jumpTo]);

  const withErrorHandling = (fn) => async (...args) => {
    try {
      await fn(...args);
      reload();
    } catch (e) {
      setLoadError(e.message);
    }
  };

  const saveSupplier = withErrorHandling(upsertSupplier);
  const removeSupplier = withErrorHandling(deleteSupplier);
  const saveSupplierInvoice = withErrorHandling(upsertSupplierInvoice);
  const removeSupplierInvoice = withErrorHandling(deleteSupplierInvoice);
  const saveSupplierPayment = withErrorHandling(upsertSupplierPayment);
  const removeSupplierPayment = withErrorHandling(deleteSupplierPayment);

  const saveWorkshop = withErrorHandling(upsertWorkshop);
  const removeWorkshop = withErrorHandling(deleteWorkshop);
  const saveWorkshopOrder = withErrorHandling(upsertWorkshopOrder);
  const removeWorkshopOrder = withErrorHandling(deleteWorkshopOrder);
  const saveWorkshopPayment = withErrorHandling(upsertWorkshopPayment);
  const removeWorkshopPayment = withErrorHandling(deleteWorkshopPayment);

  const saveClientDelivery = withErrorHandling(upsertClientDelivery);
  const removeClientDelivery = withErrorHandling(deleteClientDelivery);
  const saveClientPayment = withErrorHandling(upsertClientPayment);
  const removeClientPayment = withErrorHandling(deleteClientPayment);

  const subTabs = [
    { key: "summary", label: "Сводка", icon: Wallet },
    { key: "suppliers", label: "Поставщики", icon: Truck },
    { key: "workshops", label: "Цеха", icon: Factory },
    { key: "clients", label: "Клиенты", icon: Users2 },
  ];

  return (
    <div>
      <div className="flex gap-1 mb-5 flex-wrap">
        {subTabs.map((t) => {
          const Icon = t.icon;
          const active = sub === t.key;
          return (
            <button key={t.key} onClick={() => setSub(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-sm text-sm font-semibold border-2 transition-colors ${
                active ? "bg-[#1C2A39] text-[#F6F1E4] border-[#1C2A39]" : "border-[#1C2A39]/15 text-[#8A8578] hover:border-[#1C2A39]/40"
              }`}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {loadError && (
        <div className="mb-4 text-sm text-[#B33A3A] bg-[#B33A3A]/10 border-2 border-[#B33A3A]/30 rounded-sm px-3 py-2">
          Не удалось синхронизировать данные: {loadError}
        </div>
      )}

      {!loaded ? (
        <div className="text-center py-16 text-[#8A8578]">Загрузка...</div>
      ) : sub === "summary" ? (
        <SummaryTab
          suppliers={suppliers} supplierInvoices={supplierInvoices} supplierPayments={supplierPayments}
          workshops={workshops} workshopOrders={workshopOrders} workshopPayments={workshopPayments}
          clients={clients} clientDeliveries={clientDeliveries} clientPayments={clientPayments}
          onOpen={(type, id) => setJumpTo({ type, id })}
        />
      ) : sub === "suppliers" ? (
        <EntityListSection
          entities={suppliers} charges={supplierInvoices} payments={supplierPayments} direction="owe"
          entityLabel="Поставщики" entityFormTitle="Поставщик" chargeLabel="Накладная" chargeFormTitle="Новая накладная"
          itemLabel="Товарные позиции" extraLabel={null} paymentLabel="Оплата"
          onSaveEntity={saveSupplier} onDeleteEntity={removeSupplier}
          onSaveCharge={saveSupplierInvoice} onDeleteCharge={removeSupplierInvoice}
          onSavePayment={saveSupplierPayment} onDeletePayment={removeSupplierPayment}
        />
      ) : sub === "workshops" ? (
        <EntityListSection
          entities={workshops} charges={workshopOrders} payments={workshopPayments} direction="owe"
          entityLabel="Цеха" entityFormTitle="Цех" chargeLabel="Заказ" chargeFormTitle="Новый заказ в цех"
          itemLabel="Услуги" extraLabel="Размер бумаги" paymentLabel="Оплата"
          onSaveEntity={saveWorkshop} onDeleteEntity={removeWorkshop}
          onSaveCharge={saveWorkshopOrder} onDeleteCharge={removeWorkshopOrder}
          onSavePayment={saveWorkshopPayment} onDeletePayment={removeWorkshopPayment}
        />
      ) : (
        <EntityListSection
          entities={clients} charges={clientDeliveries} payments={clientPayments} direction="owed"
          entityLabel="Клиенты" entityFormTitle="Клиент" chargeLabel="Отгрузка" chargeFormTitle="Новая отгрузка"
          itemLabel="Позиции заказа" extraLabel={null} paymentLabel="Оплата клиента"
          onSaveEntity={() => {}} onDeleteEntity={() => {}}
          onSaveCharge={saveClientDelivery} onDeleteCharge={removeClientDelivery}
          onSavePayment={saveClientPayment} onDeletePayment={removeClientPayment}
          canCreate={false}
        />
      )}
    </div>
  );
}
