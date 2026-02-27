import { motion } from "framer-motion";

/**
 * Navbar.jsx
 * ----------
 * Fixed top navigation bar containing the SkillSync wordmark and the
 * dark / light mode toggle. Kept minimal so it doesn't compete with
 * the Hero section below it.
 */
export default function Navbar({ isDark, onToggleDark }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4">
      {/* Glass-morphism pill — adapts to both modes */}
      <div className="absolute inset-0 bg-white/60 dark:bg-black/40 backdrop-blur-md border-b border-black/5 dark:border-white/5" />

      {/* Wordmark */}
      <span className="relative font-display font-bold text-lg tracking-tight text-slate-900 dark:text-white select-none">
        Skill<span className="text-violet-500 dark:text-violet-400">Sync</span>
      </span>

      {/* Dark / Light toggle */}
      <motion.button
        onClick={onToggleDark}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="relative flex items-center gap-2 px-3 py-1.5 rounded-full border
          border-slate-200 dark:border-white/10
          bg-white/80 dark:bg-white/5
          text-slate-600 dark:text-slate-300
          hover:border-violet-400 dark:hover:border-violet-500
          transition-all duration-200 text-xs font-semibold"
      >
        {/* Animated icon swap */}
        <motion.span
          key={isDark ? "moon" : "sun"}
          initial={{ opacity: 0, rotate: -30, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="text-sm"
        >
          {isDark ? "☀️" : "🌙"}
        </motion.span>
        <span className="hidden sm:inline">
          {isDark ? "Light mode" : "Dark mode"}
        </span>
      </motion.button>
    </header>
  );
}
