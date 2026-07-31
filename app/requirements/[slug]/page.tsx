"use client";

import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  firebaseReady,
  getRequirementWindow,
  saveRecord,
  watchRequirementWindow,
  type RequirementWindowRecord,
} from "@/lib/firebase";
import { DEFAULT_DEPARTMENTS } from "@/lib/catalog";

export default function PublicRequirementForm() {
  const { slug } = useParams<{ slug: string }>();
  const [windowConfig, setWindowConfig] = useState<RequirementWindowRecord | null>(null);
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentTime] = useState(Date.now);
  const [form, setForm] = useState({
    requesterName: "", requesterEmail: "", department: DEFAULT_DEPARTMENTS[0],
    item: "", quantity: "1", neededDate: "", reason: "",
  });

  useEffect(() => {
    const applyConfig = (config: RequirementWindowRecord) => {
      setWindowConfig(config);
      if (config.departments?.length) {
        setDepartments(config.departments);
        setForm((current) => config.departments!.includes(current.department)
          ? current
          : { ...current, department: config.departments![0] });
      }
      setLoading(false);
    };
    getRequirementWindow().then((config) => {
      applyConfig(config);
    });
    return watchRequirementWindow(applyConfig);
  }, []);

  const isAvailable = useMemo(() => {
    if (!windowConfig || windowConfig.slug !== slug || !windowConfig.isOpen) return false;
    return currentTime >= new Date(windowConfig.opensAt).getTime() && currentTime <= new Date(windowConfig.closesAt).getTime();
  }, [currentTime, windowConfig, slug]);

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: event.target.value }),
  });

  if (loading) return <RequirementState icon={Clock3} title="Checking submission window…" />;
  if (!firebaseReady || !windowConfig || windowConfig.slug !== slug) return <RequirementState icon={XCircle} title="This requirement form is unavailable" copy="Please check the link with your IT department." />;
  if (!isAvailable) return <RequirementState icon={CalendarClock} title="Submissions are currently closed" copy={`The ${windowConfig.periodLabel} collection window is not accepting responses.`} />;
  if (submitted) return <RequirementState icon={CheckCircle2} title="Requirement submitted" copy="Your IT department has received the request. You may safely close this page." success />;

  return (
    <main className="requirement-public-page">
      <header className="requirement-brand"><div><ShieldCheck size={23} /><strong>AssetFlow</strong></div><span>Department planning portal</span></header>
      <section className="requirement-intro">
        <span className="requirement-open"><i />SUBMISSIONS OPEN</span>
        <h1>{windowConfig.title}</h1>
        <p>Tell the IT team what your department will need during the next two months. Include the required date and a clear business reason.</p>
        <div><span><CalendarClock size={16} />{windowConfig.periodLabel}</span><span><Clock3 size={16} />Closes {new Date(windowConfig.closesAt).toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span></div>
      </section>
      <form className="requirement-public-form" onSubmit={async (event) => {
        event.preventDefault();
        setSending(true);
        const id = crypto.randomUUID();
        await saveRecord("requirements", {
          id,
          ...form,
          quantity: Number(form.quantity),
          status: "Pending",
          createdAt: new Date().toISOString(),
        });
        setSending(false);
        setSubmitted(true);
      }}>
        <div className="requirement-section-title"><span>01</span><div><h2>Requestor details</h2><p>Who should IT contact about this requirement?</p></div></div>
        <div className="public-form-grid">
          <label>Your name<input required placeholder="Full name" {...field("requesterName")} /></label>
          <label>Work email<input required type="email" placeholder="name@scot.lk" {...field("requesterEmail")} /></label>
          <label className="public-form-full">Department<select {...field("department")}>{departments.map((department) => <option key={department}>{department}</option>)}</select></label>
        </div>
        <div className="requirement-section-title"><span>02</span><div><h2>What do you need?</h2><p>One item or licence type per submission.</p></div></div>
        <div className="public-form-grid">
          <label className="public-form-full">Item or licence<input required placeholder="e.g. 24-inch monitor, office chair or Microsoft 365 licence" {...field("item")} /></label>
          <label>Quantity<input required min="1" max="500" type="number" {...field("quantity")} /></label>
          <label>Required by<input required type="date" {...field("neededDate")} /></label>
          <label className="public-form-full">Business reason<textarea required minLength={15} placeholder="Explain the upcoming employee, replacement, project or operational need…" {...field("reason")} /></label>
        </div>
        <div className="requirement-form-foot"><p><ShieldCheck size={15} />Your response is securely sent to the IT asset team.</p><button disabled={sending} type="submit"><Send size={17} />{sending ? "Submitting…" : "Submit requirement"}</button></div>
      </form>
      <footer className="requirement-public-footer"><Building2 size={14} />SCOT · Internal Resource Planning</footer>
    </main>
  );
}

function RequirementState({ icon: Icon, title, copy, success = false }: { icon: typeof Clock3; title: string; copy?: string; success?: boolean }) {
  return <main className="requirement-state"><div className={success ? "success" : ""}><Icon size={32} /><h1>{title}</h1>{copy && <p>{copy}</p>}<span>AssetFlow · SCOT</span></div></main>;
}
