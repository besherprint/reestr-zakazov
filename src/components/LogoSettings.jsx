import { useRef, useState } from "react";
import { Package, Settings, Upload, X, LogOut } from "lucide-react";

const LOGO_KEY = "reestr-logo";
const AUTH_KEY = "reestr-auth-ok";

export function getLogo() {
  return localStorage.getItem(LOGO_KEY) || null;
}

export default function LogoAndSettings({ logo, setLogo }) {
  const fileRef = useRef(null);
  const [open, setOpen] = useState(false);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      localStorage.setItem(LOGO_KEY, reader.result);
      setLogo(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    localStorage.removeItem(LOGO_KEY);
    setLogo(null);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 rounded-full border-2 border-[#1C2A39] flex items-center justify-center rotate-3 overflow-hidden bg-white">
        {logo ? (
          <img src={logo} alt="Логотип" className="w-full h-full object-contain p-1" />
        ) : (
          <Package size={20} />
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="p-2 rounded-sm hover:bg-[#1C2A39]/10 text-[#8A8578]"
          aria-label="Настройки"
        >
          <Settings size={16} />
        </button>
        {open && (
          <div className="absolute left-0 top-10 z-10 bg-[#F6F1E4] border-2 border-[#1C2A39] rounded-sm shadow-xl p-3 w-52 text-sm">
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-sm hover:bg-[#1C2A39]/10 text-left"
            >
              <Upload size={14} /> Загрузить логотип
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            {logo && (
              <button
                onClick={removeLogo}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-sm hover:bg-[#B33A3A]/10 text-[#B33A3A] text-left"
              >
                <X size={14} /> Убрать логотип
              </button>
            )}
            <div className="border-t border-[#1C2A39]/15 my-1" />
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-sm hover:bg-[#1C2A39]/10 text-left"
            >
              <LogOut size={14} /> Выйти
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
