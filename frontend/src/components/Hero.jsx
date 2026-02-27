import { motion } from "framer-motion";

// Spring-based stagger for a more dynamic, physical feel
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 32, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 26 },
  },
};

export default function Hero({ onRoleSelect, activeRole }) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-28 pb-32">

      {/* Decorative grid lines — visible in dark, barely-there in light */}
      <div
        className="absolute inset-0 opacity-[0.04] dark:opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Top badge */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 24, delay: 0.05 }}
        className="mb-8 flex items-center gap-2 px-4 py-1.5 rounded-full
          border border-violet-400/40 dark:border-violet-500/30
          bg-violet-100/60 dark:bg-violet-500/10
          text-violet-600 dark:text-violet-300
          text-xs tracking-widest uppercase font-semibold"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 dark:bg-violet-400 animate-pulse" />
        AI-Powered · No LLMs · Pure ML
      </motion.div>

      {/* Main copy */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="text-center max-w-4xl"
      >
        {/* ── SkillSync wordmark ── */}
        <motion.h1
          variants={itemVariants}
          className="font-display text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight mb-6"
        >
          <span className="text-slate-900 dark:text-white">Skill</span>
          <span className="bg-gradient-to-r from-violet-500 via-cyan-400 to-violet-500 dark:from-violet-400 dark:via-cyan-300 dark:to-violet-400 bg-clip-text text-transparent bg-[length:200%] animate-shimmer">
            Sync
          </span>
          <span className="text-slate-900 dark:text-white">.</span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="text-slate-500 dark:text-slate-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-4"
        >
          Upload a resume and a job description. Our TF-IDF + Cosine Similarity
          engine scores the match, surfaces skill gaps, and gives you
          role-specific insights — in seconds.
        </motion.p>

        {/* How it works — 3-step inline */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-0 mb-14 text-sm text-slate-400 dark:text-slate-500"
        >
          {["Upload PDFs", "ML Analysis", "Actionable Results"].map((step, i) => (
            <span key={step} className="flex items-center gap-3">
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 flex items-center justify-center text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                  {i + 1}
                </span>
                {step}
              </span>
              {i < 2 && (
                <span className="hidden sm:block text-slate-300 dark:text-slate-700 mx-2">→</span>
              )}
            </span>
          ))}
        </motion.div>

        {/* Role selector buttons */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <RoleButton
            label="I'm a Recruiter"
            subtitle="Evaluate candidate fit"
            icon="🔍"
            role="recruiter"
            activeRole={activeRole}
            onClick={() => onRoleSelect("recruiter")}
            accentClass="border-violet-300/60 dark:border-violet-500/60 hover:border-violet-500 dark:hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10"
            activeAccent="border-violet-500 dark:border-violet-400 bg-violet-50 dark:bg-violet-500/15 shadow-[0_0_30px_rgba(139,92,246,0.15)] dark:shadow-[0_0_30px_rgba(139,92,246,0.2)]"
          />
          <RoleButton
            label="I'm a Job Seeker"
            subtitle="Optimize your resume"
            icon="🚀"
            role="applier"
            activeRole={activeRole}
            onClick={() => onRoleSelect("applier")}
            accentClass="border-cyan-300/60 dark:border-cyan-500/60 hover:border-cyan-500 dark:hover:border-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10"
            activeAccent="border-cyan-500 dark:border-cyan-400 bg-cyan-50 dark:bg-cyan-500/15 shadow-[0_0_30px_rgba(34,211,238,0.12)] dark:shadow-[0_0_30px_rgba(34,211,238,0.2)]"
          />
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-400 dark:text-slate-600 text-xs"
      >
        <span>scroll down after selecting</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        >
          ↓
        </motion.div>
      </motion.div>

      {/* Footer */}
      <footer className="absolute bottom-4 left-0 right-0 text-center text-slate-400 dark:text-slate-700 text-xs">
        Built with FastAPI · scikit-learn · React · TailwindCSS ·{" "}
        <a
          href="mailto:hello@example.com"
          className="hover:text-violet-500 dark:hover:text-slate-500 transition-colors"
        >
          hello@example.com
        </a>
      </footer>
    </section>
  );
}

// ── Sub-component ──────────────────────────────────────────────────────────

function RoleButton({ label, subtitle, icon, role, activeRole, onClick, accentClass, activeAccent }) {
  const isActive = activeRole === role;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={`
        relative group w-64 px-6 py-5 rounded-2xl border
        bg-white/60 dark:bg-white/[0.03]
        backdrop-blur-sm text-left transition-all duration-300
        ${isActive ? activeAccent : accentClass}
      `}
    >
      <span className="text-2xl mb-2 block">{icon}</span>
      <span className="block text-slate-900 dark:text-white font-semibold text-base">{label}</span>
      <span className="block text-slate-400 dark:text-slate-500 text-xs mt-0.5">{subtitle}</span>
      {isActive && (
        <motion.span
          layoutId="activeIndicator"
          className="absolute top-3 right-3 w-2 h-2 rounded-full"
          style={{ backgroundColor: role === "recruiter" ? "#8b5cf6" : "#06b6d4" }}
        />
      )}
    </motion.button>
  );
}
