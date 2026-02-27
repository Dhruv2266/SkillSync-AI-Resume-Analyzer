import { useEffect, useState } from "react";
import { motion } from "framer-motion";

// ── Helpers ────────────────────────────────────────────────────────────────

function scoreColor(pct) {
  if (pct >= 75) return { stroke: "#34d399", text: "text-emerald-500 dark:text-emerald-400", label: "Strong Match" };
  if (pct >= 50) return { stroke: "#f59e0b", text: "text-amber-500 dark:text-amber-400", label: "Moderate Match" };
  return { stroke: "#f87171", text: "text-red-500 dark:text-red-400", label: "Weak Match" };
}

// Spring-based stagger — snappier entry, physical deceleration
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 26 },
  },
};

// ── Main component ─────────────────────────────────────────────────────────

export default function ResultsDashboard({ results, role, onReset }) {
  const { match_percentage, matched_skills, missing_skills, hire_summary, basic_improvements } = results;
  const color = scoreColor(match_percentage);
  const isRecruiter = role === "recruiter";

  return (
    <section className="min-h-screen flex flex-col items-center px-6 py-20">
      <div className="w-full max-w-3xl">

        {/* Page title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="text-center mb-12"
        >
          <span className="text-slate-400 dark:text-slate-500 text-xs tracking-widest uppercase font-semibold">
            Analysis Complete
          </span>
          <h2 className="font-display text-4xl font-bold text-slate-900 dark:text-white mt-2">
            {isRecruiter ? "Candidate Report" : "Your Resume Report"}
          </h2>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* ── Score card ── */}
          <motion.div
            variants={itemVariants}
            className="bg-white/70 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-3xl p-8 flex flex-col sm:flex-row items-center gap-8 shadow-sm dark:shadow-none"
          >
            <CircularScore score={match_percentage} color={color} />
            <div className="text-center sm:text-left">
              <p className={`text-lg font-bold ${color.text}`}>{color.label}</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-xs leading-relaxed">
                The resume matches{" "}
                <span className="text-slate-900 dark:text-white font-semibold">
                  {match_percentage.toFixed(1)}%
                </span>{" "}
                of the job description based on TF-IDF cosine similarity across{" "}
                {matched_skills.length + missing_skills.length} keywords.
              </p>
            </div>
          </motion.div>

          {/* ── Skills grid ── */}
          <motion.div variants={itemVariants} className="grid sm:grid-cols-2 gap-4">
            <SkillsCard
              title="Matched Skills"
              skills={matched_skills}
              icon="✓"
              badgeClass="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              headerClass="text-emerald-600 dark:text-emerald-400"
              emptyMsg="No matching keywords detected."
            />
            <SkillsCard
              title="Missing Skills"
              skills={missing_skills}
              icon="✕"
              badgeClass="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-300"
              headerClass="text-red-500 dark:text-red-400"
              emptyMsg="No skill gaps — great coverage!"
            />
          </motion.div>

          {/* ── Role-specific section ── */}
          {isRecruiter && hire_summary ? (
            <motion.div variants={itemVariants}>
              <HireSummaryCard summary={hire_summary} />
            </motion.div>
          ) : !isRecruiter && basic_improvements ? (
            <motion.div variants={itemVariants}>
              <ImprovementsCard improvements={basic_improvements} />
            </motion.div>
          ) : null}

          {/* ── Reset button ── */}
          <motion.div variants={itemVariants} className="pt-2 text-center">
            <motion.button
              onClick={onReset}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="px-8 py-3 rounded-xl border
                border-slate-200 dark:border-white/10
                bg-white/60 dark:bg-white/[0.04]
                text-slate-500 dark:text-slate-400
                hover:text-slate-900 dark:hover:text-white
                hover:border-slate-400 dark:hover:border-white/20
                hover:bg-slate-50 dark:hover:bg-white/[0.07]
                transition-all duration-200 text-sm font-semibold shadow-sm dark:shadow-none"
            >
              ← Analyze Another Resume
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ── Circular progress indicator ────────────────────────────────────────────

function CircularScore({ score, color }) {
  const [animated, setAnimated] = useState(0);

  const size = 140;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;

  useEffect(() => {
    let start = null;
    const duration = 1100;
    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimated(eased * score);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [score]);

  return (
    <div className="relative flex-shrink-0">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="#e2e8f0"
          className="dark:[stroke:#1e293b]"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.05s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold font-display ${color.text}`}>
          {animated.toFixed(0)}<span className="text-lg">%</span>
        </span>
      </div>
    </div>
  );
}

// ── Skill badge card ───────────────────────────────────────────────────────

function SkillsCard({ title, skills, icon, badgeClass, headerClass, emptyMsg }) {
  return (
    <div className="bg-white/70 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-none">
      <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 ${headerClass}`}>
        {title}{" "}
        <span className="font-normal text-slate-400 dark:text-slate-500 normal-case">
          ({skills.length})
        </span>
      </h3>
      {skills.length === 0 ? (
        <p className="text-slate-400 dark:text-slate-500 text-xs italic">{emptyMsg}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <motion.span
              key={skill}
              initial={{ opacity: 0, scale: 0.75 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 360, damping: 22 }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${badgeClass}`}
            >
              <span className="text-[9px]">{icon}</span>
              {skill}
            </motion.span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Hire summary card (Recruiter) ──────────────────────────────────────────

function HireSummaryCard({ summary }) {
  return (
    <div className="bg-violet-50 dark:bg-violet-500/[0.07] border border-violet-200 dark:border-violet-500/25 rounded-2xl p-6 shadow-sm dark:shadow-none">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🔍</span>
        <h3 className="text-sm font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300">
          Hire Recommendation
        </h3>
      </div>
      <p className="text-slate-600 dark:text-slate-300 text-sm leading-7">{summary}</p>
    </div>
  );
}

// ── Improvements list (Applier) ────────────────────────────────────────────

function ImprovementsCard({ improvements }) {
  return (
    <div className="bg-cyan-50 dark:bg-cyan-500/[0.07] border border-cyan-200 dark:border-cyan-500/25 rounded-2xl p-6 shadow-sm dark:shadow-none">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-lg">💡</span>
        <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-300">
          Basic Improvements
        </h3>
      </div>
      <ul className="space-y-3">
        {improvements.map((tip, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 24, delay: i * 0.06 }}
            className="flex items-start gap-3 text-slate-600 dark:text-slate-300 text-sm leading-relaxed"
          >
            <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full
              bg-cyan-100 dark:bg-cyan-500/20
              border border-cyan-300 dark:border-cyan-500/40
              flex items-center justify-center
              text-cyan-600 dark:text-cyan-300
              text-[10px] font-bold">
              {i + 1}
            </span>
            {tip}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
