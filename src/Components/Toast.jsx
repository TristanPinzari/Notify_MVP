import { IoIosCheckmarkCircleOutline } from "react-icons/io";
import { VscError } from "react-icons/vsc";
import { MdErrorOutline, MdClose } from "react-icons/md";

const typeStyles = {
  success: "bg-green-500/20 border-green-500/30",
  error: "bg-red-500/20 border-red-500/30",
  neutral: "bg-[#1a1714] border-white/10",
};

const iconStyles = {
  success: "text-green-400",
  error: "text-red-400",
  neutral: "text-amber-400",
};

const iconTable = {
  success: (cls) => (
    <IoIosCheckmarkCircleOutline className={`text-xl shrink-0 ${cls}`} />
  ),
  error: (cls) => <VscError className={`text-xl shrink-0 ${cls}`} />,
  neutral: (cls) => <MdErrorOutline className={`text-xl shrink-0 ${cls}`} />,
};

const Toast = ({ style, type = "neutral", message, onClose }) => {
  const icon = iconTable[type]?.(iconStyles[type]) || null;

  return (
    <>
      <style>{`
        @keyframes fadeandslide {
          0%       { opacity: 0; transform: translateY(10px); }
          8%, 92%  { opacity: 1; transform: translateY(0); }
          100%     { opacity: 0; transform: translateY(10px); }
        }
        .toast-anim { animation: fadeandslide 3s ease-in-out forwards; }
      `}</style>
      <div
        style={style}
        className={`z-50 toast-anim absolute inset-0 flex items-center gap-3 px-4 rounded-xl border backdrop-blur-md ${typeStyles[type]}`}
      >
        {icon}
        <p className="flex-1 text-white/80 text-xs leading-snug">{message}</p>
        <MdClose
          className="text-white/30 hover:text-white/80 text-lg cursor-pointer transition-colors duration-200 shrink-0"
          onClick={onClose}
        />
      </div>
    </>
  );
};

export default Toast;
