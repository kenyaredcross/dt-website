"use client";
import Link from "next/link";
import { useState } from "react";

export interface PartnershipOptions {
  countries: string[];
  organisation_types: string[];
  durations: string[];
  partnership_types: string[];
  areas_of_interest: string[];
  areas_of_operation: string[];
  geographic_scopes: string[];
}

type Status = "idle" | "loading" | "success" | "error";
type MultiKey = "areas_of_operation" | "partnership_types" | "areas_of_interest" | "geographic_scope";
type Errors = Partial<Record<string, string>>;

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL ?? "http://localhost:8001";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s()-]{7,20}$/;

// Order in which fields appear, used to focus the first invalid one.
const FIELD_ORDER = [
  "full_name", "organisation_name", "email", "phone", "job_title", "organisation_website", "country",
  "organisation_type", "year_established", "areas_of_operation", "organisation_description",
  "partnership_types", "areas_of_interest", "proposed_initiative", "expected_outcomes",
  "proposed_duration", "proposed_start_date", "geographic_scope",
];

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

function Field({ label, optional, error, children }: {
  label: string; optional?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <label className={`cx-field${error ? " bad" : ""}`}>
      <span>{label}{optional && <i> (optional)</i>}</span>
      {children}
      {error && <em className="px-err">{error}</em>}
    </label>
  );
}

function Chips({ name, label, options, value, onToggle, optional, hint, error }: {
  name: string; label: string; options: string[]; value: string[];
  onToggle: (option: string) => void; optional?: boolean; hint?: string; error?: string;
}) {
  return (
    <fieldset className={`cx-field px-chips${error ? " bad" : ""}`} id={`f-${name}`}>
      <legend>
        {label}{optional && <i> (optional)</i>}
        {hint && <small>{hint}</small>}
      </legend>
      <div className="cx-tabs">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button key={o} type="button" className={`cx-tab${on ? " on" : ""}`} aria-pressed={on} onClick={() => onToggle(o)}>
              {o}
            </button>
          );
        })}
      </div>
      {error && <em className="px-err">{error}</em>}
    </fieldset>
  );
}

function serverMessage(json: unknown): string | null {
  try {
    const raw = (json as { _server_messages?: string })._server_messages;
    if (!raw) return null;
    const first = JSON.parse(JSON.parse(raw)[0]);
    return String(first.message || "").replace(/<[^>]+>/g, "") || null;
  } catch {
    return null;
  }
}

