import { useState, useEffect, useRef } from "react";
import * as mammoth from "mammoth";
import {
  LayoutDashboard, FileText, KanbanSquare, Target, Plus, Trash2,
  ExternalLink, Loader2, ChevronRight, MapPin, Save, X, Sparkles,
  Flag, Tent, Award, AlertCircle, Mountain, Compass, ArrowUpRight,
  CheckCircle2, GripVertical, Upload, Mail, Link2, FileDown, Wand2
} from "lucide-react";

// ---------- word-doc export (HTML-as-.doc trick, opens natively in Word) ----------
function downloadAsWordDoc(filename, title, bodyHtml) {
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head><meta charset='utf-8'><title>${title}</title>
  <style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.4; }
    h1 { font-size: 20pt; margin-bottom: 2pt; }
    h2 { font-size: 12.5pt; text-transform: uppercase; letter-spacing: 0.5pt; border-bottom: 1pt solid #999; margin-top: 16pt; margin-bottom: 6pt; }
    .meta { color: #444; margin-bottom: 10pt; }
    ul { margin: 4pt 0 10pt 0; padding-left: 18pt; }
    li { margin-bottom: 3pt; }
    .role-head { font-weight: bold; margin-top: 8pt; }
    .role-sub { color: #444; font-style: italic; margin-bottom: 4pt; }
  </style></head>
  <body>${bodyHtml}</body></html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".doc") ? filename : `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function printAsPdf(title, bodyHtml) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<html>
    <head><meta charset="utf-8"><title>${title}</title>
    <style>
      @page { margin: 0.6in; }
      body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; line-height: 1.45; font-size: 11pt; }
      h1 { font-size: 22pt; margin-bottom: 2pt; font-family: Arial, sans-serif; }
      h2 { font-size: 12.5pt; text-transform: uppercase; letter-spacing: 0.6pt; border-bottom: 1pt solid #999; margin-top: 16pt; margin-bottom: 6pt; font-family: Arial, sans-serif; }
      .meta { color: #444; margin-bottom: 10pt; font-family: Arial, sans-serif; font-size: 10pt; }
      ul { margin: 4pt 0 10pt 0; padding-left: 18pt; }
      li { margin-bottom: 3pt; }
      .role-head { font-weight: bold; margin-top: 8pt; }
      .role-sub { color: #444; font-style: italic; margin-bottom: 4pt; font-size: 10pt; }
      p { margin: 0 0 10pt 0; }
    </style></head>
    <body>${bodyHtml}</body>
  </html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

async function callClaude({ system, prompt, tools }) {
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, prompt, tools }),
  });
  if (!response.ok) throw new Error("API request failed");
  const data = await response.json();
  return data.text || "";
}

// ---------- constants ----------
const STAGES = [
  { id: "wishlist",   label: "Basecamp",    sub: "Wishlist",   color: "#7FA37A" },
  { id: "applied",    label: "Trailhead",   sub: "Applied",    color: "#5B9BD5" },
  { id: "interview",  label: "Ridge Climb", sub: "Interview",  color: "#E8A33D" },
  { id: "offer",      label: "Summit",      sub: "Offer",      color: "#D9B84C" },
  { id: "rejected",   label: "Turned Back", sub: "Rejected",   color: "#9AA79A" },
];

const EMPTY_RESUME = {
  name: "", title: "", email: "", phone: "", location: "", linkedin: "",
  summary: "", skills: [],
  experience: [], education: [],
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- storage helpers ----------
// Standalone-web version: uses browser localStorage (per-device, no login).
// To upgrade to cross-device sync later, swap these two functions for calls
// to your own /api/data route backed by a real database — nothing else in
// this file needs to change.
async function loadKey(key, fallback) {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
async function saveKey(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ---------- root ----------
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [resume, setResume] = useState(EMPTY_RESUME);
  const [jobs, setJobs] = useState([]);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved
  const skipFirstSave = useRef(true);

  useEffect(() => {
    (async () => {
      const [r, j] = await Promise.all([
        loadKey("ascent:resume", EMPTY_RESUME),
        loadKey("ascent:jobs", []),
      ]);
      setResume(r);
      setJobs(j);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (skipFirstSave.current) { skipFirstSave.current = false; return; }
    setSaveState("saving");
    const t = setTimeout(async () => {
      await Promise.all([saveKey("ascent:resume", resume), saveKey("ascent:jobs", jobs)]);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    }, 500);
    return () => clearTimeout(t);
  }, [resume, jobs, ready]);

  const NAV = [
    { id: "dashboard", label: "Basecamp", icon: LayoutDashboard },
    { id: "resume", label: "Gear (Resume)", icon: FileText },
    { id: "jobs", label: "The Trail", icon: KanbanSquare },
    { id: "match", label: "Route Finder", icon: Target },
    { id: "coverletter", label: "Send-off", icon: Mail },
  ];

  return (
    <div style={S.app}>
      <style>{CSS}</style>

      <div style={S.shell}>
        {/* Sidebar */}
        <aside style={S.sidebar}>
          <div style={S.brand}>
            <Mountain size={22} color="var(--accent)" />
            <span style={S.brandText}>Ascent</span>
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 28 }}>
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = tab === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setTab(n.id)}
                  style={{ ...S.navItem, ...(active ? S.navItemActive : {}) }}
                >
                  <Icon size={17} style={{ opacity: active ? 1 : 0.7 }} />
                  {n.label}
                </button>
              );
            })}
          </nav>

          <div style={{ marginTop: "auto", paddingTop: 20 }}>
            <div style={S.saveIndicator}>
              {saveState === "saving" && <><Loader2 size={13} className="spin" /> Saving…</>}
              {saveState === "saved" && <><CheckCircle2 size={13} color="var(--accent-2)" /> Saved to your account</>}
              {saveState === "idle" && <><Compass size={13} /> Autosaves as you go</>}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main style={S.main}>
          {!ready ? (
            <div style={S.loadingScreen}><Loader2 className="spin" size={22} /> Loading your expedition…</div>
          ) : tab === "dashboard" ? (
            <Dashboard resume={resume} jobs={jobs} goTo={setTab} />
          ) : tab === "resume" ? (
            <ResumeBuilder resume={resume} setResume={setResume} />
          ) : tab === "jobs" ? (
            <JobTrail jobs={jobs} setJobs={setJobs} goTo={setTab} />
          ) : tab === "match" ? (
            <RouteFinder resume={resume} jobs={jobs} setJobs={setJobs} />
          ) : (
            <CoverLetter resume={resume} jobs={jobs} />
          )}
        </main>
      </div>
    </div>
  );
}

// ---------- Dashboard ----------
function Dashboard({ resume, jobs, goTo }) {
  const counts = Object.fromEntries(STAGES.map((s) => [s.id, jobs.filter((j) => j.status === s.id).length]));
  const scored = jobs.filter((j) => typeof j.matchScore === "number");
  const avgMatch = scored.length ? Math.round(scored.reduce((a, j) => a + j.matchScore, 0) / scored.length) : null;
  const completeness = resumeCompleteness(resume);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueJobs = jobs
    .filter((j) => j.followUpDate)
    .map((j) => ({ ...j, days: Math.round((new Date(j.followUpDate + "T00:00:00") - today) / 86400000) }))
    .filter((j) => j.days <= 2)
    .sort((a, b) => a.days - b.days);

  return (
    <div>
      <Header eyebrow="Mission control" title="Basecamp" desc="Your expedition, at a glance." />

      <div style={S.statRow}>
        <StatCard label="Jobs on the trail" value={jobs.length} icon={KanbanSquare} />
        <StatCard label="Avg. route match" value={avgMatch !== null ? `${avgMatch}%` : "—"} icon={Target} />
        <StatCard label="Resume readiness" value={`${completeness}%`} icon={FileText} />
        <StatCard label="Offers reached" value={counts.offer} icon={Award} accent="var(--gold)" />
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Elevation profile</div>
        <div style={S.trailRow}>
          {STAGES.map((s, i) => (
            <div key={s.id} style={S.trailStep}>
              <div style={{ ...S.trailDot, background: s.color }}>{counts[s.id]}</div>
              <div style={S.trailLabel}>{s.label}</div>
              <div style={S.trailSub}>{s.sub}</div>
              {i < STAGES.length - 1 && <div style={S.trailLine} />}
            </div>
          ))}
        </div>
      </div>

      {dueJobs.length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>Follow-ups</div>
          {dueJobs.map((j) => (
            <div key={j.id} style={S.recentRow}>
              <div>
                <div style={{ fontWeight: 600 }}>{j.role || "Untitled role"}</div>
                <div style={S.mutedText}>{j.company}</div>
              </div>
              <div style={{ fontSize: 11.5, fontFamily: "'IBM Plex Mono', monospace", color: j.days < 0 ? "var(--danger)" : j.days === 0 ? "var(--accent)" : "var(--accent-2)" }}>
                {j.days < 0 ? `${Math.abs(j.days)}d overdue` : j.days === 0 ? "Due today" : `In ${j.days}d`}
              </div>
            </div>
          ))}
          <button style={S.actionRow} onClick={() => goTo("jobs")}>
            <Flag size={15} color="var(--accent)" />
            <span>Open The Trail to update these</span>
            <ChevronRight size={15} style={{ marginLeft: "auto", opacity: 0.5 }} />
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={S.card}>
          <div style={S.cardTitle}>Next steps</div>
          {completeness < 100 && (
            <ActionRow icon={FileText} text="Finish packing your gear — resume is incomplete." onClick={() => goTo("resume")} />
          )}
          {jobs.length === 0 && (
            <ActionRow icon={Flag} text="Add your first job to start the trail." onClick={() => goTo("jobs")} />
          )}
          {jobs.some((j) => typeof j.matchScore !== "number") && (
            <ActionRow icon={Target} text="Run a route match on an unscored job." onClick={() => goTo("match")} />
          )}
          {completeness === 100 && jobs.length > 0 && (
            <div style={S.mutedText}>You're geared up. Keep climbing.</div>
          )}
        </div>
        <div style={S.card}>
          <div style={S.cardTitle}>Recently added</div>
          {jobs.slice().sort((a, b) => b.dateAdded - a.dateAdded).slice(0, 4).map((j) => (
            <div key={j.id} style={S.recentRow}>
              <div>
                <div style={{ fontWeight: 600 }}>{j.role || "Untitled role"}</div>
                <div style={S.mutedText}>{j.company}</div>
              </div>
              <StageTag id={j.status} />
            </div>
          ))}
          {jobs.length === 0 && <div style={S.mutedText}>Nothing here yet.</div>}
        </div>
      </div>
    </div>
  );
}

function ActionRow({ icon: Icon, text, onClick }) {
  return (
    <button onClick={onClick} style={S.actionRow}>
      <Icon size={15} color="var(--accent)" />
      <span>{text}</span>
      <ChevronRight size={15} style={{ marginLeft: "auto", opacity: 0.5 }} />
    </button>
  );
}

function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div style={S.statCard}>
      <Icon size={16} color={accent || "var(--accent-2)"} />
      <div style={S.statValue}>{value}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}

function resumeCompleteness(r) {
  const checks = [r.name, r.title, r.email, r.summary, r.skills.length > 0, r.experience.length > 0];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// ---------- Resume Builder ----------
function ResumeBuilder({ resume, setResume }) {
  const update = (patch) => setResume((r) => ({ ...r, ...patch }));
  const [skillInput, setSkillInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [parseNote, setParseNote] = useState("");
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    setParseError(""); setParseNote("");
    const ext = file.name.split(".").pop().toLowerCase();
    try {
      if (ext === "docx") {
        const buf = await file.arrayBuffer();
        const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
        setPasteText(value);
        setParseNote(`Extracted text from ${file.name}. Review below, then click "Parse into resume".`);
      } else if (ext === "txt") {
        const text = await file.text();
        setPasteText(text);
        setParseNote(`Loaded ${file.name}. Review below, then click "Parse into resume".`);
      } else if (ext === "pdf") {
        setParseNote(`Reading ${file.name}…`);
        const buf = await file.arrayBuffer();
        const base64 = btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ""));
        const response = await fetch("/api/parse-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64 }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed");
        setPasteText(data.text);
        setParseNote(`Extracted text from ${file.name}. Review below, then click "Parse into resume".`);
      } else {
        setParseError("Unsupported file type. Use .pdf, .docx, or .txt, or paste your resume text below.");
      }
    } catch (e) {
      setParseError(e.message || "Couldn't read that file. Try pasting the text instead.");
    }
  };

  const parseIntoResume = async () => {
    if (!pasteText.trim()) { setParseError("Paste or upload some resume text first."); return; }
    setParsing(true); setParseError("");
    try {
      const text = await callClaude({
        system: "You extract resume data into strict JSON only — no markdown fences, no preamble. Schema: {\"name\":string,\"title\":string,\"email\":string,\"phone\":string,\"location\":string,\"linkedin\":string,\"summary\":string,\"skills\":string[],\"experience\":[{\"company\":string,\"role\":string,\"location\":string,\"start\":string,\"end\":string,\"bullets\":string[]}],\"education\":[{\"school\":string,\"degree\":string,\"start\":string,\"end\":string}]}. Use \"\" or [] for anything not found. Never invent information that isn't in the source text.",
        prompt: `Extract structured resume data from this text:\n\n${pasteText}`,
      });
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResume((r) => ({
        ...r,
        ...parsed,
        skills: Array.isArray(parsed.skills) ? parsed.skills : r.skills,
        experience: (parsed.experience || []).map((e) => ({ id: uid(), bullets: [""], ...e })),
        education: (parsed.education || []).map((e) => ({ id: uid(), ...e })),
      }));
      setParseNote("Parsed! Review the fields below and edit anything that needs fixing.");
    } catch {
      setParseError("Couldn't parse that text. Try again, or fill the fields in manually below.");
    } finally {
      setParsing(false);
    }
  };

  const addSkill = () => {
    const v = skillInput.trim();
    if (v && !resume.skills.includes(v)) update({ skills: [...resume.skills, v] });
    setSkillInput("");
  };

  const addExperience = () =>
    update({ experience: [...resume.experience, { id: uid(), company: "", role: "", location: "", start: "", end: "", bullets: [""] }] });
  const updateExperience = (id, patch) =>
    update({ experience: resume.experience.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const removeExperience = (id) => update({ experience: resume.experience.filter((e) => e.id !== id) });

  const addEducation = () =>
    update({ education: [...resume.education, { id: uid(), school: "", degree: "", start: "", end: "" }] });
  const updateEducation = (id, patch) =>
    update({ education: resume.education.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const removeEducation = (id) => update({ education: resume.education.filter((e) => e.id !== id) });

  const copyText = () => {
    const text = resumeToText(resume);
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div>
      <Header eyebrow="Pack your gear" title="Resume" desc="What you carry with you on every climb." />

      <div style={S.card}>
        <div style={S.cardTitle}>Start from an existing resume</div>
        <div style={S.mutedText}>Upload a .pdf, .docx, or .txt file, or paste your resume text — Ascent will read it and fill in the fields below.</div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 10 }}>
          <button style={S.smallBtn} onClick={() => fileInputRef.current?.click()}>
            <Upload size={13} /> Upload file
          </button>
          <input
            ref={fileInputRef} type="file" accept=".docx,.txt,.pdf" style={{ display: "none" }}
            onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
          />
        </div>
        <textarea
          style={S.textarea} rows={5}
          placeholder="…or paste your resume text here"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
        />
        <button style={S.primaryBtn} onClick={parseIntoResume} disabled={parsing}>
          {parsing ? <><Loader2 size={14} className="spin" /> Reading it…</> : <><Wand2 size={14} /> Parse into resume</>}
        </button>
        {parseNote && <div style={{ ...S.mutedText, marginTop: 8, color: "var(--accent-2)" }}>{parseNote}</div>}
        {parseError && <div style={S.errorText}><AlertCircle size={13} /> {parseError}</div>}
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Contact</div>
        <div style={S.gridTwo}>
          <Field label="Full name" value={resume.name} onChange={(v) => update({ name: v })} />
          <Field label="Target title" value={resume.title} onChange={(v) => update({ title: v })} placeholder="e.g. Senior Product Designer" />
          <Field label="Email" value={resume.email} onChange={(v) => update({ email: v })} />
          <Field label="Phone" value={resume.phone} onChange={(v) => update({ phone: v })} />
          <Field label="Location" value={resume.location} onChange={(v) => update({ location: v })} />
          <Field label="LinkedIn / portfolio" value={resume.linkedin} onChange={(v) => update({ linkedin: v })} />
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Summary</div>
        <textarea
          style={S.textarea}
          rows={3}
          placeholder="Two or three sentences on who you are and what you're aiming for."
          value={resume.summary}
          onChange={(e) => update({ summary: e.target.value })}
        />
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Skills</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            style={S.input}
            placeholder="Add a skill and press Enter"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
          />
          <button style={S.smallBtn} onClick={addSkill}><Plus size={14} /></button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {resume.skills.map((s) => (
            <span key={s} style={S.chip}>
              {s}
              <X size={12} style={{ cursor: "pointer", opacity: 0.6 }} onClick={() => update({ skills: resume.skills.filter((x) => x !== s) })} />
            </span>
          ))}
          {resume.skills.length === 0 && <div style={S.mutedText}>No skills added yet.</div>}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitleRow}>
          <div style={S.cardTitle}>Experience</div>
          <button style={S.smallBtn} onClick={addExperience}><Plus size={14} /> Add role</button>
        </div>
        {resume.experience.map((exp) => (
          <ExperienceBlock key={exp.id} exp={exp} onChange={(p) => updateExperience(exp.id, p)} onRemove={() => removeExperience(exp.id)} />
        ))}
        {resume.experience.length === 0 && <div style={S.mutedText}>No experience added yet.</div>}
      </div>

      <div style={S.card}>
        <div style={S.cardTitleRow}>
          <div style={S.cardTitle}>Education</div>
          <button style={S.smallBtn} onClick={addEducation}><Plus size={14} /> Add school</button>
        </div>
        {resume.education.map((ed) => (
          <div key={ed.id} style={S.subCard}>
            <div style={S.gridTwo}>
              <Field label="School" value={ed.school} onChange={(v) => updateEducation(ed.id, { school: v })} />
              <Field label="Degree" value={ed.degree} onChange={(v) => updateEducation(ed.id, { degree: v })} />
              <Field label="Start" value={ed.start} onChange={(v) => updateEducation(ed.id, { start: v })} placeholder="2018" />
              <Field label="End" value={ed.end} onChange={(v) => updateEducation(ed.id, { end: v })} placeholder="2022" />
            </div>
            <button style={S.removeBtn} onClick={() => removeEducation(ed.id)}><Trash2 size={13} /> Remove</button>
          </div>
        ))}
        {resume.education.length === 0 && <div style={S.mutedText}>No education added yet.</div>}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button style={S.primaryBtn} onClick={copyText}>
          {copied ? <><CheckCircle2 size={15} /> Copied</> : <><Save size={15} /> Copy resume as text</>}
        </button>
        <button style={{ ...S.primaryBtn, background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
          onClick={() => downloadAsWordDoc(`${resume.name || "resume"}-resume`, "Resume", resumeToHtml(resume))}>
          <FileDown size={15} /> Download as Word doc
        </button>
        <button style={{ ...S.primaryBtn, background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
          onClick={() => printAsPdf("Resume", resumeToHtml(resume))}>
          <FileDown size={15} /> Download as PDF
        </button>
      </div>
    </div>
  );
}

function ExperienceBlock({ exp, onChange, onRemove }) {
  const updateBullet = (i, v) => {
    const bullets = [...exp.bullets];
    bullets[i] = v;
    onChange({ bullets });
  };
  const addBullet = () => onChange({ bullets: [...exp.bullets, ""] });
  const removeBullet = (i) => onChange({ bullets: exp.bullets.filter((_, idx) => idx !== i) });

  return (
    <div style={S.subCard}>
      <div style={S.gridTwo}>
        <Field label="Company" value={exp.company} onChange={(v) => onChange({ company: v })} />
        <Field label="Role" value={exp.role} onChange={(v) => onChange({ role: v })} />
        <Field label="Location" value={exp.location} onChange={(v) => onChange({ location: v })} />
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="Start" value={exp.start} onChange={(v) => onChange({ start: v })} placeholder="Jan 2021" />
          <Field label="End" value={exp.end} onChange={(v) => onChange({ end: v })} placeholder="Present" />
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={S.fieldLabel}>Bullet points</div>
        {exp.bullets.map((b, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input style={S.input} value={b} onChange={(e) => updateBullet(i, e.target.value)} placeholder="What did you do, and what changed because of it?" />
            <button style={S.iconBtn} onClick={() => removeBullet(i)}><X size={13} /></button>
          </div>
        ))}
        <button style={S.smallBtnGhost} onClick={addBullet}><Plus size={13} /> Add bullet</button>
      </div>
      <button style={S.removeBtn} onClick={onRemove}><Trash2 size={13} /> Remove role</button>
    </div>
  );
}

function resumeToText(r) {
  const lines = [];
  lines.push(r.name || "Your Name");
  if (r.title) lines.push(r.title);
  lines.push([r.email, r.phone, r.location, r.linkedin].filter(Boolean).join(" · "));
  lines.push("");
  if (r.summary) { lines.push("SUMMARY"); lines.push(r.summary); lines.push(""); }
  if (r.skills.length) { lines.push("SKILLS"); lines.push(r.skills.join(", ")); lines.push(""); }
  if (r.experience.length) {
    lines.push("EXPERIENCE");
    r.experience.forEach((e) => {
      lines.push(`${e.role || "Role"} — ${e.company || "Company"} (${e.start || "?"} – ${e.end || "?"})`);
      e.bullets.filter(Boolean).forEach((b) => lines.push(`  • ${b}`));
    });
    lines.push("");
  }
  if (r.education.length) {
    lines.push("EDUCATION");
    r.education.forEach((e) => lines.push(`${e.degree || "Degree"} — ${e.school || "School"} (${e.start || "?"} – ${e.end || "?"})`));
  }
  return lines.join("\n");
}

function resumeToHtml(r) {
  const esc = (s) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let h = `<h1>${esc(r.name) || "Your Name"}</h1>`;
  if (r.title) h += `<div class="meta"><strong>${esc(r.title)}</strong></div>`;
  h += `<div class="meta">${[r.email, r.phone, r.location, r.linkedin].filter(Boolean).map(esc).join(" &nbsp;|&nbsp; ")}</div>`;
  if (r.summary) h += `<h2>Summary</h2><p>${esc(r.summary)}</p>`;
  if (r.skills.length) h += `<h2>Skills</h2><p>${r.skills.map(esc).join(", ")}</p>`;
  if (r.experience.length) {
    h += `<h2>Experience</h2>`;
    r.experience.forEach((e) => {
      h += `<div class="role-head">${esc(e.role) || "Role"} — ${esc(e.company) || "Company"}</div>`;
      h += `<div class="role-sub">${esc(e.location) || ""} ${e.location ? "&nbsp;|&nbsp;" : ""} ${esc(e.start)} – ${esc(e.end)}</div>`;
      const bullets = e.bullets.filter(Boolean);
      if (bullets.length) h += `<ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`;
    });
  }
  if (r.education.length) {
    h += `<h2>Education</h2>`;
    r.education.forEach((e) => {
      h += `<div class="role-head">${esc(e.degree) || "Degree"} — ${esc(e.school) || "School"}</div>`;
      h += `<div class="role-sub">${esc(e.start)} – ${esc(e.end)}</div>`;
    });
  }
  return h;
}

function followUpBadge(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  const days = Math.round((due - today) / 86400000);
  let text, color;
  if (days < 0) { text = `${Math.abs(days)}d overdue`; color = "var(--danger)"; }
  else if (days === 0) { text = "Due today"; color = "var(--accent)"; }
  else { text = `In ${days}d`; color = "var(--accent-2)"; }
  return <div style={{ fontSize: 10.5, color, marginTop: 3, fontFamily: "'IBM Plex Mono', monospace" }}>{text}</div>;
}

// ---------- Job Trail (tracker) ----------
function JobTrail({ jobs, setJobs, goTo }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankJob());
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [jdText, setJdText] = useState("");
  const [exportCopied, setExportCopied] = useState(false);

  const copyFollowUpsForExtension = () => {
    const data = jobs
      .filter((j) => j.followUpDate)
      .map((j) => ({ company: j.company, role: j.role, followUpDate: j.followUpDate }));
    navigator.clipboard?.writeText(JSON.stringify(data));
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 1800);
  };

  function blankJob() {
    return { company: "", role: "", location: "", url: "", notes: "" };
  }

  const importFromUrl = async () => {
    if (!form.url.trim()) { setImportError("Paste a job posting URL first."); return; }
    setImporting(true); setImportError("");
    try {
      const text = await callClaude({
        system: "You look up a job posting URL using web search and extract its details. Respond ONLY with strict JSON, no markdown fences: {\"company\":string,\"role\":string,\"location\":string,\"jdText\":string (the full job description, trimmed of nav/boilerplate)}. If you can't find the page or a field, use \"\".",
        prompt: `Look up this job posting and extract its details: ${form.url}`,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      });
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1));
      setForm((f) => ({ ...f, company: parsed.company || f.company, role: parsed.role || f.role, location: parsed.location || f.location }));
      setJdText(parsed.jdText || "");
    } catch {
      setImportError("Couldn't fetch that page. You can still fill the fields in by hand.");
    } finally {
      setImporting(false);
    }
  };

  const addJob = () => {
    if (!form.company && !form.role) return;
    setJobs((js) => [...js, { id: uid(), ...form, status: "wishlist", dateAdded: Date.now(), matchScore: null, jdText, followUpDate: "" }]);
    setForm(blankJob());
    setJdText("");
    setShowForm(false);
  };

  const updateJob = (id, patch) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  const removeJob = (id) => setJobs((js) => js.filter((j) => j.id !== id));

  return (
    <div>
      <Header eyebrow="Your route" title="The Trail" desc="Every job is a camp along the way." />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button style={S.primaryBtn} onClick={() => setShowForm((s) => !s)}>
          <Plus size={15} /> {showForm ? "Cancel" : "Add a job"}
        </button>
        <button style={{ ...S.primaryBtn, background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
          onClick={copyFollowUpsForExtension}>
          {exportCopied ? <><CheckCircle2 size={15} /> Copied</> : <><FileDown size={15} /> Copy follow-ups for extension</>}
        </button>
      </div>

      {showForm && (
        <div style={{ ...S.card, marginTop: 12 }}>
          <div style={S.fieldLabel}>Posting URL</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <input style={S.input} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
            <button style={S.smallBtn} onClick={importFromUrl} disabled={importing}>
              {importing ? <Loader2 size={13} className="spin" /> : <Link2 size={13} />} Fetch details
            </button>
          </div>
          {importError && <div style={S.errorText}><AlertCircle size={13} /> {importError}</div>}
          <div style={{ ...S.gridTwo, marginTop: 10 }}>
            <Field label="Company" value={form.company} onChange={(v) => setForm({ ...form, company: v })} />
            <Field label="Role" value={form.role} onChange={(v) => setForm({ ...form, role: v })} />
            <Field label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
          </div>
          <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          {jdText && (
            <div style={{ marginTop: 6 }}>
              <div style={S.fieldLabel}>Job description (fetched)</div>
              <textarea style={S.textarea} rows={4} value={jdText} onChange={(e) => setJdText(e.target.value)} />
            </div>
          )}
          <button style={S.primaryBtn} onClick={addJob}><Flag size={14} /> Set up camp</button>
        </div>
      )}

      <div style={S.kanban}>
        {STAGES.map((stage) => (
          <div key={stage.id} style={S.kanbanCol}>
            <div style={S.kanbanColHead}>
              <span style={{ ...S.stageDot, background: stage.color }} />
              {stage.label}
              <span style={S.kanbanCount}>{jobs.filter((j) => j.status === stage.id).length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {jobs.filter((j) => j.status === stage.id).map((j) => (
                <div key={j.id} style={S.jobCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{j.role || "Untitled role"}</div>
                      <div style={S.mutedText}>{j.company}</div>
                    </div>
                    <button style={S.ghostIconBtn} onClick={() => removeJob(j.id)}><Trash2 size={13} /></button>
                  </div>
                  {j.location && <div style={S.jobMeta}><MapPin size={11} /> {j.location}</div>}
                  {typeof j.matchScore === "number" && (
                    <div style={S.matchBadge}><Target size={11} /> {j.matchScore}% match</div>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ ...S.fieldLabel, marginBottom: 3 }}>Follow up</div>
                    <input
                      type="date" style={{ ...S.input, padding: "5px 8px", fontSize: 12 }}
                      value={j.followUpDate || ""}
                      onChange={(e) => updateJob(j.id, { followUpDate: e.target.value })}
                    />
                    {followUpBadge(j.followUpDate)}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <select style={S.select} value={j.status} onChange={(e) => updateJob(j.id, { status: e.target.value })}>
                      {STAGES.map((s) => <option key={s.id} value={s.id}>{s.sub}</option>)}
                    </select>
                    {j.url && (
                      <a href={j.url} target="_blank" rel="noreferrer" style={S.ghostIconBtn}><ExternalLink size={13} /></a>
                    )}
                  </div>
                </div>
              ))}
              {jobs.filter((j) => j.status === stage.id).length === 0 && (
                <div style={S.emptyCol}>No jobs here</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StageTag({ id }) {
  const s = STAGES.find((x) => x.id === id) || STAGES[0];
  return <span style={{ ...S.stageTag, color: s.color, borderColor: s.color }}>{s.sub}</span>;
}

// ---------- Route Finder (AI match) ----------
function RouteFinder({ resume, jobs, setJobs }) {
  const [selectedId, setSelectedId] = useState("");
  const [jdOverride, setJdOverride] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const selectedJob = jobs.find((j) => j.id === selectedId);

  const analyze = async () => {
    const jdText = (selectedJob ? selectedJob.jdText : "") || jdOverride;
    if (!jdText.trim()) { setError("Paste a job description, or pick a saved job that has one."); return; }
    setLoading(true);
    setError("");
    setResult(null);

    const resumeSummary = [
      resume.title && `Target title: ${resume.title}`,
      resume.summary && `Summary: ${resume.summary}`,
      resume.skills.length && `Skills: ${resume.skills.join(", ")}`,
      resume.experience.length && "Experience:\n" + resume.experience.map(
        (e) => `- ${e.role} at ${e.company}: ${e.bullets.filter(Boolean).join("; ")}`
      ).join("\n"),
    ].filter(Boolean).join("\n\n");

    try {
      const text = await callClaude({
        system: "You are a careful, honest resume-to-job matcher. Respond ONLY with raw JSON, no markdown fences, no preamble. Schema: {\"matchScore\": number 0-100, \"matchedKeywords\": string[], \"missingKeywords\": string[], \"suggestions\": string[] (2-4 short, honest suggestions for tailoring the resume to this job, no fabrication)}",
        prompt: `RESUME:\n${resumeSummary || "(no resume details provided)"}\n\nJOB DESCRIPTION:\n${jdText}`,
      });
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
      if (selectedJob) updateJobScore(selectedJob.id, parsed.matchScore, jdText);
    } catch (e) {
      setError("Couldn't complete the analysis. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const updateJobScore = (id, score, jdText) =>
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, matchScore: score, jdText } : j)));

  return (
    <div>
      <Header eyebrow="Plan the ascent" title="Route Finder" desc="Compare your gear to the climb ahead." />

      <div style={S.card}>
        <div style={S.fieldLabel}>Pick a saved job (optional)</div>
        <select style={S.select} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">— Paste a description instead —</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.role} @ {j.company}</option>)}
        </select>

        {!selectedJob && (
          <>
            <div style={{ ...S.fieldLabel, marginTop: 12 }}>Job description</div>
            <textarea style={S.textarea} rows={6} value={jdOverride} onChange={(e) => setJdOverride(e.target.value)} placeholder="Paste the job posting text here…" />
          </>
        )}
        {selectedJob && (
          <>
            <div style={{ ...S.fieldLabel, marginTop: 12 }}>Job description for {selectedJob.role}</div>
            <textarea
              style={S.textarea}
              rows={6}
              value={selectedJob.jdText}
              onChange={(e) => updateJobScore(selectedJob.id, selectedJob.matchScore, e.target.value)}
              placeholder="Paste the job posting text here…"
            />
          </>
        )}

        <button style={S.primaryBtn} onClick={analyze} disabled={loading}>
          {loading ? <><Loader2 size={15} className="spin" /> Scouting the route…</> : <><Sparkles size={15} /> Analyze match</>}
        </button>
        {error && <div style={S.errorText}><AlertCircle size={13} /> {error}</div>}
      </div>

      {result && (
        <div style={S.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={S.scoreCircle(result.matchScore)}>{result.matchScore}%</div>
            <div>
              <div style={S.cardTitle}>Route match</div>
              <div style={S.mutedText}>How well your gear fits this climb</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
            <div>
              <div style={S.fieldLabel}>Matched keywords</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.matchedKeywords?.map((k) => <span key={k} style={{ ...S.chip, borderColor: "var(--accent-2)" }}>{k}</span>)}
                {!result.matchedKeywords?.length && <div style={S.mutedText}>None found.</div>}
              </div>
            </div>
            <div>
              <div style={S.fieldLabel}>Missing keywords</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.missingKeywords?.map((k) => <span key={k} style={{ ...S.chip, borderColor: "var(--danger)" }}>{k}</span>)}
                {!result.missingKeywords?.length && <div style={S.mutedText}>None — nice.</div>}
              </div>
            </div>
          </div>

          {result.suggestions?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={S.fieldLabel}>Suggestions</div>
              {result.suggestions.map((s, i) => (
                <div key={i} style={S.suggestionRow}><ArrowUpRight size={13} color="var(--accent)" /> {s}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Cover Letter (Send-off) ----------
function CoverLetter({ resume, jobs }) {
  const [selectedId, setSelectedId] = useState("");
  const [jdOverride, setJdOverride] = useState("");
  const [tone, setTone] = useState("professional");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [letter, setLetter] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedJob = jobs.find((j) => j.id === selectedId);

  const generate = async () => {
    const jdText = (selectedJob ? selectedJob.jdText : "") || jdOverride;
    if (!jdText.trim()) { setError("Paste a job description, or pick a saved job that has one."); return; }
    setLoading(true); setError(""); setLetter("");

    const resumeSummary = [
      resume.name && `Name: ${resume.name}`,
      resume.title && `Target title: ${resume.title}`,
      resume.summary && `Summary: ${resume.summary}`,
      resume.skills.length && `Skills: ${resume.skills.join(", ")}`,
      resume.experience.length && "Experience:\n" + resume.experience.map(
        (e) => `- ${e.role} at ${e.company}: ${e.bullets.filter(Boolean).join("; ")}`
      ).join("\n"),
    ].filter(Boolean).join("\n\n");

    try {
      const text = await callClaude({
        system: `You write honest, specific cover letters — no generic filler, no fabricated claims about the candidate. Tone: ${tone}. Three to four short paragraphs. Respond with the letter text only, no subject line, no markdown formatting, no preamble.`,
        prompt: `CANDIDATE RESUME:\n${resumeSummary || "(no resume details provided)"}\n\nJOB DESCRIPTION:\n${jdText}\n\nWrite a cover letter for this candidate applying to this role.`,
      });
      setLetter(text.trim());
      if (selectedJob) { /* leave job record untouched, letter is scratch space */ }
    } catch {
      setError("Couldn't generate the letter. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const copyLetter = () => {
    navigator.clipboard?.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div>
      <Header eyebrow="Before you knock" title="Send-off" desc="A cover letter, tailored to this climb." />

      <div style={S.card}>
        <div style={S.fieldLabel}>Pick a saved job (optional)</div>
        <select style={S.select} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">— Paste a description instead —</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.role} @ {j.company}</option>)}
        </select>

        {!selectedJob && (
          <>
            <div style={{ ...S.fieldLabel, marginTop: 12 }}>Job description</div>
            <textarea style={S.textarea} rows={5} value={jdOverride} onChange={(e) => setJdOverride(e.target.value)} placeholder="Paste the job posting text here…" />
          </>
        )}

        <div style={{ ...S.fieldLabel, marginTop: 12 }}>Tone</div>
        <select style={S.select} value={tone} onChange={(e) => setTone(e.target.value)}>
          <option value="professional">Professional</option>
          <option value="warm and conversational">Warm & conversational</option>
          <option value="confident and direct">Confident & direct</option>
        </select>

        <div>
          <button style={S.primaryBtn} onClick={generate} disabled={loading}>
            {loading ? <><Loader2 size={15} className="spin" /> Writing…</> : <><Sparkles size={15} /> Generate cover letter</>}
          </button>
        </div>
        {error && <div style={S.errorText}><AlertCircle size={13} /> {error}</div>}
      </div>

      {letter && (
        <div style={S.card}>
          <div style={S.cardTitleRow}>
            <div style={S.cardTitle}>Draft</div>
          </div>
          <textarea style={{ ...S.textarea, minHeight: 260 }} value={letter} onChange={(e) => setLetter(e.target.value)} />
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button style={S.primaryBtn} onClick={copyLetter}>
              {copied ? <><CheckCircle2 size={15} /> Copied</> : <><Save size={15} /> Copy text</>}
            </button>
            <button style={{ ...S.primaryBtn, background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              onClick={() => downloadAsWordDoc(`${resume.name || "cover-letter"}-cover-letter`, "Cover Letter", `<p>${letter.replace(/\n/g, "</p><p>")}</p>`)}>
              <FileDown size={15} /> Download as Word doc
            </button>
            <button style={{ ...S.primaryBtn, background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              onClick={() => printAsPdf("Cover Letter", `<p>${letter.replace(/\n/g, "</p><p>")}</p>`)}>
              <FileDown size={15} /> Download as PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- shared small components ----------
function Header({ eyebrow, title, desc }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={S.eyebrow}>{eyebrow}</div>
      <h1 style={S.h1}>{title}</h1>
      <div style={S.mutedText}>{desc}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 10, flex: 1 }}>
      <div style={S.fieldLabel}>{label}</div>
      <input style={S.input} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// ---------- styles ----------
const S = {
  app: { minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "'Inter', sans-serif" },
  shell: { display: "flex", minHeight: "100vh" },
  sidebar: { width: 220, borderRight: "1px solid var(--border)", padding: "22px 16px", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" },
  brand: { display: "flex", alignItems: "center", gap: 8 },
  brandText: { fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" },
  navItem: { display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", background: "transparent", color: "var(--text-muted)", fontSize: 13.5, textAlign: "left", cursor: "pointer", fontFamily: "'Inter', sans-serif" },
  navItemActive: { background: "var(--surface-2)", color: "var(--text)" },
  saveIndicator: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace" },
  main: { flex: 1, padding: "32px 40px", maxWidth: 920 },
  loadingScreen: { display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", paddingTop: 60 },
  eyebrow: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 6 },
  h1: { fontFamily: "'Fraunces', serif", fontSize: 32, margin: "0 0 6px 0", fontWeight: 600 },
  mutedText: { color: "var(--text-muted)", fontSize: 13 },
  card: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 16 },
  subCard: { background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 12 },
  cardTitle: { fontFamily: "'Fraunces', serif", fontSize: 16.5, fontWeight: 600, marginBottom: 12 },
  cardTitleRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  gridTwo: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  fieldLabel: { fontSize: 11.5, color: "var(--text-muted)", marginBottom: 5, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em" },
  input: { width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 7, padding: "9px 10px", color: "var(--text)", fontSize: 13.5, fontFamily: "'Inter', sans-serif", boxSizing: "border-box" },
  textarea: { width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 7, padding: "10px", color: "var(--text)", fontSize: 13.5, fontFamily: "'Inter', sans-serif", resize: "vertical", boxSizing: "border-box" },
  select: { background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 7, padding: "6px 8px", color: "var(--text)", fontSize: 12.5, fontFamily: "'Inter', sans-serif" },
  chip: { display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 999, border: "1px solid var(--border)", fontSize: 12, background: "var(--surface-2)" },
  primaryBtn: { display: "inline-flex", alignItems: "center", gap: 7, background: "var(--accent)", color: "#1C2521", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginTop: 6, fontFamily: "'Inter', sans-serif" },
  smallBtn: { display: "inline-flex", alignItems: "center", gap: 5, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 7, padding: "6px 10px", fontSize: 12.5, cursor: "pointer", fontFamily: "'Inter', sans-serif" },
  smallBtnGhost: { display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "1px dashed var(--border)", color: "var(--text-muted)", borderRadius: 7, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif" },
  iconBtn: { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 6, padding: "6px 8px", cursor: "pointer" },
  ghostIconBtn: { background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, display: "inline-flex" },
  removeBtn: { display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: "var(--danger)", fontSize: 12, cursor: "pointer", marginTop: 6, padding: 0, fontFamily: "'Inter', sans-serif" },
  statRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 18 },
  statCard: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 },
  statValue: { fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600, margin: "8px 0 2px" },
  statLabel: { fontSize: 12, color: "var(--text-muted)" },
  trailRow: { display: "flex", justifyContent: "space-between", position: "relative", padding: "10px 0" },
  trailStep: { display: "flex", flexDirection: "column", alignItems: "center", position: "relative", flex: 1 },
  trailDot: { width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#1C2521", zIndex: 1 },
  trailLabel: { fontSize: 12.5, fontWeight: 600, marginTop: 8, textAlign: "center" },
  trailSub: { fontSize: 10.5, color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace" },
  trailLine: { position: "absolute", top: 17, left: "50%", width: "100%", height: 1, borderTop: "1px dashed var(--border)", zIndex: 0 },
  actionRow: { display: "flex", alignItems: "center", gap: 8, width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", color: "var(--text)", fontSize: 13, cursor: "pointer", marginBottom: 8, fontFamily: "'Inter', sans-serif" },
  recentRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" },
  stageTag: { fontSize: 10.5, padding: "3px 8px", borderRadius: 999, border: "1px solid", fontFamily: "'IBM Plex Mono', monospace" },
  kanban: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 20 },
  kanbanCol: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, minHeight: 200 },
  kanbanColHead: { display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, marginBottom: 10 },
  kanbanCount: { marginLeft: "auto", fontFamily: "'IBM Plex Mono', monospace", color: "var(--text-muted)", fontSize: 11 },
  stageDot: { width: 8, height: 8, borderRadius: "50%" },
  jobCard: { background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, padding: 10, fontSize: 12.5 },
  jobMeta: { display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)", marginTop: 5 },
  matchBadge: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: "var(--accent)", marginTop: 5, fontFamily: "'IBM Plex Mono', monospace" },
  emptyCol: { fontSize: 11.5, color: "var(--text-muted)", textAlign: "center", padding: "16px 0", fontStyle: "italic" },
  errorText: { display: "flex", alignItems: "center", gap: 6, color: "var(--danger)", fontSize: 12.5, marginTop: 8 },
  suggestionRow: { display: "flex", gap: 7, fontSize: 13, marginBottom: 7, alignItems: "flex-start" },
  scoreCircle: (score) => ({
    width: 58, height: 58, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 15,
    border: `3px solid ${score >= 70 ? "var(--accent-2)" : score >= 40 ? "var(--accent)" : "var(--danger)"}`,
    color: score >= 70 ? "var(--accent-2)" : score >= 40 ? "var(--accent)" : "var(--danger)",
  }),
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
:root {
  --bg: #1C2521;
  --surface: #212B26;
  --surface-2: #2A3730;
  --border: #3A4A40;
  --accent: #E8A33D;
  --accent-2: #7FA37A;
  --gold: #D9B84C;
  --danger: #D96C5C;
  --text: #F1EFE7;
  --text-muted: #9AA79A;
}
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
input:focus, textarea:focus, select:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
button:hover { opacity: 0.92; }
`;
