import { useState } from "react";
import { Lock } from "lucide-react";

const AUTH_KEY = "reestr-auth-ok";

// Пароль задаётся через переменную окружения VITE_SITE_PASSWORD
// (см. README.md — как задать его на Vercel/Netlify, не храня в коде).
// Если переменная не задана, используется пароль по умолчанию "reestr2026" —
// обязательно смените его перед тем, как открывать доступ доверенным лицам.
const SITE_PASSWORD = import.meta.env.VITE_SITE_PASSWORD || "reestr2026";

export function isAuthed() {
  return localStorage.getItem(AUTH_KEY) === "1";
}

export default function PasswordGate({ children }) {
  const [authed, setAuthed] = useState(isAuthed());
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  if (authed) return children;

  const submit = (e) => {
    e.preventDefault();
    if (value === SITE_PASSWORD) {
      localStorage.setItem(AUTH_KEY, "1");
      setAuthed(true);
    } else {
      setError(true);
      setValue("");
    }
  };

  return (
    <div className="min-h-screen bg-[#EDE6D6] flex items-center justify-center p-4 body-font">
      <form
        onSubmit={submit}
        className="bg-[#F6F1E4] border-2 border-[#1C2A39] rounded-sm shadow-2xl p-6 w-full max-w-xs"
      >
        <div className="w-11 h-11 rounded-full border-2 border-[#1C2A39] flex items-center justify-center mb-4">
          <Lock size={18} className="text-[#1C2A39]" />
        </div>
        <h1 className="display-font text-2xl mb-1 text-[#1C2A39]">Доступ ограничен</h1>
        <p className="text-sm text-[#8A8578] mb-4">
          Введите пароль, чтобы открыть реестр заказов.
        </p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          placeholder="Пароль"
          className={`w-full border-2 outline-none rounded-sm px-3 py-2 bg-white text-[#1C2A39] mb-2 ${
            error ? "border-[#B33A3A]" : "border-[#1C2A39]/20 focus:border-[#1C2A39]"
          }`}
        />
        {error && <p className="text-xs text-[#B33A3A] mb-2">Неверный пароль, попробуйте ещё раз.</p>}
        <button
          type="submit"
          className="w-full bg-[#1C2A39] text-[#F6F1E4] font-semibold py-2 rounded-sm hover:bg-[#0f1822] mt-2"
        >
          Войти
        </button>
      </form>
    </div>
  );
}
