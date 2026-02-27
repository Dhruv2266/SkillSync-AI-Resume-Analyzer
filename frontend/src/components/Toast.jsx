import { useEffect } from "react";
import { motion } from "framer-motion";

const STYLES = {
  error: {
    wrapper: "bg-red-950/90 border-red-500/40 text-red-200",
    icon: "❌",
    title: "Error",
  },
  success: {
    wrapper: "bg-emerald-950/90 border-emerald-500/40 text-emerald-200",
    icon: "✅",
    title: "Success",
  },
  info: {
    wrapper: "bg-slate-900/90 border-slate-500/40 text-slate-200",
    icon: "ℹ️",
    title: "Info",
  },
};

export default function Toast({ message, type = "error", onClose }) {
  const style = STYLES[type] || STYLES.error;

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`
        fixed bottom-6 left-1/2 -translate-x-1/2 z-50
        flex items-start gap-3 px-5 py-4 rounded-2xl border
        backdrop-blur-xl shadow-2xl max-w-md w-[90vw]
        ${style.wrapper}
      `}
    >
      <span className="text-lg flex-shrink-0 mt-0.5">{style.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{style.title}</p>
        <p className="text-xs mt-0.5 opacity-80 leading-relaxed">{message}</p>
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity text-lg leading-none mt-0.5"
        aria-label="Dismiss"
      >
        ×
      </button>
    </motion.div>
  );
}
