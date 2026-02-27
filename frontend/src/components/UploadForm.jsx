import { useState, useCallback } from "react";
import { motion } from "framer-motion";

const ROLE_META = {
  recruiter: {
    label: "Recruiter Analysis",
    desc: "We'll score the match, surface skill gaps, and generate a hire recommendation.",
    badge: "bg-violet-100 dark:bg-violet-500/15 border-violet-300 dark:border-violet-500/40 text-violet-600 dark:text-violet-300",
    button: "from-violet-600 to-violet-500 shadow-violet-500/30 hover:shadow-violet-500/50",
    dropzone: "border-violet-300/70 dark:border-violet-500/40 hover:border-violet-500 dark:hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/5",
    active: "border-violet-500 dark:border-violet-400 bg-violet-50 dark:bg-violet-500/10",
  },
  applier: {
    label: "Job Seeker Analysis",
    desc: "We'll show your match score, what skills you're missing, and how to improve.",
    badge: "bg-cyan-100 dark:bg-cyan-500/15 border-cyan-300 dark:border-cyan-500/40 text-cyan-600 dark:text-cyan-300",
    button: "from-cyan-600 to-cyan-500 shadow-cyan-500/30 hover:shadow-cyan-500/50",
    dropzone: "border-cyan-300/70 dark:border-cyan-500/40 hover:border-cyan-500 dark:hover:border-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/5",
    active: "border-cyan-500 dark:border-cyan-400 bg-cyan-50 dark:bg-cyan-500/10",
  },
};

// onBack — triggers handleReset in App.jsx, returning user to role selection
export default function UploadForm({ role, isLoading, onSubmit, onBack }) {
  const [resumeFile, setResumeFile] = useState(null);
  const [jdFile, setJdFile] = useState(null);
  const [sizeError, setSizeError] = useState(null);  // inline size-error message

  const meta = ROLE_META[role];
  const canSubmit = resumeFile && jdFile && !isLoading;

  // Called by either Dropzone when the chosen file exceeds 1 MB
  const showSizeToast = (message) => {
    setSizeError(message);
    setTimeout(() => setSizeError(null), 5000); // auto-clear after 5 s
  };

  const handleSubmit = () => {
    if (canSubmit) onSubmit(resumeFile, jdFile);
  };

  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-2xl">

        {/* ── Back button ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 28, delay: 0.05 }}
          className="mb-8"
        >
          <motion.button
            onClick={onBack}
            disabled={isLoading}
            whileHover={{ x: -3 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="inline-flex items-center gap-2 text-sm font-semibold
              text-slate-500 dark:text-slate-400
              hover:text-violet-600 dark:hover:text-violet-300
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors duration-150"
          >
            <span className="text-base leading-none">←</span>
            Back to Roles
          </motion.button>
        </motion.div>

        {/* ── Section header ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="text-center mb-10"
        >
          <span
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold tracking-wider uppercase mb-4 ${meta.badge}`}
          >
            {role === "recruiter" ? "🔍" : "🚀"} {meta.label}
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-3">
            Upload Your Documents
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
            {meta.desc}
          </p>
        </motion.div>

        {/* ── Dropzone grid ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 26, delay: 0.08 }}
          className="grid sm:grid-cols-2 gap-4 mb-6"
        >
          <Dropzone
            label="Resume PDF"
            sublabel="The candidate's resume"
            icon="📄"
            file={resumeFile}
            onFileSelect={setResumeFile}
            onFileSizeError={showSizeToast}
            disabled={isLoading}
            accentClass={meta.dropzone}
            activeClass={meta.active}
          />
          <Dropzone
            label="Job Description PDF"
            sublabel="The target role's JD"
            icon="📋"
            file={jdFile}
            onFileSelect={setJdFile}
            onFileSizeError={showSizeToast}
            disabled={isLoading}
            accentClass={meta.dropzone}
            activeClass={meta.active}
          />
        </motion.div>

        {/* ── Size hint ────────────────────────────────────────────────────── */}
        <p className="text-center text-slate-400 dark:text-slate-600 text-xs mt-3">
          Max file size: <span className="font-semibold">1 MB</span>
          <span className="mx-1.5 opacity-40">·</span>
          Under 500 KB recommended for fastest analysis
        </p>

        {/* ── Inline size-error banner (auto-dismisses after 5 s) ──────────── */}
        {sizeError && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex items-start gap-2 px-4 py-3 rounded-xl
              bg-red-50 dark:bg-red-950/60
              border border-red-200 dark:border-red-500/40
              text-red-600 dark:text-red-300 text-xs leading-relaxed"
          >
            <span className="flex-shrink-0 mt-0.5">⚠️</span>
            <span>{sizeError}</span>
          </motion.div>
        )}

        {/* ── Submit button ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18 }}
        >
          <motion.button
            onClick={handleSubmit}
            disabled={!canSubmit}
            whileHover={canSubmit ? { scale: 1.02 } : {}}
            whileTap={canSubmit ? { scale: 0.97 } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className={`
              w-full py-4 rounded-xl font-semibold text-white text-sm tracking-wide
              bg-gradient-to-r ${meta.button}
              shadow-lg transition-shadow duration-300
              disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
            `}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-3">
                <Spinner />
                Analyzing…
              </span>
            ) : (
              "⚡ Run AI Analysis"
            )}
          </motion.button>
        </motion.div>

        {/* File requirements note */}
        <p className="text-center text-slate-400 dark:text-slate-600 text-xs mt-4">
          PDF files only · Text-selectable (not scanned images)
        </p>

        {/* Cold-start warning for Render free tier */}
        <p className="text-center text-slate-400 dark:text-slate-600 text-xs mt-2 leading-relaxed max-w-sm mx-auto">
          <span className="font-semibold">Note:</span> The AI engine is hosted on a free cloud tier.
          If it has been inactive, your first analysis may take up to{" "}
          <span className="font-semibold">50 seconds</span> to wake up the server.
        </p>
      </div>
    </section>
  );
}

