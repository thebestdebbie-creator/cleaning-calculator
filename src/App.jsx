import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TIME CALCULATION
// Linear interpolation within each user-defined bracket (maintenance hours)
// ─────────────────────────────────────────────────────────────────────────────
function maintenanceHours(sqft) {
  if (sqft <= 1000) return 3.0;
  if (sqft <= 1550) return 3.0  + (sqft - 1000) / (1550 - 1000) * (3.75 - 3.0);
  if (sqft <= 2200) return 3.75 + (sqft - 1550) / (2200 - 1550) * (4.5  - 3.75);
  if (sqft <= 2400) return 4.75 + (sqft - 2200) / (2400 - 2200) * (5.25 - 4.75);
  // 2400+ — continue at same rate as final bracket (0.0025 hrs/sqft)
  return 5.25 + (sqft - 2400) * (0.5 / 200);
}

function getHours(sqft, serviceType) {
  const m = maintenanceHours(sqft);
  if (serviceType === "maintenance") return m;
  if (serviceType === "deep")        return m * 1.75;
  if (serviceType === "moveInOut")   return m * 2.0;
  return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// RATES
// ─────────────────────────────────────────────────────────────────────────────
const RATES = {
  edmonton: { maintenance: 50, deep: 55, moveInOut: 55 },
  leduc:    { maintenance: 45, deep: 50, moveInOut: 50 },
};

function getRate(location, serviceType) {
  return RATES[location][serviceType];
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const SERVICE_TYPES = [
  { key: "maintenance", label: "Maintenance Clean",   desc: "Regular recurring clean · standard rate" },
  { key: "deep",        label: "Deep Clean",          desc: "Thorough top-to-bottom · premium rate" },
  { key: "moveInOut",   label: "Move In / Move Out",  desc: "Full vacant home · premium rate · 2× time" },
];

const FREQUENCIES = [
  { key: "oneTime",  label: "One-Time",  discount: 0,    note: "" },
  { key: "monthly",  label: "Monthly",   discount: 0.05, note: "5% off" },
  { key: "biweekly", label: "Bi-Weekly", discount: 0.10, note: "10% off" },
  { key: "weekly",   label: "Weekly",    discount: 0.15, note: "15% off" },
];

const MULTIPLIERS = [
  { key: "standard", label: "Standard",  sub: "Typical home",                                         factor: 1.0 },
  { key: "level1",   label: "Level 1",   sub: "Busier home — pet or young child",                     factor: 1.1 },
  { key: "level2",   label: "Level 2",   sub: "High traffic — multiple pets, 4+ people, extra clutter", factor: 1.2 },
];

// ─────────────────────────────────────────────────────────────────────────────
// COLOURS — light background, blue + black
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  pageBg:        "#f0f4f8",
  white:         "#ffffff",
  // Blues
  blue900:       "#0d2d5e",
  blue700:       "#1a56a0",
  blue600:       "#2563eb",
  blue500:       "#3b82f6",
  blue100:       "#dbeafe",
  blue50:        "#eff6ff",
  // Neutrals
  black:         "#0f172a",
  grey700:       "#334155",
  grey500:       "#64748b",
  grey400:       "#94a3b8",
  grey200:       "#e2e8f0",
  grey100:       "#f1f5f9",
  // Active state
  activeBg:      "#eff6ff",
  activeBorder:  "#2563eb",
  activeText:    "#1a56a0",
  // Cards
  border:        "#e2e8f0",
  shadow:        "0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd:      "0 4px 12px rgba(0,0,0,0.08)",
  // Summary card (dark navy)
  navyBg:        "#0d2d5e",
  navyBorder:    "#1a4a8a",
  navyText:      "#ffffff",
  navyMid:       "#93c5fd",
  navySubtle:    "#60a5fa",
  navyDim:       "#1e4a7a",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmt = v => `$${typeof v === "number" && !Number.isInteger(v) ? v.toFixed(2) : v}`;
const fmtHrs = h => {
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (mins === 0) return `${hrs} hr${hrs !== 1 ? "s" : ""}`;
  if (hrs  === 0) return `${mins} min`;
  return `${hrs} hr${hrs !== 1 ? "s" : ""} ${mins} min`;
};
const monthlyVisits = k => k === "weekly" ? 4.33 : k === "biweekly" ? 2.17 : k === "monthly" ? 1 : 0;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CleaningCalculator() {
  const [location,    setLocation]    = useState("edmonton");
  const [sqft,        setSqft]        = useState(1500);
  const [serviceType, setServiceType] = useState("maintenance");
  const [multiplier,  setMultiplier]  = useState("standard");
  const [frequency,   setFrequency]   = useState("biweekly");

  const rate       = getRate(location, serviceType);
  const deepRate   = getRate(location, "deep");
  const freqObj    = FREQUENCIES.find(f => f.key === frequency);
  const multFactor = MULTIPLIERS.find(m => m.key === multiplier).factor;

  // ── Hours ──────────────────────────────────────────────────────────────────
  const jobHours      = getHours(sqft, serviceType);
  const adjHours      = jobHours * multFactor;       // multiplier affects time
  const initialHours  = maintenanceHours(sqft) * 1.75 * multFactor; // initial deep clean

  // ── Base price ─────────────────────────────────────────────────────────────
  const rawPrice      = adjHours * rate;
  const discount      = serviceType === "maintenance" ? freqObj.discount : 0;
  const discountAmt   = rawPrice * discount;
  const jobPrice      = rawPrice - discountAmt;

  // ── Initial deep clean (maintenance only) ─────────────────────────────────
  const initialPrice  = initialHours * deepRate;     // no frequency discount — one-time

  // ── Monthly revenue ────────────────────────────────────────────────────────
  const visits        = monthlyVisits(frequency);
  const monthlyRev    = serviceType === "maintenance" && frequency !== "oneTime"
    ? jobPrice * visits
    : null;

  const sqftBracket = sqft <= 1000 ? "≤ 1,000"
    : sqft <= 1550 ? "1,001 – 1,550"
    : sqft <= 2200 ? "1,551 – 2,200"
    : sqft <= 2400 ? "2,201 – 2,400"
    : "2,401+";

  let s = 1;
  const sn = () => String(s++).padStart(2, "0");

  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, fontFamily: "'Helvetica Neue', Arial, sans-serif", color: C.black }}>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.grey200}`, padding: "28px 32px 24px", boxShadow: C.shadow }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.blue600, marginBottom: 6 }}>
            Edmonton &amp; Leduc Area
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: C.blue900, letterSpacing: "-0.02em" }}>
            Cleaning Quote Calculator
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: C.grey500 }}>
            Square footage based pricing · all rates calculated per hour
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px 48px" }}>

        {/* ── 01 LOCATION ─────────────────────────────────────────────────── */}
        <Section num={sn()} title="Location">
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { key: "edmonton", label: "Edmonton", rates: "$50/hr standard · $55/hr deep" },
              { key: "leduc",    label: "Leduc / Area", rates: "$45/hr standard · $50/hr deep" },
            ].map(l => (
              <ChoiceCard key={l.key} active={location === l.key} onClick={() => setLocation(l.key)} flex>
                <div style={{ fontWeight: 700, fontSize: 15, color: location === l.key ? C.activeText : C.black }}>{l.label}</div>
                <div style={{ fontSize: 11, color: location === l.key ? C.blue600 : C.grey500, marginTop: 3 }}>{l.rates}</div>
              </ChoiceCard>
            ))}
          </div>
        </Section>

        {/* ── 02 SQUARE FOOTAGE ───────────────────────────────────────────── */}
        <Section num={sn()} title="Home Size (Square Footage)">
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 20px 16px", boxShadow: C.shadow }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <input
                type="number" value={sqft} min={400} max={8000} step={50}
                onChange={e => setSqft(Math.max(400, Math.min(8000, Number(e.target.value))))}
                style={{ background: C.blue50, border: `2px solid ${C.blue500}`, borderRadius: 8, color: C.blue900, fontSize: 26, fontFamily: "monospace", fontWeight: 800, padding: "8px 14px", width: 140, outline: "none" }}
              />
              <div>
                <div style={{ fontSize: 13, color: C.grey500 }}>sq ft · cleanable area</div>
                <div style={{ fontSize: 12, color: C.blue600, marginTop: 2, fontWeight: 600 }}>
                  Bracket: {sqftBracket}
                </div>
              </div>
            </div>
            <input
              type="range" min={400} max={5000} step={50}
              value={Math.min(sqft, 5000)}
              onChange={e => setSqft(Number(e.target.value))}
              style={{ width: "100%", accentColor: C.blue600, cursor: "pointer", height: 6 }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.grey400, marginTop: 5, fontFamily: "monospace" }}>
              {["400","1,000","1,550","2,200","2,400","3,500","5,000+"].map(v => <span key={v}>{v}</span>)}
            </div>

            {/* Time bracket reference table */}
            <div style={{ marginTop: 14, borderTop: `1px solid ${C.grey200}`, paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.grey500, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Maintenance time brackets</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                {[
                  ["≤ 1,000", "3 hrs"],
                  ["1,001–1,550", "3–3h 45m"],
                  ["1,551–2,200", "3h 45m–4h 30m"],
                  ["2,201–2,400", "4h 45m–5h 15m"],
                  ["2,401+", "5h 15m+"],
                ].map(([range, time]) => {
                  const isActive =
                    (range === "≤ 1,000"      && sqft <= 1000) ||
                    (range === "1,001–1,550"   && sqft > 1000  && sqft <= 1550) ||
                    (range === "1,551–2,200"   && sqft > 1550  && sqft <= 2200) ||
                    (range === "2,201–2,400"   && sqft > 2200  && sqft <= 2400) ||
                    (range === "2,401+"        && sqft > 2400);
                  return (
                    <div key={range} style={{ padding: "7px 8px", borderRadius: 7, background: isActive ? C.blue100 : C.grey100, border: `1px solid ${isActive ? C.blue500 : C.grey200}`, textAlign: "center" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: isActive ? C.blue700 : C.grey500, fontFamily: "monospace" }}>{range}</div>
                      <div style={{ fontSize: 10, color: isActive ? C.blue900 : C.grey500, marginTop: 2 }}>{time}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Section>

        {/* ── 03 SERVICE TYPE ─────────────────────────────────────────────── */}
        <Section num={sn()} title="Service Type">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SERVICE_TYPES.map(sv => {
              const on    = serviceType === sv.key;
              const svRate = getRate(location, sv.key);
              const hrs   = getHours(sqft, sv.key) * multFactor;
              const price = hrs * svRate;
              return (
                <button key={sv.key} onClick={() => setServiceType(sv.key)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: on ? C.activeBg : C.white, border: `1.5px solid ${on ? C.activeBorder : C.border}`, borderRadius: 10, cursor: "pointer", transition: "all 0.15s", textAlign: "left", boxShadow: on ? `0 0 0 3px ${C.blue100}` : C.shadow }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: on ? C.activeText : C.black }}>{sv.label}</div>
                    <div style={{ fontSize: 12, marginTop: 3, color: on ? C.blue600 : C.grey500 }}>
                      {sv.desc}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: on ? C.blue700 : C.grey500, fontFamily: "monospace" }}>{fmt(Math.round(price))}</div>
                    <div style={{ fontSize: 11, color: on ? C.blue500 : C.grey400, marginTop: 2 }}>~{fmtHrs(hrs)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── 04 HOME CONDITION ───────────────────────────────────────────── */}
        <Section num={sn()} title="Home Condition">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {MULTIPLIERS.map(m => {
              const on = multiplier === m.key;
              return (
                <button key={m.key} onClick={() => setMultiplier(m.key)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", background: on ? C.activeBg : C.white, border: `1.5px solid ${on ? C.activeBorder : C.border}`, borderRadius: 10, cursor: "pointer", transition: "all 0.15s", textAlign: "left", boxShadow: on ? `0 0 0 3px ${C.blue100}` : C.shadow }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <CB checked={on} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: on ? C.activeText : C.black }}>{m.label}</div>
                      <div style={{ fontSize: 12, color: on ? C.blue600 : C.grey500, marginTop: 2 }}>{m.sub}</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: on ? C.blue700 : C.grey400 }}>
                    {m.factor === 1.0 ? "—" : `+${Math.round((m.factor - 1) * 100)}%`}
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── 05 FREQUENCY (maintenance only) ─────────────────────────────── */}
        <Section num={sn()} title={serviceType === "maintenance" ? "Cleaning Frequency" : "Frequency"}>
          {serviceType !== "maintenance" && (
            <div style={{ marginBottom: 10, fontSize: 13, color: C.grey500, padding: "8px 12px", background: C.grey100, borderRadius: 8 }}>
              Frequency discounts apply to maintenance cleans only. Deep cleans and move-in/out are typically one-time.
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {FREQUENCIES.map(f => {
              const on = frequency === f.key;
              const disabled = serviceType !== "maintenance" && f.key !== "oneTime";
              return (
                <button key={f.key} onClick={() => !disabled && setFrequency(f.key)} style={{ padding: "12px 16px", background: disabled ? C.grey100 : on ? C.activeBg : C.white, border: `1.5px solid ${disabled ? C.grey200 : on ? C.activeBorder : C.border}`, borderRadius: 10, cursor: disabled ? "default" : "pointer", transition: "all 0.15s", textAlign: "left", opacity: disabled ? 0.45 : 1, boxShadow: on ? `0 0 0 3px ${C.blue100}` : C.shadow }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: on ? C.activeText : C.black }}>{f.label}</div>
                  {f.discount > 0
                    ? <div style={{ fontSize: 12, color: on ? C.blue600 : C.grey500, marginTop: 2 }}>{f.note}</div>
                    : <div style={{ fontSize: 12, color: C.grey400, marginTop: 2 }}>no discount</div>
                  }
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── ESTIMATED TIME BLOCK ────────────────────────────────────────── */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 20, boxShadow: C.shadow }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.grey500, marginBottom: 14 }}>Estimated Job Time</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <TimeRow label={`${SERVICE_TYPES.find(sv => sv.key === serviceType).label}`} hours={adjHours} sub={`${sqft.toLocaleString()} sq ft${multFactor > 1 ? ` · Level ${multiplier === "level1" ? 1 : 2} condition` : ""}`} />
            {serviceType === "maintenance" && (
              <TimeRow label="Initial deep clean (first visit only)" hours={initialHours} sub="Required before recurring maintenance · 1.75× maintenance time" highlight />
            )}
          </div>

          <div style={{ borderTop: `1px solid ${C.grey200}`, marginTop: 12, paddingTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.grey700 }}>Ongoing visit time</span>
              <span style={{ fontSize: 26, fontWeight: 800, color: C.blue700, fontFamily: "monospace" }}>~{fmtHrs(adjHours)}</span>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ height: 7, borderRadius: 4, background: C.grey200, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${C.blue600}, ${C.blue500})`, width: `${Math.min(100, (adjHours / 12) * 100)}%`, transition: "width 0.3s ease" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.grey400, marginTop: 4, fontFamily: "monospace" }}>
                {["0h","2h","4h","6h","8h","10h","12h+"].map(v => <span key={v}>{v}</span>)}
              </div>
            </div>
          </div>
        </div>

        {/* ── QUOTE SUMMARY ───────────────────────────────────────────────── */}
        <div style={{ background: C.navyBg, border: `1px solid ${C.navyBorder}`, borderRadius: 14, padding: "26px 24px", boxShadow: "0 8px 24px rgba(13,45,94,0.25)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.navySubtle, marginBottom: 18 }}>Quote Summary</div>

          {/* Line items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Base price */}
            <SummaryRow
              label={`${SERVICE_TYPES.find(sv => sv.key === serviceType).label} · ${sqft.toLocaleString()} sq ft`}
              sub={`${fmtHrs(adjHours)} @ $${rate}/hr${multFactor > 1 ? ` · ${MULTIPLIERS.find(m => m.key === multiplier).label} (+${Math.round((multFactor - 1) * 100)}%)` : ""}`}
              value={fmt(Math.round(rawPrice))}
            />

            {/* Frequency discount */}
            {discount > 0 && serviceType === "maintenance" && (
              <SummaryRow
                label={`${freqObj.label} frequency discount`}
                sub={`${Math.round(discount * 100)}% off recurring visits`}
                value={`-${fmt(Math.round(discountAmt))}`}
                accent
              />
            )}

            {/* Divider */}
            <div style={{ borderTop: `1px solid ${C.navyDim}`, margin: "4px 0" }} />

            {/* Per-visit total */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <div style={{ fontSize: 14, color: C.navyMid }}>
                  {serviceType === "maintenance" && frequency !== "oneTime" ? `Per visit (${freqObj.label})` : "Total"}
                </div>
                <div style={{ fontSize: 12, color: C.navySubtle, marginTop: 2 }}>~{fmtHrs(adjHours)} per visit</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 42, fontWeight: 900, color: C.navyText, fontFamily: "monospace", lineHeight: 1 }}>{fmt(Math.round(jobPrice))}</div>
              </div>
            </div>

            {/* Initial deep clean — maintenance only */}
            {serviceType === "maintenance" && (
              <>
                <div style={{ borderTop: `1px solid ${C.navyDim}`, margin: "8px 0 4px" }} />
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 9, padding: "14px 16px", border: `1px solid rgba(147,197,253,0.2)` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.navySubtle, marginBottom: 10 }}>Required Initial Visit</div>
                  <SummaryRow
                    label="Initial deep clean (one-time)"
                    sub={`${fmtHrs(initialHours)} @ $${deepRate}/hr · 1.75× maintenance time`}
                    value={fmt(Math.round(initialPrice))}
                  />
                  <div style={{ marginTop: 10, fontSize: 12, color: C.navySubtle, lineHeight: 1.5 }}>
                    All maintenance clients begin with a deep clean before recurring visits start. This is a one-time charge and is not subject to the frequency discount.
                  </div>
                </div>
              </>
            )}

            {/* Monthly + Annual revenue */}
            {monthlyRev && (
              <>
                <div style={{ borderTop: `1px solid ${C.navyDim}`, margin: "4px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, color: C.navyMid }}>Est. monthly revenue</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.navySubtle, fontFamily: "monospace" }}>{fmt(Math.round(jobPrice * visits))}/mo</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <div style={{ fontSize: 13, color: C.navyMid }}>Est. annual revenue</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.navySubtle, fontFamily: "monospace" }}>{fmt(Math.round(jobPrice * visits * 12))}/yr</div>
                </div>
                <div style={{ fontSize: 11, color: C.navySubtle, marginTop: 4 }}>
                  Based on ~{visits.toFixed(2)} visits/month ({freqObj.label.toLowerCase()}) · 12 months
                </div>
              </>
            )}
          </div>

          {/* Footer strip */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.navyDim}`, display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12, color: C.navySubtle }}>
            <span>📍 {location === "edmonton" ? "Edmonton" : "Leduc / Area"}</span>
            <span>📐 {sqft.toLocaleString()} sq ft</span>
            <span>⏱ ${rate}/hr</span>
            {multFactor > 1 && <span>✦ {MULTIPLIERS.find(m => m.key === multiplier).label} home</span>}
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: C.grey400 }}>
          Prices calculated as hours × hourly rate · adjust rates in code to match your costs
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Section({ num, title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: C.blue600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>{num}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.grey700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</div>
      </div>
      {children}
    </div>
  );
}

function ChoiceCard({ active, onClick, children, flex }) {
  return (
    <button onClick={onClick} style={{ flex: flex ? 1 : "none", padding: "14px 16px", background: active ? C.activeBg : C.white, border: `1.5px solid ${active ? C.activeBorder : C.border}`, borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "all 0.15s", boxShadow: active ? `0 0 0 3px ${C.blue100}` : C.shadow }}>
      {children}
    </button>
  );
}

function CB({ checked }) {
  return (
    <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, border: `2px solid ${checked ? C.blue600 : C.grey400}`, background: checked ? C.blue600 : C.white, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {checked && <span style={{ color: "white", fontSize: 12, fontWeight: 900, lineHeight: 1 }}>✓</span>}
    </div>
  );
}

function TimeRow({ label, hours, sub, highlight }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: highlight ? "10px 12px" : "4px 0", background: highlight ? C.blue50 : "transparent", borderRadius: highlight ? 8 : 0, border: highlight ? `1px solid ${C.blue100}` : "none" }}>
      <div>
        <div style={{ fontSize: 13, color: highlight ? C.blue700 : C.grey700, fontWeight: highlight ? 600 : 400 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: highlight ? C.blue500 : C.grey400, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: highlight ? C.blue700 : C.grey600, flexShrink: 0, marginLeft: 12 }}>~{fmtHrs(hours)}</div>
    </div>
  );
}

function SummaryRow({ label, sub, value, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: C.navyText }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: C.navySubtle, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, color: accent ? "#86efac" : C.navyText, flexShrink: 0, marginLeft: 16 }}>{value}</div>
    </div>
  );
}
