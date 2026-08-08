import { useState, useEffect } from "react";
import {
  Plus, X, Search, Phone, MessageCircle, Mail, Globe, Trash2, Edit3,
  Users, FileStack, ArrowLeft, History, ChevronRight
} from "lucide-react";
import PasswordGate from "./components/PasswordGate.jsx";
import LogoAndSettings, { getLogo } from "./components/LogoSettings.jsx";
import { supabaseConfigured } from "./lib/supabaseClient.js";
import { fetchClients, upsertClient, deleteClientRow, fetchOrders, upsertOrder, deleteOrderRow } from "./lib/db.js";

const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "telegram", label: "Telegram", icon: MessageCircle },
  { key: "email", label: "Email", icon: Mail },
  { key: "site", label: "Сайт", icon: Globe },
  { key: "phone", label: "Телефон", icon: Phone },
];
const SEGMENTS = ["Фастфуд", "Фарма", "Ритейл", "HoReCa", "Другое"];

const uid = () => Math.random().toString(36).slice(2, 10);

const emptyClient = () => ({ id: uid(), name: "", contact: "", channel: "whatsapp", segment: "Фастфуд", notes: "" });
const emptyOrder = () => ({
  id: uid(), name: "", clientId: "", material: "", sheetSize: "",
  materialPrice: "", materialPriceUnit: "сум/кг", cutSize: "", printSpec: "",
  postPress: "", notes: "", runs: [],
});
const emptyRun = () => ({ id: uid(), date: new Date().toISOString().slice(0, 10), qty: "", pricePerUnit: "", note: "" });

function fmt(n) {
  if (n === "" || n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toLocaleString("ru-RU");
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function latestRun(order) {
  if (!order.runs || order.runs.length === 0) return null;
  return [...order.runs].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
}

/* ---------- Clients ---------- */

function ClientForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="fixed inset-0 bg-[#1C2A39]/50 flex items-start sm:items-center justify-center z-50 p-3 overflow-y-auto">
      <div className="bg-[#F6F1E4] w-full max-w-md rounded-sm shadow-2xl border-2 border-[#1C2A39] my-6">
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#1C2A39]">
          <h2 className="font-bold text-lg">Клиент</h2>
          <button onClick={onCancel}><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8578] mb-1">Название клиента</label>
            <input autoFocus value={form.name} onChange={set("name")} placeholder="Асакар"
              className="w-full border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-3 py-2 bg-white" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8578] mb-1">Контакт</label>
            <input value={form.contact} onChange={set("contact")} placeholder="Имя, телефон"
              className="w-full border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-3 py-2 bg-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8578] mb-1">Канал</label>
              <select value={form.channel} onChange={set("channel")}
                className="w-full border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-3 py-2 bg-white">
                {CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8578] mb-1">Сегмент</label>
              <select value={form.segment} onChange={set("segment")}
                className="w-full border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-3 py-2 bg-white">
                {SEGMENTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8578] mb-1">Заметки</label>
            <textarea value={form.notes} onChange={set("notes")} rows={2}
              className="w-full border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-3 py-2 bg-white resize-none" />
          </div>
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

function ClientsTab({ clients, orders, onSaveClient, onDeleteClient, onOpenClientOrders }) {
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const filtered = clients.filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()));

  const save = (form) => {
    onSaveClient(form);
    setEditing(null);
  };
  const remove = (id) => onDeleteClient(id);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8578]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск клиента..."
            className="w-full pl-9 pr-3 py-2.5 rounded-sm border-2 border-[#1C2A39]/15 focus:border-[#1C2A39] outline-none bg-[#F6F1E4]" />
        </div>
        <button onClick={() => setEditing(emptyClient())}
          className="flex items-center gap-1.5 bg-[#1C2A39] text-[#F6F1E4] px-4 py-2.5 rounded-sm font-semibold whitespace-nowrap">
          <Plus size={16} /> Новый клиент
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-[#1C2A39]/20 rounded-sm text-[#8A8578]">
          {clients.length === 0 ? "Пока нет клиентов — добавьте первого." : "Ничего не найдено."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const channel = CHANNELS.find((ch) => ch.key === c.channel);
            const Icon = channel ? channel.icon : MessageCircle;
            const orderCount = orders.filter((o) => o.clientId === c.id).length;
            return (
              <div key={c.id} className="bg-[#F6F1E4] border-2 border-[#1C2A39]/15 rounded-sm px-4 py-3 flex items-center gap-4 hover:border-[#1C2A39]/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="font-bold">{c.name}</div>
                  <div className="text-sm text-[#8A8578] flex items-center gap-3 flex-wrap mt-1">
                    <span className="flex items-center gap-1"><Icon size={13} /> {c.contact || "—"}</span>
                    <span>{c.segment}</span>
                    <button onClick={() => onOpenClientOrders(c.id)} className="underline decoration-dotted hover:text-[#1C2A39]">
                      {orderCount} {orderCount === 1 ? "заказ" : "заказ(ов)"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditing(c)} className="p-2 rounded-sm hover:bg-[#1C2A39]/10"><Edit3 size={15} /></button>
                  <button onClick={() => remove(c.id)} className="p-2 rounded-sm hover:bg-[#B33A3A]/10 text-[#B33A3A]"><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing && <ClientForm initial={editing} onSave={save} onCancel={() => setEditing(null)} />}
    </div>
  );
}