// ── Dropzone sub-component ─────────────────────────────────────────────────

function Dropzone({ label, sublabel, icon, file, onFileSelect, onFileSizeError, disabled, accentClass, activeClass }) {
  const [isDragging, setIsDragging] = useState(false);

  const MAX_FILE_SIZE = 1_048_576; // 1 MB in bytes

  const handleFile = (f) => {
    if (!f) return;

    if (f.type !== "application/pdf") return;

    if (f.size > MAX_FILE_SIZE) {
      onFileSizeError(
        "File is too large. Please upload a standard text-based PDF under 1MB."
      );
      return;
    }

    onFileSelect(f);
  };

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      handleFile(e.dataTransfer.files[0]);
    },
    [disabled]
  );

  const onDragOver = (e) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onInputChange = (e) => {
    handleFile(e.target.files[0]);
    e.target.value = "";
  };

  const hasFile = Boolean(file);
  const zoneClass = isDragging || hasFile ? activeClass : accentClass;

  return (
    <label
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`
        relative flex flex-col items-center justify-center gap-3
        rounded-2xl border-2 border-dashed p-8 cursor-pointer
        bg-white/50 dark:bg-white/[0.02]
        transition-all duration-300 min-h-[180px]
        ${zoneClass}
        ${disabled ? "pointer-events-none opacity-60" : ""}
      `}
    >
      <input
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={onInputChange}
        disabled={disabled}
      />

      {hasFile ? (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 360, damping: 22 }}
          className="text-center"
        >
          <span className="text-3xl block mb-2">✅</span>
          <p className="text-slate-800 dark:text-white text-xs font-semibold truncate max-w-[140px]">
            {file.name}
          </p>
          <p className="text-slate-400 dark:text-slate-500 text-[10px] mt-0.5">
            {(file.size / 1024).toFixed(0)} KB · Click to replace
          </p>
        </motion.div>
      ) : (
        <>
          <span className="text-3xl">{icon}</span>
          <div className="text-center">
            <p className="text-slate-700 dark:text-white text-sm font-semibold">{label}</p>
            <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-0.5">{sublabel}</p>
          </div>
          <p className="text-slate-400 dark:text-slate-600 text-[10px]">
            {isDragging ? "Drop it!" : "Drag & drop or click to browse"}
          </p>
        </>
      )}
    </label>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
