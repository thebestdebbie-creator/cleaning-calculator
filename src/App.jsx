import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// REGULAR SERVICE TYPES (sqft-based pricing)
// ─────────────────────────────────────────────────────────────────────────────
const SERVICES = [
  { key: "oneTime",  label: "One-Time Clean",                  desc: "Single visit or first visit",               sqftPerHour: 250, rateType: "premium"  },
  { key: "weekly",   label: "Recurring — Weekly",              desc: "Ongoing weekly maintenance clean",                  sqftPerHour: 750, rateType: "standard" },
  { key: "biweekly", label: "Recurring — Bi-Weekly",           desc: "Ongoing every-two-weeks maintenance clean",         sqftPerHour: 650, rateType: "standard" },
  { key: "monthly",  label: "Recurring — Monthly",             desc: "Ongoing monthly maintenance clean",                 sqftPerHour: 450, rateType: "standard" },
];

// ─────────────────────────────────────────────────────────────────────────────
// HOURLY RATES
// ─────────────────────────────────────────────────────────────────────────────
const RATES = {
  edmonton: { standard: 50, premium: 55 },
  leduc:    { standard: 45, premium: 50 },
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTIPLIERS
// ─────────────────────────────────────────────────────────────────────────────
const MULTIPLIERS = [
  { key: "standard", label: "Standard", sub: "Typical home",                                              factor: 1.0 },
  { key: "level1",   label: "Level 1",  sub: "Busier home — pet or young child",                          factor: 1.1 },
  { key: "level2",   label: "Level 2",  sub: "High traffic — multiple pets, 4+ people, extra clutter",    factor: 1.2 },
  { key: "code red",   label: "Code Red",  sub: "Standard maintenance, never been cleaned",    factor: 1.4 },
  { key: "deep",   label: "Deep",  sub: "Extra detail, cabinets",    factor: 1.5 },
  { key: "Move",   label: "Move",  sub: "Extra detail, cabinets in and out",    factor: 1.7 },
];

// Monthly visit counts for revenue estimate
const MONTHLY_VISITS = { weekly: 4.33, biweekly: 2.17, monthly: 1 };

// ─────────────────────────────────────────────────────────────────────────────
// COLOURS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  pageBg:       "#f0f4f8",
  white:        "#ffffff",
  blue900:      "#0d2d5e",
  blue700:      "#1a56a0",
  blue600:      "#2563eb",
  blue500:      "#3b82f6",
  blue200:      "#bfdbfe",
  blue100:      "#dbeafe",
  blue50:       "#eff6ff",
  black:        "#0f172a",
  grey700:      "#334155",
  grey500:      "#64748b",
  grey400:      "#94a3b8",
  grey200:      "#e2e8f0",
  grey100:      "#f1f5f9",
  activeBg:     "#eff6ff",
  activeBorder: "#2563eb",
  activeText:   "#1a56a0",
  border:       "#e2e8f0",
  shadow:       "0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  navyBg:       "#0d2d5e",
  navyBorder:   "#1a4a8a",
  navyText:     "#ffffff",
  navyMid:      "#93c5fd",
  navySubtle:   "#60a5fa",
  navyDim:      "#1e4a7a",
  green:        "#86efac",
  amber:        "#fcd34d",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmt = v => `$${Math.round(v).toLocaleString()}`;
const fmtHrs = h => {
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (mins === 0) return `${hrs} hr${hrs !== 1 ? "s" : ""}`;
  if (hrs  === 0) return `${mins} min`;
  return `${hrs} hr${hrs !== 1 ? "s" : ""} ${mins} min`;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CleaningCalculator() {
  const [location,     setLocation]     = useState("edmonton");
  const [sqft,         setSqft]         = useState(1500);
  const [hasBasement,  setHasBasement]  = useState(false);
  const [serviceKey,   setServiceKey]   = useState("biweekly");
  const [multiplier,   setMultiplier]   = useState("standard");
  const [km,           setKm]           = useState(0);

  // ── Derived values ─────────────────────────────────────────────────────────
  const service       = SERVICES.find(s => s.key === serviceKey);
  const effectiveSqft = hasBasement ? Math.round(sqft * (4 / 3)) : sqft;
  const rate          = RATES[location][service.rateType];
  const multFactor    = MULTIPLIERS.find(m => m.key === multiplier).factor;

  const hours         = effectiveSqft / service.sqftPerHour;
  const adjHours      = hours * multFactor;
  const basePrice     = adjHours * rate;
  const mileageCharge = calcMileage(location, km);
  const totalPrice    = basePrice + mileageCharge;

  // ── Revenue (recurring only) ───────────────────────────────────────────────
  const visitsPerMonth = MONTHLY_VISITS[serviceKey] || null;
  const monthlyRev     = visitsPerMonth ? totalPrice * visitsPerMonth : null;
  const annualRev      = monthlyRev ? monthlyRev * 12 : null;

  // ── Mileage display helpers ────────────────────────────────────────────────
  const { threshold, chargePerBracket } = MILEAGE[location];
  const kmOver         = Math.max(0, km - threshold);
  const brackets       = kmOver > 0 ? Math.ceil(kmOver / 10) : 0;

  let s = 1;
  const sn = () => String(s++).padStart(2, "0");

  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, fontFamily: "'Helvetica Neue', Arial, sans-serif", color: C.black }}>

      {/* ── HEADER ── */}
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

        {/* ── 01 LOCATION ── */}
        <Section num={sn()} title="Location">
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { key: "edmonton", label: "Edmonton",     sub: `Standard $50/hr · Premium $55/hr · Mileage over ${MILEAGE.edmonton.threshold} km` },
              { key: "leduc",    label: "Leduc / Area", sub: `Standard $45/hr · Premium $50/hr · Mileage over ${MILEAGE.leduc.threshold} km` },
            ].map(l => (
              <ChoiceCard key={l.key} active={location === l.key} onClick={() => setLocation(l.key)} flex>
                <div style={{ fontWeight: 700, fontSize: 15, color: location === l.key ? C.activeText : C.black }}>{l.label}</div>
                <div style={{ fontSize: 11, color: location === l.key ? C.blue600 : C.grey500, marginTop: 3 }}>{l.sub}</div>
              </ChoiceCard>
            ))}
          </div>
        </Section>

        {/* ── 02 SQUARE FOOTAGE ── */}
        <Section num={sn()} title="Home Size (Square Footage)">
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 20px 16px", boxShadow: C.shadow }}>

            {/* Input row */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <input
                type="number" value={sqft} min={400} max={8000} step={50}
                onChange={e => setSqft(Math.max(400, Math.min(8000, Number(e.target.value))))}
                style={{ background: C.blue50, border: `2px solid ${C.blue500}`, borderRadius: 8, color: C.blue900, fontSize: 26, fontFamily: "monospace", fontWeight: 800, padding: "8px 14px", width: 140, outline: "none" }}
              />
              <div>
                <div style={{ fontSize: 13, color: C.grey500 }}>sq ft · main floor area</div>
                {hasBasement && (
                  <div style={{ fontSize: 12, color: C.blue600, marginTop: 3, fontWeight: 600 }}>
                    + {Math.round(sqft / 3).toLocaleString()} sq ft basement = <span style={{ color: C.blue900 }}>{effectiveSqft.toLocaleString()} sq ft total</span>
                  </div>
                )}
              </div>
            </div>

            <input
              type="range" min={400} max={5000} step={50}
              value={Math.min(sqft, 5000)}
              onChange={e => setSqft(Number(e.target.value))}
              style={{ width: "100%", accentColor: C.blue600, cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.grey400, marginTop: 4, fontFamily: "monospace" }}>
              {["400", "1,000", "1,500", "2,000", "2,500", "3,500", "5,000+"].map(v => <span key={v}>{v}</span>)}
            </div>

            {/* Basement toggle */}
            <div style={{ marginTop: 16, borderTop: `1px solid ${C.grey200}`, paddingTop: 14 }}>
              <button
                onClick={() => setHasBasement(!hasBasement)}
                style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", background: hasBasement ? C.activeBg : C.grey100, border: `1.5px solid ${hasBasement ? C.activeBorder : C.grey200}`, borderRadius: 10, padding: "12px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
              >
                <Toggle on={hasBasement} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: hasBasement ? C.activeText : C.grey700 }}>
                    Finished Basement
                  </div>
                  <div style={{ fontSize: 12, color: hasBasement ? C.blue600 : C.grey500, marginTop: 2 }}>
                    {hasBasement
                      ? `Adds ${Math.round(sqft / 3).toLocaleString()} sq ft (⅓ of main floor) → ${effectiveSqft.toLocaleString()} sq ft total`
                      : "Adds ⅓ of the main floor square footage to the total"}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </Section>

        {/* ── 03 SERVICE TYPE ── */}
        <Section num={sn()} title="Service Type">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SERVICES.map(sv => {
              const on      = serviceKey === sv.key;
              const svRate  = RATES[location][sv.rateType];
              const svHours = (effectiveSqft / sv.sqftPerHour) * multFactor;
              const svPrice = svHours * svRate;
              const isPremium = sv.rateType === "premium";
              return (
                <button
                  key={sv.key}
                  onClick={() => setServiceKey(sv.key)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: on ? C.activeBg : C.white, border: `1.5px solid ${on ? C.activeBorder : C.border}`, borderRadius: 10, cursor: "pointer", transition: "all 0.15s", textAlign: "left", boxShadow: on ? `0 0 0 3px ${C.blue100}` : C.shadow }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: on ? C.activeText : C.black }}>{sv.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: isPremium ? (on ? C.blue200 : C.grey200) : (on ? C.blue100 : C.grey100), color: isPremium ? (on ? C.blue900 : C.grey600) : (on ? C.blue700 : C.grey500) }}>
                        ${svRate}/hr · {sv.sqftPerHour} sq ft/hr
                      </span>
                    </div>
                    <div style={{ fontSize: 12, marginTop: 3, color: on ? C.blue600 : C.grey500 }}>{sv.desc}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: on ? C.blue700 : C.grey500, fontFamily: "monospace" }}>{fmt(svPrice)}</div>
                    <div style={{ fontSize: 11, color: on ? C.blue500 : C.grey400, marginTop: 2 }}>~{fmtHrs(svHours)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── 04 HOME CONDITION ── */}
        <Section num={sn()} title="Home Condition">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {MULTIPLIERS.map(m => {
              const on = multiplier === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => setMultiplier(m.key)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", background: on ? C.activeBg : C.white, border: `1.5px solid ${on ? C.activeBorder : C.border}`, borderRadius: 10, cursor: "pointer", transition: "all 0.15s", textAlign: "left", boxShadow: on ? `0 0 0 3px ${C.blue100}` : C.shadow }}
                >
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

        {/* ── 05 MILEAGE ── */}
        <Section num={sn()} title="Mileage">
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 20px 16px", boxShadow: C.shadow }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="number" value={km} min={0} max={200} step={1}
                  onChange={e => setKm(Math.max(0, Math.min(200, Number(e.target.value))))}
                  style={{ background: C.blue50, border: `2px solid ${C.blue500}`, borderRadius: 8, color: C.blue900, fontSize: 26, fontFamily: "monospace", fontWeight: 800, padding: "8px 14px", width: 120, outline: "none" }}
                />
                <span style={{ fontSize: 16, color: C.grey500, fontWeight: 600 }}>km</span>
              </div>
              <div>
                <div style={{ fontSize: 13, color: C.grey500 }}>distance to job</div>
                <div style={{ fontSize: 12, marginTop: 3, fontWeight: 600, color: mileageCharge > 0 ? C.blue700 : C.grey400 }}>
                  {mileageCharge > 0
                    ? `${kmOver} km over threshold · ${brackets} bracket${brackets !== 1 ? "s" : ""} · +${fmt(mileageCharge)}`
                    : `No charge under ${threshold} km`}
                </div>
              </div>
            </div>
            <input
              type="range" min={0} max={120} step={1}
              value={Math.min(km, 120)}
              onChange={e => setKm(Number(e.target.value))}
              style={{ width: "100%", accentColor: mileageCharge > 0 ? C.blue600 : C.grey400, cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.grey400, marginTop: 4, fontFamily: "monospace" }}>
              {["0", "20", "40", "60", "80", "100", "120+"].map(v => <span key={v}>{v}</span>)}
            </div>
            {/* Mileage rate info */}
            <div style={{ marginTop: 12, padding: "10px 14px", background: C.grey100, borderRadius: 8, fontSize: 12, color: C.grey500 }}>
              {location === "edmonton"
                ? `Edmonton: no charge for first ${MILEAGE.edmonton.threshold} km · $${MILEAGE.edmonton.chargePerBracket} per additional 10 km after that`
                : `Leduc: no charge for first ${MILEAGE.leduc.threshold} km · $${MILEAGE.leduc.chargePerBracket} per additional 10 km after that`}
            </div>
          </div>
        </Section>

        {/* ── ESTIMATED TIME ── */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 20, boxShadow: C.shadow }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.grey500, marginBottom: 14 }}>Estimated Job Time</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <TimeRow
              label={`${effectiveSqft.toLocaleString()} sq ft ÷ ${service.sqftPerHour} sq ft/hr`}
              value={fmtHrs(hours)}
              sub={hasBasement ? `Main floor ${sqft.toLocaleString()} sq ft + basement ${Math.round(sqft / 3).toLocaleString()} sq ft` : undefined}
            />
            {multFactor > 1 && (
              <TimeRow
                label={`${MULTIPLIERS.find(m => m.key === multiplier).label} condition (+${Math.round((multFactor - 1) * 100)}%)`}
                value={`+${fmtHrs(adjHours - hours)}`}
              />
            )}
          </div>
          <div style={{ borderTop: `1px solid ${C.grey200}`, marginTop: 12, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.grey700 }}>Total estimated time</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: C.blue700, fontFamily: "monospace" }}>~{fmtHrs(adjHours)}</span>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 7, borderRadius: 4, background: C.grey200, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${C.blue600}, ${C.blue500})`, width: `${Math.min(100, (adjHours / 12) * 100)}%`, transition: "width 0.3s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.grey400, marginTop: 4, fontFamily: "monospace" }}>
              {["0h", "2h", "4h", "6h", "8h", "10h", "12h+"].map(v => <span key={v}>{v}</span>)}
            </div>
          </div>
        </div>

        {/* ── QUOTE SUMMARY ── */}
        <div style={{ background: C.navyBg, border: `1px solid ${C.navyBorder}`, borderRadius: 14, padding: "26px 24px", boxShadow: "0 8px 24px rgba(13,45,94,0.25)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.navySubtle, marginBottom: 18 }}>Quote Summary</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Base clean */}
            <SummaryRow
              label={service.label}
              sub={`${effectiveSqft.toLocaleString()} sq ft · ~${fmtHrs(adjHours)} @ $${rate}/hr${multFactor > 1 ? ` · ${MULTIPLIERS.find(m => m.key === multiplier).label} +${Math.round((multFactor - 1) * 100)}%` : ""}`}
              value={fmt(basePrice)}
            />

            {/* Mileage */}
            {mileageCharge > 0 && (
              <SummaryRow
                label="Mileage surcharge"
                sub={`${km} km · ${brackets} bracket${brackets !== 1 ? "s" : ""} of 10 km over ${threshold} km threshold · $${chargePerBracket} each`}
                value={`+${fmt(mileageCharge)}`}
              />
            )}

            {/* Divider + total */}
            <div style={{ borderTop: `1px solid ${C.navyDim}`, margin: "4px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <div style={{ fontSize: 14, color: C.navyMid }}>Total</div>
                <div style={{ fontSize: 12, color: C.navySubtle, marginTop: 2 }}>~{fmtHrs(adjHours)} · {effectiveSqft.toLocaleString()} sq ft</div>
              </div>
              <div style={{ fontSize: 44, fontWeight: 900, color: C.navyText, fontFamily: "monospace", lineHeight: 1 }}>
                {fmt(totalPrice)}
              </div>
            </div>

            {/* Revenue (recurring only) */}
            {monthlyRev && (
              <>
                <div style={{ borderTop: `1px solid ${C.navyDim}`, margin: "4px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, color: C.navyMid }}>Est. monthly revenue</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.navySubtle, fontFamily: "monospace" }}>{fmt(monthlyRev)}/mo</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, color: C.navyMid }}>Est. annual revenue</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.navySubtle, fontFamily: "monospace" }}>{fmt(annualRev)}/yr</div>
                </div>
                <div style={{ fontSize: 11, color: C.navySubtle }}>
                  Based on ~{visitsPerMonth.toFixed(2)} visits/month · 12 months
                </div>
              </>
            )}
          </div>

          {/* Footer strip */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.navyDim}`, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: C.navySubtle }}>
            <span>📍 {location === "edmonton" ? "Edmonton" : "Leduc / Area"}</span>
            <span>📐 {effectiveSqft.toLocaleString()} sq ft{hasBasement ? " (incl. basement)" : ""}</span>
            <span>⏱ ${rate}/hr</span>
            <span>🚗 {km} km{mileageCharge > 0 ? ` · +${fmt(mileageCharge)}` : " · no surcharge"}</span>
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

function Toggle({ on }) {
  return (
    <div style={{ width: 42, height: 24, borderRadius: 12, background: on ? C.blue600 : C.grey300, border: `2px solid ${on ? C.blue600 : C.grey400}`, position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
      <div style={{ width: 16, height: 16, borderRadius: 8, background: C.white, position: "absolute", top: 2, left: on ? 20 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </div>
  );
}

function CB({ checked }) {
  return (
    <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, border: `2px solid ${checked ? C.blue600 : C.grey400}`, background: checked ? C.blue600 : C.white, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {checked && <span style={{ color: "white", fontSize: 12, fontWeight: 900, lineHeight: 1 }}>✓</span>}
    </div>
  );
}

function TimeRow({ label, value, sub }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 13, color: C.grey700 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: C.grey400, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: C.grey600, flexShrink: 0, marginLeft: 12 }}>{value}</div>
    </div>
  );
}

function SummaryRow({ label, sub, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: C.navyText }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: C.navySubtle, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, color: C.navyText, flexShrink: 0, marginLeft: 16 }}>{value}</div>
    </div>
  );
}