/* ---------- Orders ---------- */

function OrderForm({ initial, clients, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="fixed inset-0 bg-[#1C2A39]/50 flex items-start sm:items-center justify-center z-50 p-3 overflow-y-auto">
      <div className="bg-[#F6F1E4] w-full max-w-lg rounded-sm shadow-2xl border-2 border-[#1C2A39] my-6">
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#1C2A39]">
          <h2 className="font-bold text-lg">Карточка заказа</h2>
          <button onClick={onCancel}><X size={20} /></button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8578] mb-1">Название заказа</label>
            <input autoFocus value={form.name} onChange={set("name")} placeholder="Бирка: Саитекс"
              className="w-full border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-3 py-2 bg-white" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8578] mb-1">Клиент</label>
            <select value={form.clientId} onChange={set("clientId")}
              className="w-full border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-3 py-2 bg-white">
              <option value="">— выбрать клиента —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8578] mb-1">Материал (плотность, тип)</label>
            <input value={form.material} onChange={set("material")} placeholder="210 гр FBB"
              className="w-full border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-3 py-2 bg-white font-mono" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8578] mb-1">Размер бумаги (закупка)</label>
            <input value={form.sheetSize} onChange={set("sheetSize")} placeholder="100×70 см"
              className="w-full border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-3 py-2 bg-white font-mono" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8578] mb-1">Цена закупки картона</label>
            <div className="flex gap-1">
              <input value={form.materialPrice} onChange={set("materialPrice")} placeholder="21000"
                className="w-full border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-3 py-2 bg-white font-mono" />
              <select value={form.materialPriceUnit} onChange={set("materialPriceUnit")}
                className="border-2 border-[#1C2A39]/20 outline-none rounded-sm px-2 bg-white text-sm">
                <option>сум/кг</option>
                <option>сум/лист</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8578] mb-1">Размер реза</label>
            <input value={form.cutSize} onChange={set("cutSize")} placeholder="35×50 см"
              className="w-full border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-3 py-2 bg-white font-mono" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8578] mb-1">Печать</label>
            <input value={form.printSpec} onChange={set("printSpec")} placeholder="4+4, + Pantone Gold"
              className="w-full border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-3 py-2 bg-white font-mono" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8578] mb-1">Постпечать</label>
            <textarea value={form.postPress} onChange={set("postPress")} rows={2}
              placeholder="Матовая ламинация с двух сторон, тиснение цвет голд, выборочный лак, конгрев"
              className="w-full border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-3 py-2 bg-white resize-none" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8578] mb-1">Заметки</label>
            <textarea value={form.notes} onChange={set("notes")} rows={2}
              className="w-full border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-3 py-2 bg-white resize-none" />
          </div>
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

function RunForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="fixed inset-0 bg-[#1C2A39]/50 flex items-center justify-center z-50 p-3">
      <div className="bg-[#F6F1E4] w-full max-w-sm rounded-sm shadow-2xl border-2 border-[#1C2A39]">
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#1C2A39]">
          <h2 className="font-bold text-lg">Новый выпуск</h2>
          <button onClick={onCancel}><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8578] mb-1">Дата выпуска</label>
            <input type="date" value={form.date} onChange={set("date")}
              className="w-full border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-3 py-2 bg-white" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8578] mb-1">Тираж, шт.</label>
            <input value={form.qty} onChange={set("qty")} placeholder="10000" inputMode="numeric"
              className="w-full border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-3 py-2 bg-white font-mono" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8578] mb-1">Цена за шт.</label>
            <input value={form.pricePerUnit} onChange={set("pricePerUnit")} placeholder="230" inputMode="numeric"
              className="w-full border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-3 py-2 bg-white font-mono" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8578] mb-1">Заметка</label>
            <input value={form.note} onChange={set("note")} placeholder="Необязательно"
              className="w-full border-2 border-[#1C2A39]/20 focus:border-[#1C2A39] outline-none rounded-sm px-3 py-2 bg-white" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t-2 border-[#1C2A39]">
          <button onClick={onCancel} className="px-4 py-2 rounded-sm font-semibold border-2 border-[#1C2A39]/20">Отмена</button>
          <button onClick={() => onSave(form)} disabled={!form.qty}
            className="px-4 py-2 rounded-sm bg-[#1C2A39] text-[#F6F1E4] font-semibold disabled:opacity-40">Сохранить</button>
        </div>
      </div>
    </div>
  );
}