export default function PartnerPage({ options }: { options: PartnershipOptions | null }) {
  const [multi, setMulti] = useState<Record<MultiKey, string[]>>({
    areas_of_operation: [], partnership_types: [], areas_of_interest: [], geographic_scope: [],
  });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [formError, setFormError] = useState("");
  const [reference, setReference] = useState("");

  const thisYear = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);

  function toggle(key: MultiKey, option: string) {
    setMulti((m) => ({
      ...m,
      [key]: m[key].includes(option) ? m[key].filter((v) => v !== option) : [...m[key], option],
    }));
    clearError(key);
  }

  // Drop a field's error as soon as the user edits it.
  function clearError(name: string) {
    if (!errors[name]) return;
    const next = { ...errors, [name]: undefined };
    setErrors(next);
    if (!Object.values(next).some(Boolean)) setFormError("");
  }

  function validate(fd: FormData): Errors {
    const v = (k: string) => String(fd.get(k) ?? "").trim();
    const e: Errors = {};
    if (!v("full_name")) e.full_name = "Enter your full name.";
    if (!v("organisation_name")) e.organisation_name = "Enter your organisation's name.";
    if (!v("email")) e.email = "Enter your official email address.";
    else if (!EMAIL_RE.test(v("email"))) e.email = "Enter a valid email address.";
    if (!v("phone")) e.phone = "Enter a phone number.";
    else if (!PHONE_RE.test(v("phone"))) e.phone = "Enter a valid phone number, e.g. +254 700 000000.";
    if (v("organisation_website")) {
      try { new URL(withScheme(v("organisation_website"))); } catch { e.organisation_website = "Enter a valid website address."; }
    }
    if (!v("country")) e.country = "Select a country.";
    if (!v("organisation_type")) e.organisation_type = "Select your organisation type.";
    if (v("year_established")) {
      const y = Number(v("year_established"));
      if (!Number.isInteger(y) || y < 1800 || y > thisYear) e.year_established = `Enter a year between 1800 and ${thisYear}.`;
    }
    if (!multi.areas_of_operation.length) e.areas_of_operation = "Select at least one area of operation.";
    if (!multi.partnership_types.length) e.partnership_types = "Select at least one type of partnership.";
    if (!multi.areas_of_interest.length) e.areas_of_interest = "Select at least one area of interest.";
    if (!v("proposed_initiative")) e.proposed_initiative = "Describe the partnership or initiative you have in mind.";
    if (v("proposed_start_date") && v("proposed_start_date") < today) e.proposed_start_date = "Choose today or a later date.";
    return e;
  }

  function focusFirst(e: Errors) {
    const first = FIELD_ORDER.find((k) => e[k]);
    if (!first) return;
    const el = document.querySelector<HTMLElement>(`[name="${first}"]`) ?? document.getElementById(`f-${first}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el && "focus" in el) el.focus({ preventScroll: true });
  }

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const e = validate(fd);
    setErrors(e);
    setFormError("");
    if (Object.keys(e).length) {
      setFormError("Please fix the highlighted fields.");
      focusFirst(e);
      return;
    }

    const body = new URLSearchParams();
    for (const [k, val] of fd.entries()) body.set(k, String(val).trim());
    if (body.get("organisation_website")) body.set("organisation_website", withScheme(body.get("organisation_website")!));
    for (const [k, list] of Object.entries(multi)) body.set(k, JSON.stringify(list));

    setStatus("loading");
    try {
      const res = await fetch(new URL("/api/method/krcs_dt_cms.dt_cms.api.submit_partnership_request", BASE), {
        method: "POST",
        body,
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 429) throw new Error("You have sent several requests already. Please try again later, or email us.");
      if (!res.ok) throw new Error(serverMessage(json) ?? "Something went wrong. Please try again, or email us directly.");
      setReference(json?.message?.name ?? "");
      setStatus("success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="cx px">
      <div className="vwm" aria-hidden="true">Partner<span>.</span></div>

      <div className="cx-float" aria-hidden="true">
        <span className="prj-shape prj-shape-1" />
        <span className="prj-shape prj-shape-2" />
        <span className="prj-shape prj-shape-3" />
        <span className="prj-shape prj-shape-dot" />
      </div>

      <div className="cx-in">
        <header className="cx-head">
          <span className="prj-eyebrow">Partner with us</span>
          <h1 className="cx-title">Let&apos;s build<br />together.</h1>
          <p className="cx-lead">
            Tell us about your organisation and the partnership you have in mind. Our team reviews
            every proposal and will get back to you.
          </p>
        </header>

        {status === "success" ? (
          <div className="cx-success">
            <div className="cx-success-mark">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2>Thank you for your proposal.</h2>
            <p>
              We have received your partnership request
              {reference && <> (reference <b>{reference}</b>)</>}. Our team will review it and be in touch.
            </p>
            <Link className="cb" href="/">Back to home <span className="ar"><ArrowIcon /></span></Link>
          </div>
        ) : !options ? (
          <div className="empty">
            <h3>The partnership form is unavailable right now</h3>
            <p>
              Please try again shortly, or send your proposal to{" "}
              <a href="mailto:digital@redcross.or.ke">digital@redcross.or.ke</a>.
            </p>
          </div>
        ) : (
          <div className="cx-grid">
            <form
              className="cx-card px-card"
              onSubmit={handleSubmit}
              onChange={(e) => {
                const t = e.target as unknown as { name?: string };
                if (t.name) clearError(t.name);
              }}
              noValidate
            >
              {/* honeypot: hidden from people, filled by bots. The name is
                  deliberately meaningless so browser autofill and password
                  managers leave it alone. */}
              <div className="px-hp" aria-hidden="true">
                <input
                  type="text"
                  name="dt_hp_7c1e"
                  tabIndex={-1}
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  data-bwignore
                  data-form-type="other"
                />
              </div>

              {/* ── A. Contact ── */}
              <div className="px-sec"><span>01</span><h2>Contact information</h2></div>
              <div className="cx-row">
                <Field label="Full name" error={errors.full_name}>
                  <input name="full_name" type="text" maxLength={140} autoComplete="name" placeholder="Henry Dunant" aria-invalid={!!errors.full_name} />
                </Field>
                <Field label="Organisation name" error={errors.organisation_name}>
                  <input name="organisation_name" type="text" maxLength={140} autoComplete="organization" placeholder="Your organisation" aria-invalid={!!errors.organisation_name} />
                </Field>
              </div>
              <div className="cx-row">
                <Field label="Official email address" error={errors.email}>
                  <input name="email" type="email" maxLength={140} autoComplete="email" placeholder="henry@organisation.org" aria-invalid={!!errors.email} />
                </Field>
                <Field label="Phone number" error={errors.phone}>
                  <input name="phone" type="tel" maxLength={20} autoComplete="tel" placeholder="+254 700 000000" aria-invalid={!!errors.phone} />
                </Field>
              </div>
              <div className="cx-row">
                <Field label="Job title / position" optional>
                  <input name="job_title" type="text" maxLength={140} autoComplete="organization-title" placeholder="Programme Director" />
                </Field>
                <Field label="Organisation website" optional error={errors.organisation_website}>
                  <input name="organisation_website" type="url" maxLength={140} autoComplete="url" placeholder="https://organisation.org" aria-invalid={!!errors.organisation_website} />
                </Field>
              </div>
              <Field label="Country" error={errors.country}>
                <select name="country" defaultValue={options.countries.includes("Kenya") ? "Kenya" : ""} aria-invalid={!!errors.country}>
                  <option value="" disabled>Select a country</option>
                  {options.countries.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>

              {/* ── B. Organisation ── */}
              <div className="px-sec"><span>02</span><h2>Organisation information</h2></div>
              <div className="cx-row">
                <Field label="Organisation type" error={errors.organisation_type}>
                  <select name="organisation_type" defaultValue="" aria-invalid={!!errors.organisation_type}>
                    <option value="" disabled>Select a type</option>
                    {options.organisation_types.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Year established" optional error={errors.year_established}>
                  <input name="year_established" type="number" inputMode="numeric" min={1800} max={thisYear} placeholder={String(thisYear - 10)} aria-invalid={!!errors.year_established} />
                </Field>
              </div>
              <Chips
                name="areas_of_operation" label="Area of operation" hint="Select all that apply"
                options={options.areas_of_operation} value={multi.areas_of_operation}
                onToggle={(o) => toggle("areas_of_operation", o)} error={errors.areas_of_operation}
              />
              <Field label="Organisation description" optional>
                <textarea name="organisation_description" rows={3} maxLength={2000} placeholder="What your organisation does, who you serve and where." />
              </Field>

              {/* ── C. Partnership ── */}
              <div className="px-sec"><span>03</span><h2>Partnership interest</h2></div>
              <Chips
                name="partnership_types" label="Type of partnership" hint="Select all that apply"
                options={options.partnership_types} value={multi.partnership_types}
                onToggle={(o) => toggle("partnership_types", o)} error={errors.partnership_types}
              />
              <Chips
                name="areas_of_interest" label="Areas of interest" hint="Select all that apply"
                options={options.areas_of_interest} value={multi.areas_of_interest}
                onToggle={(o) => toggle("areas_of_interest", o)} error={errors.areas_of_interest}
              />
              <Field label="Proposed partnership / initiative" error={errors.proposed_initiative}>
                <textarea name="proposed_initiative" rows={5} maxLength={5000} placeholder="Describe what you would like to do together, and why." aria-invalid={!!errors.proposed_initiative} />
              </Field>
              <Field label="Expected outcomes" optional>
                <textarea name="expected_outcomes" rows={3} maxLength={3000} placeholder="What change would this partnership create, and for whom?" />
              </Field>
              <div className="cx-row">
                <Field label="Proposed duration" optional>
                  <select name="proposed_duration" defaultValue="">
                    <option value="">Select a duration</option>
                    {options.durations.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Proposed start date" optional error={errors.proposed_start_date}>
                  <input name="proposed_start_date" type="date" min={today} aria-invalid={!!errors.proposed_start_date} />
                </Field>
              </div>
              <Chips
                name="geographic_scope" label="Geographic scope" optional
                options={options.geographic_scopes} value={multi.geographic_scope}
                onToggle={(o) => toggle("geographic_scope", o)}
              />

              {formError && <p className="cx-err" role="alert">{formError}</p>}

              <button className="cb cx-submit" type="submit" disabled={status === "loading"}>
                {status === "loading" ? "Sending..." : "Submit proposal"}
                <span className="ar"><ArrowIcon /></span>
              </button>
            </form>

            <aside className="cx-side">
              <div className="cx-side-block">
                <span className="cx-side-lbl">What happens next</span>
                <ol className="px-steps">
                  <li><b>We review your proposal</b> against our strategy and current programmes.</li>
                  <li><b>We set up a call</b> to understand your goals and explore fit.</li>
                  <li><b>We co-design the partnership</b>, including scope, roles and timelines.</li>
                </ol>
              </div>
              <div className="cx-side-block">
                <span className="cx-side-lbl">Prefer email?</span>
                <a href="mailto:digital@redcross.or.ke">digital@redcross.or.ke</a>
              </div>
              <div className="cx-side-block">
                <span className="cx-side-lbl">Something else?</span>
                <Link href="/contact">Use the general contact form</Link>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function withScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
