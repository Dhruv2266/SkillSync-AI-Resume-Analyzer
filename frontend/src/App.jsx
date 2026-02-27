import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Hero from "./components/Hero";
import UploadForm from "./components/UploadForm";
import ResultsDashboard from "./components/ResultsDashboard";
import Toast from "./components/Toast";
import Navbar from "./components/Navbar";

// Spring config shared across all page transitions for a consistent feel
const PAGE_TRANSITION = {
  type: "spring",
  stiffness: 280,
  damping: 28,
  mass: 0.9,
};

export default function App() {
  // "idle" | "upload" | "loading" | "results"
  const [view, setView] = useState("idle");
  const [role, setRole] = useState(null);       // "recruiter" | "applier"
  const [results, setResults] = useState(null);
  const [toast, setToast] = useState(null);     // { message, type }

  // ── Dark mode ─────────────────────────────────────────────────────────────
  // Initialise from localStorage so the preference persists across sessions.
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("skillsync-theme");
    if (saved) return saved === "dark";
    // Fall back to the OS preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Keep the <html> class and localStorage in sync whenever isDark changes.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("skillsync-theme", isDark ? "dark" : "light");
  }, [isDark]);

  const uploadRef = useRef(null);

  // Called when a role button is clicked in the Hero
  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole);
    setView("upload");
    setTimeout(() => {
      uploadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  const showToast = (message, type = "error") => {
    setToast({ message, type });
  };

  const handleAnalyze = async (resumeFile, jdFile) => {
    setView("loading");

    const formData = new FormData();
    formData.append("role", role);
    formData.append("resume", resumeFile);
    formData.append("job_description", jdFile);

    try {
      const response = await fetch("https://skillsync-ai-resume-analyzer.onrender.com/api/v1/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message =
          errorData.detail ||
          (response.status === 415
            ? "Invalid file type. Please upload PDF files only."
            : response.status === 422
            ? "Could not read one of the PDFs. Please ensure they contain selectable text."
            : `Server error (${response.status}). Please try again.`);
        showToast(message, "error");
        setView("upload");
        return;
      }

      const data = await response.json();
      setResults(data);
      setView("results");
    } catch (err) {
      showToast(
        "Could not reach the server. Make sure the FastAPI backend is running.",
        "error"
      );
      setView("upload");
    }
  };

  const handleReset = () => {
    setView("idle");
    setRole(null);
    setResults(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    // The `dark` class on <html> (set via useEffect) drives all dark: variants.
    // This wrapper handles the global background + text colour for both modes.
    <div className="min-h-screen bg-surface-light dark:bg-surface-dark text-slate-800 dark:text-slate-100 font-body overflow-x-hidden transition-colors duration-300">

      {/* Ambient background orbs — subtler in light mode */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-300/20 dark:bg-violet-900/20 blur-[120px] transition-colors duration-500" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-cyan-300/15 dark:bg-cyan-900/15 blur-[100px] transition-colors duration-500" />
      </div>

      {/* Persistent top navigation bar */}
      <Navbar isDark={isDark} onToggleDark={() => setIsDark((d) => !d)} />

      <div className="relative z-10">
        <Hero onRoleSelect={handleRoleSelect} activeRole={role} />

        {/* Upload + Results section */}
        <div ref={uploadRef}>
          <AnimatePresence mode="wait">
            {(view === "upload" || view === "loading") && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 56 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -32, scale: 0.98 }}
                transition={PAGE_TRANSITION}
              >
                <UploadForm
                  role={role}
                  isLoading={view === "loading"}
                  onSubmit={handleAnalyze}
                  onBack={handleReset}
                />
              </motion.div>
            )}

            {view === "results" && results && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 56 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -32, scale: 0.98 }}
                transition={PAGE_TRANSITION}
              >
                <ResultsDashboard
                  results={results}
                  role={role}
                  onReset={handleReset}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Toast notifications */}
      <AnimatePresence>
        {toast && (
          <Toast
            key="toast"
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