function SpecRow({ label, value, mono }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-dashed border-[#1C2A39]/15 text-sm">
      <span className="text-[#8A8578]">{label}</span>
      <span className={`text-right font-semibold ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
    </div>
  );
}

function OrderDetail({ order, client, onBack, onEdit, onDelete, onAddRun, onDeleteRun }) {
  const runs = [...(order.runs || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  const last = runs[0];
  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-[#8A8578] hover:text-[#1C2A39] mb-4">
        <ArrowLeft size={15} /> Все заказы
      </button>
      <div className="bg-[#F6F1E4] border-2 border-[#1C2A39] rounded-sm p-5 mb-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="display-font text-3xl leading-none">{order.name}</h2>
            <p className="text-[#8A8578] text-sm mt-1">{client ? client.name : "Клиент не указан"}</p>
          </div>
          <div className="flex gap-1">
            <button onClick={onEdit} className="p-2 rounded-sm hover:bg-[#1C2A39]/10"><Edit3 size={16} /></button>
            <button onClick={onDelete} className="p-2 rounded-sm hover:bg-[#B33A3A]/10 text-[#B33A3A]"><Trash2 size={16} /></button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-8">
          <div>
            <SpecRow label="Материал" value={order.material} mono />
            <SpecRow label="Размер бумаги (закупка)" value={order.sheetSize} mono />
            <SpecRow label="Цена закупки" value={order.materialPrice ? `${fmt(order.materialPrice)} ${order.materialPriceUnit}` : ""} mono />
            <SpecRow label="Размер реза" value={order.cutSize} mono />
          </div>
          <div>
            <SpecRow label="Печать" value={order.printSpec} mono />
            <SpecRow label="Постпечать" value={order.postPress} />
            <SpecRow label="Последний выпуск" value={last ? fmtDate(last.date) : "не выпускался"} />
            <SpecRow label="Последняя цена / тираж" value={last ? `${fmt(last.pricePerUnit)} сум/шт · ${fmt(last.qty)} шт.` : ""} mono />
          </div>
        </div>
        {order.notes && (
          <div className="mt-3 pt-3 border-t border-dashed border-[#1C2A39]/15 text-sm text-[#8A8578] italic">
            {order.notes}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold flex items-center gap-2"><History size={16} /> История выпусков</h3>
        <button onClick={onAddRun} className="flex items-center gap-1.5 bg-[#1C2A39] text-[#F6F1E4] px-3 py-2 rounded-sm text-sm font-semibold">
          <Plus size={14} /> Новый выпуск
        </button>
      </div>
      {runs.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-[#1C2A39]/20 rounded-sm text-[#8A8578] text-sm">
          Выпусков ещё не было — добавьте первый.
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((r) => (
            <div key={r.id} className="bg-[#F6F1E4] border-2 border-[#1C2A39]/15 rounded-sm px-4 py-3 flex items-center gap-4">
              <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
                <span className="font-semibold">{fmtDate(r.date)}</span>
                <span className="font-mono">{fmt(r.qty)} шт.</span>
                <span className="font-mono">{fmt(r.pricePerUnit)} сум/шт</span>
              </div>
              {r.note && <span className="text-xs text-[#8A8578] italic hidden sm:block">{r.note}</span>}
              <button onClick={() => onDeleteRun(r.id)} className="p-1.5 rounded-sm hover:bg-[#B33A3A]/10 text-[#B33A3A]">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrdersTab({ orders, clients, onSaveOrder, onDeleteOrder, focusClientId, clearFocus }) {
  const [editing, setEditing] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [addingRun, setAddingRun] = useState(false);
  const [query, setQuery] = useState("");
  const clientName = (id) => clients.find((c) => c.id === id)?.name || "—";

  const filtered = orders.filter((o) => {
    const matchesQuery = !query || o.name.toLowerCase().includes(query.toLowerCase()) || clientName(o.clientId).toLowerCase().includes(query.toLowerCase());
    const matchesClient = !focusClientId || o.clientId === focusClientId;
    return matchesQuery && matchesClient;
  });

  const saveOrder = (form) => {
    onSaveOrder(form);
    setEditing(null);
  };
  const deleteOrder = (id) => {
    onDeleteOrder(id);
    setOpenId(null);
  };
  const saveRun = (form) => {
    const order = orders.find((o) => o.id === openId);
    if (!order) return;
    onSaveOrder({ ...order, runs: [...(order.runs || []), form] });
    setAddingRun(false);
  };
  const deleteRun = (runId) => {
    const order = orders.find((o) => o.id === openId);
    if (!order) return;
    onSaveOrder({ ...order, runs: order.runs.filter((r) => r.id !== runId) });
  };

  const openOrder = orders.find((o) => o.id === openId);

  if (openOrder) {
    return (
      <>
        <OrderDetail
          order={openOrder}
          client={clients.find((c) => c.id === openOrder.clientId)}
          onBack={() => setOpenId(null)}
          onEdit={() => setEditing(openOrder)}
          onDelete={() => deleteOrder(openOrder.id)}
          onAddRun={() => setAddingRun(true)}
          onDeleteRun={deleteRun}
        />
        {addingRun && <RunForm initial={emptyRun()} onSave={saveRun} onCancel={() => setAddingRun(false)} />}
        {editing && <OrderForm initial={editing} clients={clients} onSave={saveOrder} onCancel={() => setEditing(null)} />}
      </>
    );
  }

  return (
    <div>
      {focusClientId && (
        <button onClick={clearFocus} className="flex items-center gap-1 text-sm font-semibold text-[#8A8578] hover:text-[#1C2A39] mb-3">
          <ArrowLeft size={15} /> Все заказы · сейчас: {clientName(focusClientId)}
        </button>
      )}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8578]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск заказа или клиента..."
            className="w-full pl-9 pr-3 py-2.5 rounded-sm border-2 border-[#1C2A39]/15 focus:border-[#1C2A39] outline-none bg-[#F6F1E4]" />
        </div>
        <button onClick={() => setEditing(emptyOrder())}
          className="flex items-center gap-1.5 bg-[#1C2A39] text-[#F6F1E4] px-4 py-2.5 rounded-sm font-semibold whitespace-nowrap">
          <Plus size={16} /> Новый заказ
        </button>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-[#1C2A39]/20 rounded-sm text-[#8A8578]">
          {orders.length === 0 ? "Пока нет заказов — добавьте первый." : "Ничего не найдено."}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((o) => {
            const last = latestRun(o);
            return (
              <button key={o.id} onClick={() => setOpenId(o.id)}
                className="text-left bg-[#F6F1E4] border-2 border-[#1C2A39]/15 rounded-sm p-4 hover:border-[#1C2A39] transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold">{o.name || "Без названия"}</div>
                    <div className="text-sm text-[#8A8578]">{clientName(o.clientId)}</div>
                  </div>
                  <ChevronRight size={16} className="text-[#8A8578] mt-1" />
                </div>
                <div className="mt-2 text-xs text-[#8A8578] font-mono">{o.material || "материал не указан"}</div>
                <div className="mt-2 pt-2 border-t border-dashed border-[#1C2A39]/15 text-xs flex justify-between">
                  <span className="text-[#8A8578]">Последний выпуск</span>
                  <span className="font-semibold">{last ? `${fmtDate(last.date)} · ${fmt(last.qty)} шт.` : "не выпускался"}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {editing && <OrderForm initial={editing} clients={clients} onSave={saveOrder} onCancel={() => setEditing(null)} />}
    </div>
  );
}

/* ---------- App shell ---------- */

function SetupNeeded() {
  return (
    <div className="min-h-screen bg-[#EDE6D6] flex items-center justify-center p-4 body-font">
      <div className="bg-[#F6F1E4] border-2 border-[#1C2A39] rounded-sm shadow-2xl p-6 w-full max-w-md">
        <h1 className="display-font text-2xl mb-2 text-[#1C2A39]">База данных не подключена</h1>
        <p className="text-sm text-[#8A8578] mb-3">
          Чтобы все пользователи видели одни и те же заказы и клиентов, сайту нужен
          Supabase. Задайте переменные окружения <code className="font-mono">VITE_SUPABASE_URL</code> и{" "}
          <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> при деплое — шаги описаны в README.md.
        </p>
      </div>
    </div>
  );
}

function MainApp() {
  const [tab, setTab] = useState("clients");
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [focusClientId, setFocusClientId] = useState(null);
  const [logo, setLogo] = useState(() => getLogo());

  const reload = async () => {
    try {
      const [c, o] = await Promise.all([fetchClients(), fetchOrders()]);
      setClients(c);
      setOrders(o);
      setLoadError(null);
    } catch (e) {
      setLoadError(e.message || "Не удалось загрузить данные");
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    reload();
    // Обновляем данные каждые 8 секунд, чтобы видеть изменения других пользователей
    const interval = setInterval(reload, 8000);
    return () => clearInterval(interval);
  }, []);

  const saveClient = async (client) => {
    setClients((prev) => (prev.some((c) => c.id === client.id) ? prev.map((c) => (c.id === client.id ? client : c)) : [client, ...prev]));
    try {
      await upsertClient(client);
    } catch (e) {
      setLoadError(e.message);
    }
  };
  const removeClient = async (id) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    try {
      await deleteClientRow(id);
    } catch (e) {
      setLoadError(e.message);
    }
  };
  const saveOrder = async (order) => {
    setOrders((prev) => (prev.some((o) => o.id === order.id) ? prev.map((o) => (o.id === order.id ? order : o)) : [order, ...prev]));
    try {
      await upsertOrder(order);
    } catch (e) {
      setLoadError(e.message);
    }
  };
  const removeOrder = async (id) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
    try {
      await deleteOrderRow(id);
    } catch (e) {
      setLoadError(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#EDE6D6] text-[#1C2A39] body-font">
      <header className="border-b-4 border-[#1C2A39] bg-[#F6F1E4]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoAndSettings logo={logo} setLogo={setLogo} />
            <div>
              <h1 className="display-font text-3xl leading-none">РЕЕСТР ЗАКАЗОВ</h1>
              <p className="text-xs text-[#8A8578] tracking-wide">Клиенты и техкарты выпущенной продукции</p>
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex gap-1">
          <button onClick={() => setTab("clients")}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-4 font-semibold text-sm transition-colors ${
              tab === "clients" ? "border-[#1C2A39] text-[#1C2A39]" : "border-transparent text-[#8A8578] hover:text-[#1C2A39]"
            }`}>
            <Users size={15} /> Клиент
          </button>
          <button onClick={() => setTab("orders")}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-4 font-semibold text-sm transition-colors ${
              tab === "orders" ? "border-[#1C2A39] text-[#1C2A39]" : "border-transparent text-[#8A8578] hover:text-[#1C2A39]"
            }`}>
            <FileStack size={15} /> Заказ
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {loadError && (
          <div className="mb-4 text-sm text-[#B33A3A] bg-[#B33A3A]/10 border-2 border-[#B33A3A]/30 rounded-sm px-3 py-2">
            Не удалось синхронизировать данные: {loadError}
          </div>
        )}
        {!loaded ? (
          <div className="text-center py-16 text-[#8A8578]">Загрузка...</div>
        ) : tab === "clients" ? (
          <ClientsTab
            clients={clients}
            orders={orders}
            onSaveClient={saveClient}
            onDeleteClient={removeClient}
            onOpenClientOrders={(id) => { setFocusClientId(id); setTab("orders"); }}
          />
        ) : (
          <OrdersTab
            orders={orders}
            clients={clients}
            onSaveOrder={saveOrder}
            onDeleteOrder={removeOrder}
            focusClientId={focusClientId}
            clearFocus={() => setFocusClientId(null)}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  if (!supabaseConfigured) return <SetupNeeded />;
  return (
    <PasswordGate>
      <MainApp />
    </PasswordGate>
  );
}
