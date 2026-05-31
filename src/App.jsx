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
// PREMIUM SERVICE TIERS (bedroom/bathroom-based pricing)
// Base price covers 3 bedrooms + 2 full baths
// ─────────────────────────────────────────────────────────────────────────────
const PREMIUM_TIERS = {
  weekly: [
    { key: "signature", label: "Signature", base: 135, perBed:  7.50, perFullBath: 25, perHalfBath: 10, blurb: "Essential weekly maintenance" },
    { key: "elevation", label: "Elevation", base: 189, perBed: 10.00, perFullBath: 25, perHalfBath: 10, blurb: "Enhanced weekly service" },
    { key: "platinum",  label: "Platinum",  base: 249, perBed: 10.00, perFullBath: 25, perHalfBath: 10, blurb: "Top-tier weekly experience" },
  ],
  biweekly: [
    { key: "signature", label: "Signature", base: 155, perBed: 10.00, perFullBath: 30, perHalfBath: 15, blurb: "Essential bi-weekly maintenance" },
    { key: "elevation", label: "Elevation", base: 219, perBed: 10.00, perFullBath: 30, perHalfBath: 15, blurb: "Enhanced bi-weekly service" },
    { key: "platinum",  label: "Platinum",  base: 289, perBed: 10.00, perFullBath: 30, perHalfBath: 15, blurb: "Top-tier bi-weekly experience" },
  ],
};

const SERVICE_MODES = [
  { key: "regular",        label: "Regular Service",         sub: "Square-footage-based pricing for any service type" },
  { key: "premiumWeekly",  label: "Premium Weekly Service",  sub: "Tiered weekly pricing by bed/bath count" },
  { key: "premiumBiweekly",label: "Premium Bi-Weekly Service",sub: "Tiered bi-weekly pricing by bed/bath count" },
];

// ─────────────────────────────────────────────────────────────────────────────
// RATES
// ─────────────────────────────────────────────────────────────────────────────
const RATES = {
  edmonton: { standard: 50, premium: 55 },
  leduc:    { standard: 45, premium: 50 },
};

// ─────────────────────────────────────────────────────────────────────────────
// MILEAGE
// ─────────────────────────────────────────────────────────────────────────────
const MILEAGE = {
  edmonton: { threshold: 40, chargePerBracket: 15 },
  leduc:    { threshold: 20, chargePerBracket: 10 },
};

