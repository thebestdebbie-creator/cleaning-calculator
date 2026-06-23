import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// HOUSE TYPES
// Bungalow: basement = 100% of main floor sq ft
// Multi-Storey: basement = ⅓ of main floor sq ft
// ─────────────────────────────────────────────────────────────────────────────
const HOUSE_TYPES = [
  { key: "bungalow",    label: "Bungalow",     sub: "Single-storey · basement adds 100% of main floor"  },
  { key: "multiStorey", label: "Multi-Storey", sub: "Two-storey or split-level · basement adds ⅓"        },
];

const BASEMENT_MULTIPLIER = {
  bungalow:    1.0,
  multiStorey: 1 / 3,
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE TYPES — split out by the work actually being done
// sqftPerHour values calibrated from production rate analysis
// `category` drives bedroom/bathroom time additions
// ─────────────────────────────────────────────────────────────────────────────
const SERVICES = {
  recurring: [
    { key: "weekly",   label: "Recurring — Weekly",    desc: "Ongoing weekly maintenance",          sqftPerHour: 550, rateType: "standard", category: "recurring" },
    { key: "biweekly", label: "Recurring — Bi-Weekly", desc: "Ongoing every-two-weeks maintenance", sqftPerHour: 420, rateType: "standard", category: "recurring" },
    { key: "monthly",  label: "Recurring — Monthly",   desc: "Ongoing monthly maintenance",         sqftPerHour: 410, rateType: "standard", category: "recurring" },
  ],
  project: [
    { key: "oneTime",   label: "One-Time Maintenance", desc: "Single maintenance visit, no recurring schedule",  sqftPerHour: 290, rateType: "premium", category: "recurring" },
    { key: "initial",   label: "Initial Clean",        desc: "First clean before recurring starts",              sqftPerHour: 121, rateType: "premium", category: "deep"      },
    { key: "moveInOut", label: "Move In / Out",        desc: "Pre- or post-occupancy deep clean, empty home",    sqftPerHour: 153, rateType: "premium", category: "moveInOut" },
    { key: "reset",     label: "Reset",                desc: "Mid-cycle refresh between regular visits",         sqftPerHour: 330, rateType: "premium", category: "recurring" },
  ],
};
const ALL_SERVICES = [...SERVICES.recurring, ...SERVICES.project];

// ─────────────────────────────────────────────────────────────────────────────
// RATES — hourly rates by location
// ─────────────────────────────────────────────────────────────────────────────
const RATES = {
  edmonton: { standard: 50, premium: 55 },
  leduc:    { standard: 45, premium: 50 },
};

// ─────────────────────────────────────────────────────────────────────────────
// CONDITION MULTIPLIERS — single-axis on top of base hours
// ─────────────────────────────────────────────────────────────────────────────
const MULTIPLIERS = [
  { key: "standard", label: "Standard", sub: "Typical home",                                            factor: 1.00 },
  { key: "level1",   label: "Level 1",  sub: "Busier home — pet or young child",                        factor: 1.10 },
  { key: "level2",   label: "Level 2",  sub: "High traffic — multiple pets, 4+ people, extra clutter",  factor: 1.20 },
  { key: "codeRed",  label: "Code Red", sub: "Standard maintenance, never been cleaned",                factor: 2.00 },
  { key: "deep",     label: "Deep",     sub: "Extra detail, cabinets",                                  factor: 2.25 },
  { key: "move",     label: "Move",     sub: "Extra detail, cabinets in and out",                       factor: 2.50 },
];

// ─────────────────────────────────────────────────────────────────────────────
// ROOMS — extra time per bedroom/bathroom beyond the baseline,
// varies by service category
// Baseline: 3 bedrooms, 2 full baths (already accounted for in sqft/hr)
// ─────────────────────────────────────────────────────────────────────────────
const ROOM_TIME = {
  baseBeds:      3,
  baseFullBaths: 2,
  byCategory: {
    recurring: { bedMin:  5, fullBathMin: 30, halfBathMin: 10 },
    moveInOut: { bedMin: 15, fullBathMin: 60, halfBathMin: 25 },
    deep:      { bedMin: 30, fullBathMin: 75, halfBathMin: 40 },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ADD-ONS
//   minutes = baseline time at ADDON_BASELINE_SQFT
//   scales  = true → time scales linearly with effective sq ft
// ─────────────────────────────────────────────────────────────────────────────
const ADDON_BASELINE_SQFT = 1500;
const ADD_ONS = [
  { key: "fridge",     label: "Inside fridge",                          minutes:  30, scales: false },
  { key: "oven",       label: "Inside oven",                            minutes:  45, scales: false },
  { key: "cabEmpty",   label: "Inside cabinets (empty)",                minutes:  60, scales: false },
  { key: "baseboards", label: "Baseboards / doors / trim",              minutes:  60, scales: true  },
  { key: "wallSpot",   label: "Wall spot-washing",                      minutes:  45, scales: true  },
  { key: "wallFull",   label: "Full wall washing",                      minutes: 150, scales: true  },
  { key: "windows",    label: "Interior windows (incl. patio doors)",   minutes:  75, scales: true  },
];

function addonMinutes(addon, effectiveSqft) {
  if (!addon.scales) return addon.minutes;
  return Math.round(addon.minutes * (effectiveSqft / ADDON_BASELINE_SQFT));
}

// ─────────────────────────────────────────────────────────────────────────────
// ECONOMICS
// LABOR_COST_PER_HOUR should be fully loaded (wage + CPP + EI + WCB + vacation + holiday)
// ─────────────────────────────────────────────────────────────────────────────
const MIN_CHARGE = 120;
const LABOR_COST_PER_HOUR = 25;

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
const fmtMin = m => {
  if (m < 60) return `${Math.round(m)} min`;
  return fmtHrs(m / 60);
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CleaningCalculator() {
  const [location,       setLocation]       = useState("edmonton");
  const [houseType,      setHouseType]      = useState("multiStorey");
  const [sqft,           setSqft]           = useState(1500);
  const [hasBasement,    setHasBasement]    = useState(false);
  const [beds,           setBeds]           = useState(3);
  const [fullBaths,      setFullBaths]      = useState(2);
  const [halfBaths,      setHalfBaths]      = useState(0);
  const [serviceKey,     setServiceKey]     = useState("biweekly");
  const [multiplier,     setMultiplier]     = useState("standard");
  const [selectedAddOns, setSelectedAddOns] = useState([]);
  const [crewSize,       setCrewSize]       = useState(1);
  const [overhead,       setOverhead]       = useState(2000);  // monthly $ overhead
  const [billableHours,  setBillableHours]  = useState(200);   // team-wide monthly billable hours

  function toggleAddOn(key) {
    setSelectedAddOns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  // ── Calculations ────────────────────────────────────────────────────────
  const basementShare  = BASEMENT_MULTIPLIER[houseType];
  const basementSqft   = Math.round(sqft * basementShare);
  const effectiveSqft  = hasBasement ? sqft + basementSqft : sqft;

  const service        = ALL_SERVICES.find(s => s.key === serviceKey);
  const rate           = RATES[location][service.rateType];
  const multiplierObj  = MULTIPLIERS.find(m => m.key === multiplier);
  const conditionFactor = multiplierObj.factor;

  const baseHours        = effectiveSqft / service.sqftPerHour;
  const conditionedHours = baseHours * conditionFactor;

  const roomTimes      = ROOM_TIME.byCategory[service.category];
  const extraBeds      = Math.max(0, beds      - ROOM_TIME.baseBeds);
  const extraFullBaths = Math.max(0, fullBaths - ROOM_TIME.baseFullBaths);
  const bedBathMinutes = extraBeds      * roomTimes.bedMin
                       + extraFullBaths * roomTimes.fullBathMin
                       + halfBaths      * roomTimes.halfBathMin;

  const addOnMinutes = selectedAddOns.reduce((sum, key) => {
    const a = ADD_ONS.find(a => a.key === key);
    return sum + (a ? addonMinutes(a, effectiveSqft) : 0);
  }, 0);

  const overheadHours  = 0.5; // arrival, walkthrough, photos
  const personHours    = conditionedHours + bedBathMinutes / 60 + addOnMinutes / 60 + overheadHours;
  const wallClockHours = personHours / crewSize;

  const calculatedPrice  = personHours * rate;
  const totalPrice       = Math.max(calculatedPrice, MIN_CHARGE);
  const minChargeApplied = calculatedPrice < MIN_CHARGE;

  const laborCost      = personHours * LABOR_COST_PER_HOUR;
  const overheadPerHr  = billableHours > 0 ? overhead / billableHours : 0;
  const overheadShare  = personHours * overheadPerHr;
  const totalCost      = laborCost + overheadShare;
  const netMargin      = totalPrice - totalCost;
  const netMarginPct   = totalPrice > 0 ? (netMargin / totalPrice) * 100 : 0;

  const visitsPerMonth = MONTHLY_VISITS[serviceKey] || null;
  const monthlyRev     = visitsPerMonth ? totalPrice * visitsPerMonth : null;
  const annualRev      = monthlyRev ? monthlyRev * 12 : null;

  let s = 1;
  const sn = () => String(s++).padStart(2, "0");

  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, fontFamily: "'Helvetica Neue', Arial, sans-serif", color: C.black }}>

      {/* ── HEADER ── */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.grey200}`, padding: "28px 32px 24px", boxShadow: C.shadow }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.blue600, marginBottom: 6 }}>
            Edmonton &amp; Leduc Area
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: C.blue900, letterSpacing: "-0.02em" }}>
            Cleaning Quote Calculator
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: C.grey500 }}>
            Calibrated to actual production rates
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 48px" }}>

        {/* ── 01 LOCATION ── */}
        <Section num={sn()} title="Location">
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { key: "edmonton", label: "Edmonton",     sub: `Standard $${RATES.edmonton.standard}/hr · One-time $${RATES.edmonton.premium}/hr` },
              { key: "leduc",    label: "Leduc / Area", sub: `Standard $${RATES.leduc.standard}/hr · One-time $${RATES.leduc.premium}/hr` },
            ].map(l => (
              <ChoiceCard key={l.key} active={location === l.key} onClick={() => setLocation(l.key)} flex>
                <div style={{ fontWeight: 700, fontSize: 15, color: location === l.key ? C.activeText : C.black }}>{l.label}</div>
                <div style={{ fontSize: 11, color: location === l.key ? C.blue600 : C.grey500, marginTop: 3 }}>{l.sub}</div>
              </ChoiceCard>
            ))}
          </div>
        </Section>

        {/* ── 02 HOUSE TYPE ── */}
        <Section num={sn()} title="House Type">
          <div style={{ display: "flex", gap: 10 }}>
            {HOUSE_TYPES.map(h => (
              <ChoiceCard key={h.key} active={houseType === h.key} onClick={() => setHouseType(h.key)} flex>
                <div style={{ fontWeight: 700, fontSize: 15, color: houseType === h.key ? C.activeText : C.black }}>{h.label}</div>
                <div style={{ fontSize: 11, color: houseType === h.key ? C.blue600 : C.grey500, marginTop: 3 }}>{h.sub}</div>
              </ChoiceCard>
            ))}
          </div>
        </Section>

        {/* ── 03 HOME SIZE ── */}
        <Section num={sn()} title="Home Size">
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
                    + {basementSqft.toLocaleString()} sq ft basement = <span style={{ color: C.blue900 }}>{effectiveSqft.toLocaleString()} sq ft total</span>
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
                      ? `Adds ${basementSqft.toLocaleString()} sq ft (${houseType === "bungalow" ? "100%" : "⅓"} of main floor) → ${effectiveSqft.toLocaleString()} sq ft total`
                      : `Adds ${houseType === "bungalow" ? "100%" : "⅓"} of the main floor square footage (${houseType === "bungalow" ? "bungalow" : "multi-storey"})`}
                  </div>
                </div>
              </button>
            </div>

            <div style={{ marginTop: 16, borderTop: `1px solid ${C.grey200}`, paddingTop: 4 }}>
              <Counter label="Bedrooms"       sub={`+${roomTimes.bedMin} min each beyond ${ROOM_TIME.baseBeds}`}                          value={beds}      setValue={setBeds}      min={0} max={10} />
              <Counter label="Full Bathrooms" sub={`+${roomTimes.fullBathMin} min each beyond ${ROOM_TIME.baseFullBaths}`}                value={fullBaths} setValue={setFullBaths} min={0} max={8} />
              <Counter label="Half Bathrooms" sub={`+${roomTimes.halfBathMin} min each`}                                                  value={halfBaths} setValue={setHalfBaths} min={0} max={6} />
              <div style={{ fontSize: 11, color: C.grey500, fontStyle: "italic", marginTop: 8, paddingTop: 6 }}>
                Bed/bath times scale with the selected service type — recurring is fastest, deep cleans add the most.
              </div>
            </div>
          </div>
        </Section>

        {/* ── 04 SERVICE TYPE ── */}
        <Section num={sn()} title="Service Type">
          <div style={{ fontSize: 11, fontWeight: 700, color: C.grey500, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px 4px" }}>Recurring</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {SERVICES.recurring.map(sv => <ServiceCard key={sv.key} sv={sv} active={serviceKey === sv.key} onClick={() => setServiceKey(sv.key)} effectiveSqft={effectiveSqft} conditionFactor={conditionFactor} location={location} />)}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.grey500, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px 4px" }}>Project / One-Time</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SERVICES.project.map(sv => <ServiceCard key={sv.key} sv={sv} active={serviceKey === sv.key} onClick={() => setServiceKey(sv.key)} effectiveSqft={effectiveSqft} conditionFactor={conditionFactor} location={location} />)}
          </div>
        </Section>

        {/* ── 05 HOME CONDITION ── */}
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

        {/* ── 06 ADD-ONS ── */}
        <Section num={sn()} title={`Add-Ons${selectedAddOns.length ? ` · ${selectedAddOns.length} selected` : ""}`}>
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 12px", boxShadow: C.shadow }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ADD_ONS.map(a => {
                const on   = selectedAddOns.includes(a.key);
                const mins = addonMinutes(a, effectiveSqft);
                const cost = (mins / 60) * rate;
                return (
                  <button key={a.key} onClick={() => toggleAddOn(a.key)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: on ? C.activeBg : C.white, border: `1.5px solid ${on ? C.activeBorder : C.border}`, borderRadius: 8, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <CB checked={on} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: on ? C.activeText : C.black, fontStyle: a.scales ? "italic" : "normal" }}>{a.label}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, marginLeft: 8, lineHeight: 1.2 }}>
                      <span style={{ fontSize: 12, fontFamily: "monospace", color: on ? C.blue700 : C.grey400, fontWeight: 700, fontStyle: a.scales ? "italic" : "normal" }}>+{mins}m</span>
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: on ? C.blue600 : C.grey400, fontWeight: 600, fontStyle: a.scales ? "italic" : "normal" }}>{fmt(cost)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 10, padding: "8px 12px", fontSize: 11, color: C.grey500, fontStyle: "italic", lineHeight: 1.5 }}>
              Items in italic scale with home size (baseboards/doors/trim, walls, windows — baseline times set at {ADDON_BASELINE_SQFT.toLocaleString()} sq ft). Costs reflect the current location and service rate.
            </div>
            {addOnMinutes > 0 && (
              <div style={{ marginTop: 4, padding: "10px 14px", background: C.blue50, borderRadius: 8, fontSize: 12, color: C.blue700, display: "flex", justifyContent: "space-between" }}>
                <span>Add-on totals</span>
                <span style={{ fontFamily: "monospace", fontWeight: 700 }}>+{fmtMin(addOnMinutes)} · {fmt((addOnMinutes / 60) * rate)}</span>
              </div>
            )}
          </div>
        </Section>

        {/* ── 07 CREW SIZE ── */}
        <Section num={sn()} title="Crew Size">
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", boxShadow: C.shadow }}>
            <div style={{ fontSize: 12, color: C.grey500, marginBottom: 10 }}>How many cleaners on this job? (affects wall-clock time only — labor cost is the same)</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4].map(n => {
                const on = crewSize === n;
                return (
                  <button key={n} onClick={() => setCrewSize(n)} style={{ flex: 1, padding: "12px 0", background: on ? C.activeBg : C.white, border: `1.5px solid ${on ? C.activeBorder : C.border}`, borderRadius: 10, cursor: "pointer", textAlign: "center", transition: "all 0.15s", boxShadow: on ? `0 0 0 3px ${C.blue100}` : C.shadow }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: on ? C.blue700 : C.grey500, fontFamily: "monospace" }}>{n}</div>
                    <div style={{ fontSize: 10, color: on ? C.blue600 : C.grey400, marginTop: 2 }}>{n === 1 ? "solo" : "cleaners"}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        {/* ── 08 BUSINESS OVERHEAD ── */}
        <Section num={sn()} title="Business Overhead">
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 20px 16px", boxShadow: C.shadow }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 22, color: C.blue900, fontWeight: 800 }}>$</span>
                <input
                  type="number" value={overhead} min={0} max={20000} step={50}
                  onChange={e => setOverhead(Math.max(0, Math.min(20000, Number(e.target.value))))}
                  style={{ background: C.blue50, border: `2px solid ${C.blue500}`, borderRadius: 8, color: C.blue900, fontSize: 22, fontFamily: "monospace", fontWeight: 800, padding: "8px 14px", width: 130, outline: "none" }}
                />
              </div>
              <div>
                <div style={{ fontSize: 13, color: C.grey500 }}>per month · insurance, vehicle, software, marketing, supplies</div>
                <div style={{ fontSize: 12, color: C.blue600, marginTop: 3, fontWeight: 600 }}>
                  {overhead > 0 && billableHours > 0
                    ? `≈ $${overheadPerHr.toFixed(2)}/billable hr · this job absorbs ${fmt(overheadShare)}`
                    : "Set monthly overhead to factor it into margin"}
                </div>
              </div>
            </div>
            <input type="range" min={0} max={10000} step={50} value={Math.min(overhead, 10000)} onChange={e => setOverhead(Number(e.target.value))} style={{ width: "100%", accentColor: C.blue600, cursor: "pointer" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.grey400, marginTop: 4, fontFamily: "monospace" }}>
              {["$0","$2K","$4K","$6K","$8K","$10K+"].map(v => <span key={v}>{v}</span>)}
            </div>

            <div style={{ marginTop: 16, borderTop: `1px solid ${C.grey200}`, paddingTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.grey700 }}>Monthly Billable Hours</div>
                <div style={{ fontSize: 12, color: C.grey500, marginTop: 2 }}>Team-wide billable hours/month — used to allocate overhead per job</div>
              </div>
              <input
                type="number" value={billableHours} min={1} max={2000} step={10}
                onChange={e => setBillableHours(Math.max(1, Number(e.target.value)))}
                style={{ background: C.blue50, border: `1.5px solid ${C.blue500}`, borderRadius: 6, color: C.blue900, fontSize: 16, fontFamily: "monospace", fontWeight: 700, padding: "6px 10px", width: 80, outline: "none", textAlign: "center" }}
              />
            </div>
          </div>
        </Section>

        {/* ── QUOTE SUMMARY ── */}
        <div style={{ background: C.navyBg, border: `1px solid ${C.navyBorder}`, borderRadius: 14, padding: "26px 24px", boxShadow: "0 8px 24px rgba(13,45,94,0.25)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.navySubtle, marginBottom: 18 }}>
            Quote Summary
          </div>

          {/* Service & home line */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.navyText }}>{service.label}</div>
            <div style={{ fontSize: 12, color: C.navySubtle, marginTop: 3 }}>
              {houseType === "bungalow" ? "Bungalow" : "Multi-storey"} · {effectiveSqft.toLocaleString()} sq ft · {beds} bed · {fullBaths + halfBaths * 0.5} bath
              {hasBasement && " · basement"}
              {selectedAddOns.length > 0 && ` · ${selectedAddOns.length} add-on${selectedAddOns.length !== 1 ? "s" : ""}`}
            </div>
          </div>

          {/* Breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, marginBottom: 14 }}>
            <BreakdownRow label="Base time (sqft ÷ rate)" value={fmtHrs(baseHours)} />
            {conditionFactor !== 1 && (
              <BreakdownRow label={`${multiplierObj.label} ×${conditionFactor.toFixed(2)}`} value={`+${fmtMin((conditionedHours - baseHours) * 60)}`} />
            )}
            {bedBathMinutes > 0 && (
              <BreakdownRow label={`Bed/bath (${beds} bed · ${fullBaths} full · ${halfBaths} half)`} value={`+${fmtMin(bedBathMinutes)}`} />
            )}
            {addOnMinutes > 0 && (
              <BreakdownRow label={`Add-ons (${selectedAddOns.length})`} value={`+${fmtMin(addOnMinutes)}`} />
            )}
            <BreakdownRow label="Arrival, walkthrough, photos" value={`+${fmtMin(overheadHours * 60)}`} />
            <div style={{ borderTop: `1px solid ${C.navyDim}`, margin: "4px 0" }} />
            <BreakdownRow label="Total person-hours" value={fmtHrs(personHours)} bold />
            {crewSize > 1 && (
              <BreakdownRow label={`Wall-clock with ${crewSize} cleaners`} value={fmtHrs(wallClockHours)} subtle />
            )}
          </div>

          {/* Min-charge note */}
          {minChargeApplied && (
            <div style={{ marginBottom: 10, padding: "10px 14px", background: "rgba(217,119,6,0.15)", border: `1px solid rgba(217,119,6,0.3)`, borderRadius: 8, fontSize: 12, color: "#fde68a" }}>
              ⚠ Calculated price ({fmt(calculatedPrice)}) is below the ${MIN_CHARGE} minimum — minimum applied.
            </div>
          )}

          {/* Total */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 14, color: C.navyMid }}>Total quote</div>
              <div style={{ fontSize: 12, color: C.navySubtle, marginTop: 2 }}>
                {fmtHrs(personHours)} @ ${rate}/hr
                {crewSize > 1 && ` · ~${fmtHrs(wallClockHours)} on-site`}
              </div>
            </div>
            <div style={{ fontSize: 44, fontWeight: 900, color: C.navyText, fontFamily: "monospace", lineHeight: 1 }}>{fmt(totalPrice)}</div>
          </div>

          {/* Margin block */}
          <div style={{ marginTop: 18, padding: "14px 16px", background: netMargin > 0 ? "rgba(22,163,74,0.12)" : "rgba(217,119,6,0.15)", border: `1px solid ${netMargin > 0 ? "rgba(22,163,74,0.3)" : "rgba(217,119,6,0.3)"}`, borderRadius: 9 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: netMargin > 0 ? "#86efac" : "#fde68a", marginBottom: 8 }}>Per-Visit Profitability</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <BreakdownRow label={`Labor (${fmtHrs(personHours)} @ $${LABOR_COST_PER_HOUR}/hr)`} value={fmt(laborCost)} />
              {overheadShare > 0 && (
                <BreakdownRow label={`Overhead share (${fmtHrs(personHours)} @ $${overheadPerHr.toFixed(2)}/hr)`} value={fmt(overheadShare)} />
              )}
              <BreakdownRow label="Total cost" value={fmt(totalCost)} />
              <BreakdownRow label="Quote total" value={fmt(totalPrice)} />
              <div style={{ borderTop: `1px solid rgba(255,255,255,0.15)`, margin: "4px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, color: C.navyText, fontWeight: 700 }}>Net margin</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: netMargin > 0 ? "#86efac" : "#fbbf24", fontFamily: "monospace" }}>
                  {fmt(netMargin)} <span style={{ fontSize: 13, fontWeight: 600 }}>({Math.round(netMarginPct)}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Revenue (recurring only) */}
          {monthlyRev && (
            <>
              <div style={{ borderTop: `1px solid ${C.navyDim}`, margin: "16px 0 10px" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, color: C.navyMid }}>Est. monthly revenue</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.navySubtle, fontFamily: "monospace" }}>{fmt(monthlyRev)}/mo</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <div style={{ fontSize: 13, color: C.navyMid }}>Est. annual revenue</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.navySubtle, fontFamily: "monospace" }}>{fmt(annualRev)}/yr</div>
              </div>
              <div style={{ fontSize: 11, color: C.navySubtle, marginTop: 4 }}>
                Based on ~{visitsPerMonth.toFixed(2)} visits/month · 12 months
              </div>
            </>
          )}

          {/* Footer strip */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.navyDim}`, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: C.navySubtle }}>
            <span>📍 {location === "edmonton" ? "Edmonton" : "Leduc / Area"}</span>
            <span>🏠 {houseType === "bungalow" ? "Bungalow" : "Multi-storey"}</span>
            <span>📐 {effectiveSqft.toLocaleString()} sq ft{hasBasement ? " (incl. basement)" : ""}</span>
            <span>👥 {crewSize} cleaner{crewSize !== 1 ? "s" : ""}</span>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: C.grey400 }}>
          Production rates calibrated from job log · adjust constants at top of file to tune
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function ServiceCard({ sv, active, onClick, effectiveSqft, conditionFactor, location }) {
  const svRate    = RATES[location][sv.rateType];
  const svBaseHrs = effectiveSqft / sv.sqftPerHour;
  const svHours   = svBaseHrs * conditionFactor + 0.5;
  const svPrice   = svHours * svRate;
  return (
    <button onClick={onClick} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: active ? C.activeBg : C.white, border: `1.5px solid ${active ? C.activeBorder : C.border}`, borderRadius: 10, cursor: "pointer", transition: "all 0.15s", textAlign: "left", boxShadow: active ? `0 0 0 3px ${C.blue100}` : C.shadow }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: active ? C.activeText : C.black }}>{sv.label}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: active ? C.blue100 : C.grey100, color: active ? C.blue700 : C.grey500 }}>
            ${svRate}/hr · {sv.sqftPerHour} sq ft/hr
          </span>
        </div>
        <div style={{ fontSize: 12, marginTop: 3, color: active ? C.blue600 : C.grey500 }}>{sv.desc}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: active ? C.blue700 : C.grey500, fontFamily: "monospace" }}>{fmt(svPrice)}</div>
        <div style={{ fontSize: 11, color: active ? C.blue500 : C.grey400, marginTop: 2 }}>~{fmtHrs(svHours)}</div>
      </div>
    </button>
  );
}

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
    <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: `2px solid ${checked ? C.blue600 : C.grey400}`, background: checked ? C.blue600 : C.white, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {checked && <span style={{ color: "white", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
    </div>
  );
}

function Counter({ label, sub, value, setValue, min, max }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.grey100}` }}>
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

function BreakdownRow({ label, value, bold, subtle }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontSize: 12, color: subtle ? C.navySubtle : C.navyMid, fontWeight: bold ? 700 : 400 }}>{label}</div>
      <div style={{ fontFamily: "monospace", fontSize: bold ? 14 : 12, color: C.navyText, fontWeight: bold ? 800 : 600 }}>{value}</div>
    </div>
  );
}