function calcMileage(location, km) {
  const { threshold, chargePerBracket } = MILEAGE[location];
  if (km <= threshold) return 0;
  return Math.ceil((km - threshold) / 10) * chargePerBracket;
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTIPLIERS (regular service only)
// ─────────────────────────────────────────────────────────────────────────────
const MULTIPLIERS = [
  { key: "standard", label: "Standard", sub: "Typical home",                                              factor: 1.0 },
  { key: "level1",   label: "Level 1",  sub: "Busier home — pet or young child",                          factor: 1.1 },
  { key: "level2",   label: "Level 2",  sub: "High traffic — multiple pets, 4+ people, extra clutter",    factor: 1.2 },
  { key: "code red",   label: "Code Red",  sub: "Standard maintenance, never been cleaned",    factor: 1.4 },
  { key: "deep",   label: "Deep",  sub: "Extra detail, cabinets",    factor: 1.5 },
  { key: "Move",   label: "Move",  sub: "Extra detail, cabinets in and out",    factor: 1.7 },
];

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
  grey300:      "#cbd5e1",
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
  gold:         "#d4a017",
  goldLight:    "#fde68a",
  goldDeep:     "#a07816",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmt = v => `$${Math.round(v).toLocaleString()}`;
const fmt2 = v => `$${(Math.round(v * 100) / 100).toFixed(2)}`;
const fmtHrs = h => {
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (mins === 0) return `${hrs} hr${hrs !== 1 ? "s" : ""}`;
  if (hrs  === 0) return `${mins} min`;
  return `${hrs} hr${hrs !== 1 ? "s" : ""} ${mins} min`;
};

function calcPremiumPrice(tier, bedrooms, fullBaths, halfBaths) {
  const extraBeds      = Math.max(0, bedrooms  - 3);
  const extraFullBaths = Math.max(0, fullBaths - 2);
  const extraHalfBaths = Math.max(0, halfBaths);
  return tier.base
    + extraBeds      * tier.perBed
    + extraFullBaths * tier.perFullBath
    + extraHalfBaths * tier.perHalfBath;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CleaningCalculator() {
  // Shared state
  const [location,    setLocation]    = useState("edmonton");
  const [serviceMode, setServiceMode] = useState("regular");
  const [sqft,        setSqft]        = useState(1500);
  const [hasBasement, setHasBasement] = useState(false);
  const [km,          setKm]          = useState(0);

  // Regular state
  const [serviceKey, setServiceKey] = useState("biweekly");
  const [multiplier, setMultiplier] = useState("standard");

  // Premium state
  const [premiumTier, setPremiumTier] = useState("signature");
  const [bedrooms,    setBedrooms]    = useState(3);
  const [fullBaths,   setFullBaths]   = useState(2);
  const [halfBaths,   setHalfBaths]   = useState(0);

  const isPremium      = serviceMode !== "regular";
  const premiumFreqKey = serviceMode === "premiumWeekly" ? "weekly" : "biweekly";

  // ── Effective sqft (used for initial deep clean too) ───────────────────────
  const effectiveSqft = hasBasement ? Math.round(sqft * (4 / 3)) : sqft;

  // ── Mileage ────────────────────────────────────────────────────────────────
  const mileageCharge  = calcMileage(location, km);
  const { threshold, chargePerBracket } = MILEAGE[location];
  const kmOver         = Math.max(0, km - threshold);
  const brackets       = kmOver > 0 ? Math.ceil(kmOver / 10) : 0;

  // ── REGULAR PRICING ────────────────────────────────────────────────────────
  const service     = SERVICES.find(s => s.key === serviceKey);
  const rate        = RATES[location][service?.rateType || "standard"];
  const multFactor  = MULTIPLIERS.find(m => m.key === multiplier).factor;
  const rawHours    = effectiveSqft / (service?.sqftPerHour || 100);
  const adjHours    = rawHours * multFactor + 0.5;
  const regBase     = adjHours * rate;
  const regTotal    = regBase + mileageCharge;

  // ── PREMIUM PRICING ────────────────────────────────────────────────────────
  const premiumTiers = PREMIUM_TIERS[premiumFreqKey];
  const tier         = premiumTiers.find(t => t.key === premiumTier);
  const premiumPrice = calcPremiumPrice(tier, bedrooms, fullBaths, halfBaths);
  const premiumTotal = premiumPrice + mileageCharge;

  // ── INITIAL DEEP CLEAN (for premium mode) ──────────────────────────────────
  const deepRate     = RATES[location].premium;
  const deepHours    = effectiveSqft / 100 + 0.5;  // deep clean: 100 sqft/hr + 30 min overhead
  const initialPrice = deepHours * deepRate + mileageCharge;

  // ── REVENUE ────────────────────────────────────────────────────────────────
  const visitsPerMonth = isPremium
    ? MONTHLY_VISITS[premiumFreqKey]
    : (MONTHLY_VISITS[serviceKey] || null);
  const visitTotal = isPremium ? premiumTotal : regTotal;
  const monthlyRev = visitsPerMonth ? visitTotal * visitsPerMonth : null;
  const annualRev  = monthlyRev ? monthlyRev * 12 : null;

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
            Square footage based pricing or premium tiered service plans
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

        {/* ── 02 SERVICE MODE ── */}
        <Section num={sn()} title="Service Mode">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SERVICE_MODES.map(m => {
              const on = serviceMode === m.key;
              const isModePremium = m.key !== "regular";
              return (
                <button key={m.key} onClick={() => setServiceMode(m.key)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: on ? (isModePremium ? "#fdf6e3" : C.activeBg) : C.white, border: `1.5px solid ${on ? (isModePremium ? C.gold : C.activeBorder) : C.border}`, borderRadius: 10, cursor: "pointer", transition: "all 0.15s", textAlign: "left", boxShadow: on ? `0 0 0 3px ${isModePremium ? C.goldLight : C.blue100}` : C.shadow }}>
                  {isModePremium && <span style={{ fontSize: 18 }}>✦</span>}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: on ? (isModePremium ? C.goldDeep : C.activeText) : C.black }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: on ? (isModePremium ? C.goldDeep : C.blue600) : C.grey500, marginTop: 2 }}>{m.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── 03 SQUARE FOOTAGE (always shown) ── */}
        <Section num={sn()} title={isPremium ? "Home Size (Square Footage) — for initial deep clean" : "Home Size (Square Footage)"}>
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 20px 16px", boxShadow: C.shadow }}>
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
            <input type="range" min={400} max={5000} step={50} value={Math.min(sqft, 5000)} onChange={e => setSqft(Number(e.target.value))} style={{ width: "100%", accentColor: C.blue600, cursor: "pointer" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.grey400, marginTop: 4, fontFamily: "monospace" }}>
              {["400","1,000","1,500","2,000","2,500","3,500","5,000+"].map(v => <span key={v}>{v}</span>)}
            </div>
            <div style={{ marginTop: 16, borderTop: `1px solid ${C.grey200}`, paddingTop: 14 }}>
              <button onClick={() => setHasBasement(!hasBasement)} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", background: hasBasement ? C.activeBg : C.grey100, border: `1.5px solid ${hasBasement ? C.activeBorder : C.grey200}`, borderRadius: 10, padding: "12px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                <Toggle on={hasBasement} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: hasBasement ? C.activeText : C.grey700 }}>Finished Basement</div>
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

        {/* ═══════════════════════════════════════════════════════════════════
            REGULAR SERVICE FLOW
            ═══════════════════════════════════════════════════════════════════ */}
        {!isPremium && (
          <>
            <Section num={sn()} title="Service Type">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {SERVICES.map(sv => {
                  const on      = serviceKey === sv.key;
                  const svRate  = RATES[location][sv.rateType];
                  const svHours = (effectiveSqft / sv.sqftPerHour) * multFactor + 0.5;
                  const svPrice = svHours * svRate;
                  const isPrem  = sv.rateType === "premium";
                  return (
                    <button key={sv.key} onClick={() => setServiceKey(sv.key)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: on ? C.activeBg : C.white, border: `1.5px solid ${on ? C.activeBorder : C.border}`, borderRadius: 10, cursor: "pointer", transition: "all 0.15s", textAlign: "left", boxShadow: on ? `0 0 0 3px ${C.blue100}` : C.shadow }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: on ? C.activeText : C.black }}>{sv.label}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: isPrem ? (on ? C.blue200 : C.grey200) : (on ? C.blue100 : C.grey100), color: isPrem ? (on ? C.blue900 : C.grey600) : (on ? C.blue700 : C.grey500) }}>
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
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            PREMIUM SERVICE FLOW
            ═══════════════════════════════════════════════════════════════════ */}
        {isPremium && (
          <>
            <Section num={sn()} title="Bedrooms & Bathrooms">
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px", boxShadow: C.shadow }}>
                <Counter label="Bedrooms"        sub="Base price covers 3"      value={bedrooms}  setValue={setBedrooms}  min={1} max={10} />
                <Counter label="Full Bathrooms"  sub="Base price covers 2"      value={fullBaths} setValue={setFullBaths} min={1} max={8}  />
                <Counter label="Half Bathrooms"  sub="Each one charged extra"   value={halfBaths} setValue={setHalfBaths} min={0} max={6}  />
              </div>
            </Section>

            <Section num={sn()} title={`Premium Tier · ${premiumFreqKey === "weekly" ? "Weekly" : "Bi-Weekly"}`}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {premiumTiers.map(t => {
                  const on = premiumTier === t.key;
                  const tPrice = calcPremiumPrice(t, bedrooms, fullBaths, halfBaths);
                  return (
                    <button key={t.key} onClick={() => setPremiumTier(t.key)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: on ? "#fdf6e3" : C.white, border: `1.5px solid ${on ? C.gold : C.border}`, borderRadius: 12, cursor: "pointer", transition: "all 0.15s", textAlign: "left", boxShadow: on ? `0 0 0 3px ${C.goldLight}` : C.shadow }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {on && <span style={{ fontSize: 16 }}>✦</span>}
                          <span style={{ fontWeight: 700, fontSize: 16, color: on ? C.goldDeep : C.black }}>{t.label}</span>
                        </div>
                        <div style={{ fontSize: 12, marginTop: 3, color: on ? C.goldDeep : C.grey500 }}>{t.blurb}</div>
                        <div style={{ fontSize: 11, marginTop: 4, color: on ? C.goldDeep : C.grey400, fontFamily: "monospace" }}>
                          Base ${t.base} · +${t.perBed.toFixed(2)}/bed · +${t.perFullBath}/full bath · +${t.perHalfBath}/half bath
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: on ? C.goldDeep : C.grey500, fontFamily: "monospace" }}>{fmt2(tPrice)}</div>
                        <div style={{ fontSize: 11, color: on ? C.goldDeep : C.grey400, marginTop: 2 }}>per visit</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>
          </>
        )}

        {/* ── MILEAGE ── */}
        <Section num={sn()} title="Mileage">
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 20px 16px", boxShadow: C.shadow }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="number" value={km} min={0} max={200} step={1} onChange={e => setKm(Math.max(0, Math.min(200, Number(e.target.value))))} style={{ background: C.blue50, border: `2px solid ${C.blue500}`, borderRadius: 8, color: C.blue900, fontSize: 26, fontFamily: "monospace", fontWeight: 800, padding: "8px 14px", width: 120, outline: "none" }} />
                <span style={{ fontSize: 16, color: C.grey500, fontWeight: 600 }}>km</span>
              </div>
              <div>
                <div style={{ fontSize: 13, color: C.grey500 }}>distance to job</div>
                <div style={{ fontSize: 12, marginTop: 3, fontWeight: 600, color: mileageCharge > 0 ? C.blue700 : C.grey400 }}>
                  {mileageCharge > 0
                    ? `${kmOver} km over · ${brackets} bracket${brackets !== 1 ? "s" : ""} · +${fmt(mileageCharge)}`
                    : `No charge under ${threshold} km`}
                </div>
              </div>
            </div>
            <input type="range" min={0} max={120} step={1} value={Math.min(km, 120)} onChange={e => setKm(Number(e.target.value))} style={{ width: "100%", accentColor: mileageCharge > 0 ? C.blue600 : C.grey400, cursor: "pointer" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.grey400, marginTop: 4, fontFamily: "monospace" }}>
              {["0","20","40","60","80","100","120+"].map(v => <span key={v}>{v}</span>)}
            </div>
            <div style={{ marginTop: 12, padding: "10px 14px", background: C.grey100, borderRadius: 8, fontSize: 12, color: C.grey500 }}>
              {location === "edmonton"
                ? `Edmonton: no charge for first ${MILEAGE.edmonton.threshold} km · $${MILEAGE.edmonton.chargePerBracket} per additional 10 km after that`
                : `Leduc: no charge for first ${MILEAGE.leduc.threshold} km · $${MILEAGE.leduc.chargePerBracket} per additional 10 km after that`}
            </div>
          </div>
        </Section>

        {/* ── QUOTE SUMMARY ── */}
        <div style={{ background: isPremium ? "#1a1410" : C.navyBg, border: `1px solid ${isPremium ? C.goldDeep : C.navyBorder}`, borderRadius: 14, padding: "26px 24px", boxShadow: isPremium ? "0 8px 24px rgba(160,120,22,0.25)" : "0 8px 24px rgba(13,45,94,0.25)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: isPremium ? C.goldLight : C.navySubtle, marginBottom: 18 }}>
            {isPremium ? `✦ Premium ${premiumFreqKey === "weekly" ? "Weekly" : "Bi-Weekly"} Quote` : "Quote Summary"}
          </div>

          {/* ── Regular summary ── */}
          {!isPremium && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <SummaryRow
                label={service.label}
                sub={`${effectiveSqft.toLocaleString()} sq ft · ~${fmtHrs(adjHours)} @ $${rate}/hr${multFactor > 1 ? ` · ${MULTIPLIERS.find(m => m.key === multiplier).label} +${Math.round((multFactor - 1) * 100)}%` : ""}`}
                value={fmt(regBase)}
              />
              {mileageCharge > 0 && (
                <SummaryRow label="Mileage surcharge" sub={`${km} km · ${brackets} bracket${brackets !== 1 ? "s" : ""} of 10 km over ${threshold} km · $${chargePerBracket} each`} value={`+${fmt(mileageCharge)}`} />
              )}
              <div style={{ borderTop: `1px solid ${C.navyDim}`, margin: "4px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 14, color: C.navyMid }}>Total</div>
                  <div style={{ fontSize: 12, color: C.navySubtle, marginTop: 2 }}>~{fmtHrs(adjHours)} · {effectiveSqft.toLocaleString()} sq ft</div>
                </div>
                <div style={{ fontSize: 44, fontWeight: 900, color: C.navyText, fontFamily: "monospace", lineHeight: 1 }}>{fmt(regTotal)}</div>
              </div>
            </div>
          )}

          {/* ── Premium summary ── */}
          {isPremium && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Tier breakdown */}
              <PremiumRow label={`${tier.label} base`} sub="3 bedrooms · 2 full baths · 0 half baths" value={fmt2(tier.base)} />
              {bedrooms > 3 && (
                <PremiumRow label={`+${bedrooms - 3} extra bedroom${bedrooms - 3 !== 1 ? "s" : ""}`} sub={`@ $${tier.perBed.toFixed(2)} each`} value={`+${fmt2((bedrooms - 3) * tier.perBed)}`} />
              )}
              {fullBaths > 2 && (
                <PremiumRow label={`+${fullBaths - 2} extra full bath${fullBaths - 2 !== 1 ? "s" : ""}`} sub={`@ $${tier.perFullBath} each`} value={`+${fmt2((fullBaths - 2) * tier.perFullBath)}`} />
              )}
              {halfBaths > 0 && (
                <PremiumRow label={`${halfBaths} half bath${halfBaths !== 1 ? "s" : ""}`} sub={`@ $${tier.perHalfBath} each`} value={`+${fmt2(halfBaths * tier.perHalfBath)}`} />
              )}
              {mileageCharge > 0 && (
                <PremiumRow label="Mileage surcharge" sub={`${km} km · ${brackets} bracket${brackets !== 1 ? "s" : ""} over ${threshold} km`} value={`+${fmt(mileageCharge)}`} />
              )}

              <div style={{ borderTop: `1px solid ${C.goldDeep}`, margin: "4px 0" }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 14, color: C.goldLight }}>Per visit ({premiumFreqKey === "weekly" ? "weekly" : "bi-weekly"})</div>
                  <div style={{ fontSize: 12, color: C.gold, marginTop: 2 }}>{bedrooms} bed · {fullBaths} full bath{halfBaths > 0 ? ` · ${halfBaths} half bath` : ""}</div>
                </div>
                <div style={{ fontSize: 44, fontWeight: 900, color: C.goldLight, fontFamily: "monospace", lineHeight: 1 }}>{fmt2(premiumTotal)}</div>
              </div>

              {/* Initial deep clean callout */}
              <div style={{ borderTop: `1px solid ${C.goldDeep}`, margin: "8px 0 4px" }} />
              <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 9, padding: "14px 16px", border: `1px solid rgba(212,160,23,0.25)` }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.goldLight, marginBottom: 10 }}>Required Initial Visit</div>
                <PremiumRow
                  label="Initial deep clean (one-time)"
                  sub={`${effectiveSqft.toLocaleString()} sq ft · ${fmtHrs(deepHours)} @ $${deepRate}/hr${mileageCharge > 0 ? ` + mileage` : ""}`}
                  value={fmt(initialPrice)}
                />
                <div style={{ marginTop: 10, fontSize: 12, color: C.goldLight, lineHeight: 1.5 }}>
                  All premium clients begin with a deep clean before recurring visits start. This is a one-time charge at the regular deep clean rate.
                </div>
              </div>
            </div>
          )}

          {/* ── Revenue (recurring only) ── */}
          {monthlyRev && (
            <>
              <div style={{ borderTop: `1px solid ${isPremium ? C.goldDeep : C.navyDim}`, margin: "14px 0 10px" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, color: isPremium ? C.goldLight : C.navyMid }}>Est. monthly revenue</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: isPremium ? C.goldLight : C.navySubtle, fontFamily: "monospace" }}>{fmt(monthlyRev)}/mo</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <div style={{ fontSize: 13, color: isPremium ? C.goldLight : C.navyMid }}>Est. annual revenue</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: isPremium ? C.goldLight : C.navySubtle, fontFamily: "monospace" }}>{fmt(annualRev)}/yr</div>
              </div>
              <div style={{ fontSize: 11, color: isPremium ? C.gold : C.navySubtle, marginTop: 4 }}>
                Based on ~{visitsPerMonth.toFixed(2)} visits/month · 12 months
              </div>
            </>
          )}

          {/* ── Footer strip ── */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${isPremium ? C.goldDeep : C.navyDim}`, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: isPremium ? C.gold : C.navySubtle }}>
            <span>📍 {location === "edmonton" ? "Edmonton" : "Leduc / Area"}</span>
            {isPremium
              ? <span>🏠 {bedrooms} bed · {fullBaths} full · {halfBaths} half</span>
              : <span>📐 {effectiveSqft.toLocaleString()} sq ft{hasBasement ? " (incl. basement)" : ""}</span>
            }
            <span>🚗 {km} km{mileageCharge > 0 ? ` · +${fmt(mileageCharge)}` : " · no surcharge"}</span>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: C.grey400 }}>
          {isPremium
            ? "Premium pricing is fixed per tier · adjust base/extras in code as needed"
            : "Prices calculated as hours × hourly rate · 30 min added for arrival, walkthrough, photos &amp; travel"}
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

function Counter({ label, sub, value, setValue, min, max }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${C.grey100}` }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.black }}>{label}</div>
        <div style={{ fontSize: 11, color: C.grey500, marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setValue(Math.max(min, value - 1))} disabled={value <= min} style={{ width: 32, height: 32, borderRadius: 6, background: value > min ? C.blue50 : C.grey100, border: `1.5px solid ${value > min ? C.blue500 : C.grey200}`, color: value > min ? C.blue700 : C.grey400, fontSize: 18, fontWeight: 800, cursor: value > min ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
        <span style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 800, color: C.blue900, minWidth: 32, textAlign: "center" }}>{value}</span>
        <button onClick={() => setValue(Math.min(max, value + 1))} disabled={value >= max} style={{ width: 32, height: 32, borderRadius: 6, background: value < max ? C.blue50 : C.grey100, border: `1.5px solid ${value < max ? C.blue500 : C.grey200}`, color: value < max ? C.blue700 : C.grey400, fontSize: 18, fontWeight: 800, cursor: value < max ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
      </div>
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

function PremiumRow({ label, sub, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: "#fff" }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: C.goldLight, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, color: "#fff", flexShrink: 0, marginLeft: 16 }}>{value}</div>
    </div>
  );
}
