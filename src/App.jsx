import { useState } from "react";

// ═════════════════════════════════════════════════════════════════════════════
// CLEAN MY HOME — QUOTE CALCULATOR
// Prices up from true cost + target margin, so every quote clears a healthy
// margin by design. Production rates and costs are calibrated from the job log
// (Mar–Jun 2026) and the master dashboard.
// ═════════════════════════════════════════════════════════════════════════════

// ── TIME MODEL ───────────────────────────────────────────────────────────────
// Person-hours for a standard bi-weekly clean, fit from your job log:
//     hours = BASE + PER_SQFT × sq ft
// This builds in economies of scale — bigger homes clean faster per sq ft, so a
// 1,200 sq ft home runs ~320 sq ft/hr while a 3,500 runs ~650 sq ft/hr.
const MAINT_BASE_HRS = 2.84;
const MAINT_PER_SQFT = 0.00073;
const maintenanceHours = sqft => MAINT_BASE_HRS + MAINT_PER_SQFT * sqft;

// Recurring services are a multiple of that baseline (frequency multipliers keep
// the sensible order: monthly per visit > bi-weekly > weekly). Deep/initial/spring
// and move-in/out are built differently — see the DEEP / MOVE MODEL below.
// histRevHr = what you've historically averaged per person-hour (reference only).
const SERVICES = {
  recurring: [
    { key: "weekly",   label: "Recurring — Weekly",    desc: "Ongoing weekly maintenance",          model: "recurring", timeMult: 0.90, histRevHr: 45.00, category: "recurring", marketRate: "standard" },
    { key: "biweekly", label: "Recurring — Bi-Weekly", desc: "Ongoing every-two-weeks maintenance", model: "recurring", timeMult: 1.00, histRevHr: 45.00, category: "recurring", marketRate: "standard" },
    { key: "monthly",  label: "Recurring — Monthly",   desc: "Ongoing monthly maintenance",         model: "recurring", timeMult: 1.12, histRevHr: 49.75, category: "recurring", marketRate: "standard" },
  ],
  project: [
    { key: "oneTime",   label: "One-Time / Standard", desc: "Single maintenance visit, no schedule",      model: "recurring", timeMult: 1.25, histRevHr: 50.81, category: "recurring", marketRate: "premium" },
    { key: "initial",   label: "Initial Clean",       desc: "First clean before recurring (= deep)",      model: "deep", histRevHr: 41.98, category: "deep",      marketRate: "premium" },
    { key: "deepSpring", label: "Deep / Spring",      desc: "Top-to-bottom detail clean",                 model: "deep", histRevHr: 30.29, category: "deep",      marketRate: "premium" },
    { key: "moveInOut", label: "Move In / Out",       desc: "Pre/post-occupancy clean, empty home",       model: "move", histRevHr: 44.38, category: "moveInOut", marketRate: "premium" },
  ],
};
const ALL_SERVICES = [...SERVICES.recurring, ...SERVICES.project];

// ── DEEP / MOVE MODEL ────────────────────────────────────────────────────────
// Deep / initial / spring  = 1.75 × the monthly clean + EXTERIOR cabinets.
// Move in / out            = 1.50 × the monthly clean + INTERIOR & EXTERIOR cabinets
//                            (less than deep because the home is empty).
// Cabinet time, and the detail add-ons, scale with home size between SMALL and LARGE.
const MONTHLY_MULT     = 1.12;       // keep in sync with the Monthly service above
const DEEP_BASE_MULT   = 1.75;
const MOVE_BASE_MULT   = 1.50;
const SMALL_HOME       = 1000;       // sq ft anchor for the "smallest home" end of every range
const LARGE_HOME       = 4000;       // sq ft anchor for the "largest home" end
const DEEP_CABINET_MIN = [30, 90];   // exterior cabinets: 30 min (small) → 1.5 hr (large)
const MOVE_CABINET_MIN = [45, 120];  // interior + exterior cabinets: 45 min → 2 hr
// Linear interpolation of a minutes range across home size, clamped at both ends.
const lerpBySize = (lo, hi, sqft) => {
  const t = Math.max(0, Math.min(1, (sqft - SMALL_HOME) / (LARGE_HOME - SMALL_HOME)));
  return lo + (hi - lo) * t;
};
// Core base hours before condition, bed/bath and add-ons (cabinets handled separately).
function serviceCoreHours(service, sqft) {
  const monthlyH = maintenanceHours(sqft) * MONTHLY_MULT;
  if (service.model === "deep") return DEEP_BASE_MULT * monthlyH;
  if (service.model === "move") return MOVE_BASE_MULT * monthlyH;
  return maintenanceHours(sqft) * service.timeMult;
}
const cabinetMinutesFor = (service, sqft) =>
  service.model === "deep" ? lerpBySize(DEEP_CABINET_MIN[0], DEEP_CABINET_MIN[1], sqft)
  : service.model === "move" ? lerpBySize(MOVE_CABINET_MIN[0], MOVE_CABINET_MIN[1], sqft)
  : 0;

// ── MARKET REFERENCE RATES (sanity-check only; price is margin-driven) ────────
const MARKET_RATES = {
  edmonton: { standard: 50, premium: 55 },
  leduc:    { standard: 45, premium: 50 },
};

// ── HOME CONDITION ───────────────────────────────────────────────────────────
// How dirty/busy the home is, applied on top of the service rate.
// (Depth of clean already lives in the service rate, so these stay modest —
//  no separate "deep"/"move" here, those are service types.)
const CONDITIONS = [
  { key: "standard", label: "Standard", sub: "Typical home",                                       factor: 1.00 },
  { key: "level1",   label: "Level 1",  sub: "Busier home — pet or young child",                   factor: 1.10 },
  { key: "level2",   label: "Level 2",  sub: "High traffic — multiple pets, 4+ people, clutter",   factor: 1.25 },
  { key: "codeRed",  label: "Code Red", sub: "Neglected — never been deep cleaned",                factor: 1.60 },
];

// ── ROOM TIME (extra minutes beyond the baseline 3 bed / 2 full bath) ─────────
const ROOM_TIME = {
  baseBeds: 3, baseFullBaths: 2,
  byCategory: {
    recurring: { bedMin:  5, fullBathMin: 30, halfBathMin: 10 },
    moveInOut: { bedMin: 15, fullBathMin: 60, halfBathMin: 25 },
    deep:      { bedMin: 30, fullBathMin: 75, halfBathMin: 40 },
  },
};

// ── ADD-ONS (à la carte; not in any base package) ────────────────────────────
// range = [minutes at SMALL_HOME, minutes at LARGE_HOME]; fixed = flat minutes.
// Fridge is occupancy-based: empty move-out homes are quicker than occupied homes.
const ADD_ONS = [
  { key: "fridge",       label: "Inside fridge",             kind: "fridge"   },
  { key: "oven",         label: "Inside oven",               fixed: 60        },
  { key: "baseboards",   label: "Baseboards / doors / trim", range: [30, 120] },
  { key: "wallSpot",     label: "Spot wall-washing",         range: [30, 120] },
  { key: "wallFull",     label: "Full wall washing",         range: [90, 240] },
  { key: "windows",      label: "Interior windows",          range: [30, 180] },
  { key: "cupboardTops", label: "Top of cupboards & fridge", range: [15, 45]  },
];
function addonMinutes(a, sqft, model) {
  if (a.kind === "fridge") return model === "move" ? 45 : 60;
  if (a.fixed != null) return a.fixed;
  return Math.round(lerpBySize(a.range[0], a.range[1], sqft));
}
const addonScales = a => a.range != null; // italic in the UI when it varies by size

// ── FIXED ECONOMICS ──────────────────────────────────────────────────────────
const MIN_CHARGE = 120;
const TRAVEL_RATE = 15; // $/hr charged for travel time
const MONTHLY_VISITS = { weekly: 4.33, biweekly: 2.17, monthly: 1 };

// ── COLOURS ──────────────────────────────────────────────────────────────────
const C = {
  pageBg: "#f0f4f8", white: "#ffffff",
  blue900: "#0d2d5e", blue700: "#1a56a0", blue600: "#2563eb", blue500: "#3b82f6",
  blue200: "#bfdbfe", blue100: "#dbeafe", blue50: "#eff6ff",
  black: "#0f172a", grey700: "#334155", grey500: "#64748b", grey400: "#94a3b8",
  grey300: "#cbd5e1", grey200: "#e2e8f0", grey100: "#f1f5f9",
  activeBg: "#eff6ff", activeBorder: "#2563eb", activeText: "#1a56a0",
  border: "#e2e8f0", shadow: "0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  navyBg: "#0d2d5e", navyBorder: "#1a4a8a", navyText: "#ffffff",
  navyMid: "#93c5fd", navySubtle: "#60a5fa", navyDim: "#1e4a7a",
  good: "#16a34a", goodSoft: "#86efac", warn: "#d97706", warnSoft: "#fbbf24", bad: "#dc2626", badSoft: "#fca5a5",
};

// ── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = v => `$${Math.round(v).toLocaleString()}`;
const fmt2 = v => `$${v.toFixed(2)}`;
const fmtHrs = h => {
  const hrs = Math.floor(h), mins = Math.round((h - hrs) * 60);
  if (mins === 0) return `${hrs} hr${hrs !== 1 ? "s" : ""}`;
  if (hrs === 0)  return `${mins} min`;
  return `${hrs} hr${hrs !== 1 ? "s" : ""} ${mins} min`;
};
const fmtMin = m => (m < 60 ? `${Math.round(m)} min` : fmtHrs(m / 60));

// ═════════════════════════════════════════════════════════════════════════════
export default function CleaningCalculator() {
  const [location,       setLocation]       = useState("leduc");
  const [sqft,           setSqft]           = useState(1500);
  const [beds,           setBeds]           = useState(3);
  const [fullBaths,      setFullBaths]      = useState(2);
  const [halfBaths,      setHalfBaths]      = useState(0);
  const [serviceKey,     setServiceKey]     = useState("biweekly");
  const [condition,      setCondition]      = useState("standard");
  const [selectedAddOns, setSelectedAddOns] = useState([]);
  const [crewSize,       setCrewSize]       = useState(1);
  const [travelMinutes,  setTravelMinutes]  = useState(0);

  // Cost & margin engine
  const [wage,          setWage]          = useState(25);
  const [loadingPct,    setLoadingPct]    = useState(0.1223); // vacation 4% + CPP 5.95% + EI 2.28% + WCB 0%
  const [overhead,      setOverhead]      = useState(2000);   // monthly $
  const [billableHours, setBillableHours] = useState(266);    // team person-hours billed / month (from Cost Settings)
  const [pricingMode,   setPricingMode]   = useState("margin"); // "margin" | "rate"
  const [targetMargin,  setTargetMargin]  = useState(0.20);
  const [manualRate,    setManualRate]    = useState(50);     // $/person-hr in rate mode

  const toggleAddOn = key =>
    setSelectedAddOns(p => (p.includes(key) ? p.filter(k => k !== key) : [...p, key]));

  // ── HOURS ──────────────────────────────────────────────────────────────────
  const effectiveSqft = sqft;

  const service       = ALL_SERVICES.find(s => s.key === serviceKey);
  const conditionObj  = CONDITIONS.find(m => m.key === condition);
  const conditionFactor = conditionObj.factor;

  const coreHours        = serviceCoreHours(service, effectiveSqft);
  const cabinetMinutes   = cabinetMinutesFor(service, effectiveSqft);
  const baseHours        = coreHours + cabinetMinutes / 60;
  const conditionedHours = baseHours * conditionFactor;

  const roomTimes      = ROOM_TIME.byCategory[service.category];
  const extraBeds      = Math.max(0, beds - ROOM_TIME.baseBeds);
  const extraFullBaths = Math.max(0, fullBaths - ROOM_TIME.baseFullBaths);
  const bedBathMinutes = extraBeds * roomTimes.bedMin + extraFullBaths * roomTimes.fullBathMin + halfBaths * roomTimes.halfBathMin;

  const addOnMinutes = selectedAddOns.reduce((s, key) => {
    const a = ADD_ONS.find(a => a.key === key);
    return s + (a ? addonMinutes(a, effectiveSqft, service.model) : 0);
  }, 0);

  const personHours    = conditionedHours + bedBathMinutes / 60 + addOnMinutes / 60;
  const wallClockHours = personHours / crewSize;
  const travelHours    = travelMinutes / 60;
  const travelCharge   = travelHours * TRAVEL_RATE;

  // ── COST ─────────────────────────────────────────────────────────────────
  const loadedCostPerHour = wage * (1 + loadingPct);
  const overheadPerHour   = billableHours > 0 ? overhead / billableHours : 0;
  const costPerHour       = loadedCostPerHour + overheadPerHour;
  const cleanCost         = personHours * costPerHour;
  const travelCost        = travelHours * TRAVEL_RATE * (1 + loadingPct);
  const totalCost         = cleanCost + travelCost;

  // ── PRICE (margin-first, or manual rate) ───────────────────────────────────
  const rateForMargin = m => costPerHour / (1 - m);
  const pricePerHour   = pricingMode === "margin" ? rateForMargin(targetMargin) : manualRate;
  const cleanPrice        = personHours * pricePerHour;
  const cleanPriceFloored = Math.max(cleanPrice, MIN_CHARGE);
  const minChargeApplied  = cleanPrice < MIN_CHARGE;
  const totalPrice        = cleanPriceFloored + travelCharge;

  const netMargin    = totalPrice - totalCost;
  const netMarginPct = totalPrice > 0 ? netMargin / totalPrice : 0;
  const effectiveRate = personHours > 0 ? cleanPriceFloored / personHours : 0;

  const marketRate = MARKET_RATES[location][service.marketRate];

  const visitsPerMonth = MONTHLY_VISITS[serviceKey] || null;
  const monthlyRev  = visitsPerMonth ? totalPrice * visitsPerMonth : null;
  const monthlyProfit = visitsPerMonth ? netMargin * visitsPerMonth : null;
  const annualRev   = monthlyRev ? monthlyRev * 12 : null;

  // margin health
  const marginColor = netMarginPct >= 0.15 ? C.good : netMarginPct >= 0 ? C.warn : C.bad;
  const marginSoft  = netMarginPct >= 0.15 ? C.goodSoft : netMarginPct >= 0 ? C.warnSoft : C.badSoft;
  const marginLabel = netMarginPct >= 0.20 ? "Healthy" : netMarginPct >= 0.15 ? "Solid" : netMarginPct >= 0 ? "Thin — push the price" : "Losing money";

  let s = 1; const sn = () => String(s++).padStart(2, "0");

  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, fontFamily: "'Helvetica Neue', Arial, sans-serif", color: C.black }}>
      {/* HEADER */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.grey200}`, padding: "28px 32px 24px", boxShadow: C.shadow }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.blue600, marginBottom: 6 }}>
            Clean My Home · Edmonton &amp; Leduc Area
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: C.blue900, letterSpacing: "-0.02em" }}>Quote Calculator</h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: C.grey500 }}>
            Priced up from your true cost and target margin — calibrated to your job log.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 48px" }}>

        {/* 01 LOCATION */}
        <Section num={sn()} title="Location">
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { key: "edmonton", label: "Edmonton",     sub: `Market rate ~$${MARKET_RATES.edmonton.standard}–${MARKET_RATES.edmonton.premium}/hr` },
              { key: "leduc",    label: "Leduc / Area", sub: `Market rate ~$${MARKET_RATES.leduc.standard}–${MARKET_RATES.leduc.premium}/hr` },
            ].map(l => (
              <ChoiceCard key={l.key} active={location === l.key} onClick={() => setLocation(l.key)} flex>
                <div style={{ fontWeight: 700, fontSize: 15, color: location === l.key ? C.activeText : C.black }}>{l.label}</div>
                <div style={{ fontSize: 11, color: location === l.key ? C.blue600 : C.grey500, marginTop: 3 }}>{l.sub}</div>
              </ChoiceCard>
            ))}
          </div>
        </Section>

        {/* 02 HOME SIZE */}
        <Section num={sn()} title="Home Size">
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 20px 16px", boxShadow: C.shadow }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <input type="number" value={sqft} min={400} max={8000} step={50}
                onChange={e => setSqft(Math.max(400, Math.min(8000, Number(e.target.value))))}
                style={{ background: C.blue50, border: `2px solid ${C.blue500}`, borderRadius: 8, color: C.blue900, fontSize: 26, fontFamily: "monospace", fontWeight: 800, padding: "8px 14px", width: 140, outline: "none" }} />
              <div>
                <div style={{ fontSize: 13, color: C.grey500 }}>sq ft · finished area (what the client tells you)</div>
              </div>
            </div>
            <input type="range" min={400} max={5000} step={50} value={Math.min(sqft, 5000)} onChange={e => setSqft(Number(e.target.value))} style={{ width: "100%", accentColor: C.blue600, cursor: "pointer" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.grey400, marginTop: 4, fontFamily: "monospace" }}>
              {["400","1,000","1,500","2,000","2,500","3,500","5,000+"].map(v => <span key={v}>{v}</span>)}
            </div>
            <div style={{ marginTop: 16, borderTop: `1px solid ${C.grey200}`, paddingTop: 4 }}>
              <Counter label="Bedrooms"       sub={`+${roomTimes.bedMin} min each beyond ${ROOM_TIME.baseBeds}`}        value={beds}      setValue={setBeds}      min={0} max={10} />
              <Counter label="Full Bathrooms" sub={`+${roomTimes.fullBathMin} min each beyond ${ROOM_TIME.baseFullBaths}`} value={fullBaths} setValue={setFullBaths} min={0} max={8} />
              <Counter label="Half Bathrooms" sub={`+${roomTimes.halfBathMin} min each`}                                value={halfBaths} setValue={setHalfBaths} min={0} max={6} />
              <div style={{ fontSize: 11, color: C.grey500, fontStyle: "italic", marginTop: 8, paddingTop: 6 }}>
                Bed/bath times scale with service type — recurring is quickest, deep and move-out add the most.
              </div>
            </div>
          </div>
        </Section>

        {/* 04 SERVICE TYPE */}
        <Section num={sn()} title="Service Type">
          <div style={{ fontSize: 11, fontWeight: 700, color: C.grey500, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px 4px" }}>Recurring</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {SERVICES.recurring.map(sv => <ServiceCard key={sv.key} sv={sv} active={serviceKey === sv.key} onClick={() => setServiceKey(sv.key)} effectiveSqft={effectiveSqft} conditionFactor={conditionFactor} pricePerHour={pricePerHour} />)}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.grey500, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px 4px" }}>Project / One-Time</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SERVICES.project.map(sv => <ServiceCard key={sv.key} sv={sv} active={serviceKey === sv.key} onClick={() => setServiceKey(sv.key)} effectiveSqft={effectiveSqft} conditionFactor={conditionFactor} pricePerHour={pricePerHour} />)}
          </div>
        </Section>

        {/* 05 HOME CONDITION */}
        <Section num={sn()} title="Home Condition">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CONDITIONS.map(m => {
              const on = condition === m.key;
              return (
                <button key={m.key} onClick={() => setCondition(m.key)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", background: on ? C.activeBg : C.white, border: `1.5px solid ${on ? C.activeBorder : C.border}`, borderRadius: 10, cursor: "pointer", textAlign: "left", boxShadow: on ? `0 0 0 3px ${C.blue100}` : C.shadow }}>
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

        {/* 06 ADD-ONS */}
        <Section num={sn()} title={`Add-Ons${selectedAddOns.length ? ` · ${selectedAddOns.length} selected` : ""}`}>
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px", boxShadow: C.shadow }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ADD_ONS.map(a => {
                const on = selectedAddOns.includes(a.key);
                const mins = addonMinutes(a, effectiveSqft, service.model);
                const cost = (mins / 60) * pricePerHour;
                const scales = addonScales(a);
                return (
                  <button key={a.key} onClick={() => toggleAddOn(a.key)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: on ? C.activeBg : C.white, border: `1.5px solid ${on ? C.activeBorder : C.border}`, borderRadius: 8, cursor: "pointer", textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <CB checked={on} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: on ? C.activeText : C.black, fontStyle: scales ? "italic" : "normal" }}>{a.label}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, marginLeft: 8, lineHeight: 1.2 }}>
                      <span style={{ fontSize: 12, fontFamily: "monospace", color: on ? C.blue700 : C.grey400, fontWeight: 700, fontStyle: scales ? "italic" : "normal" }}>+{mins}m</span>
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: on ? C.blue600 : C.grey400, fontWeight: 600 }}>{fmt(cost)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 10, padding: "8px 12px", fontSize: 11, color: C.grey500, fontStyle: "italic", lineHeight: 1.5 }}>
              Italic items scale with home size (more for larger homes). Fridge is quicker on empty move-out homes. None are included in any base package.
            </div>
            {addOnMinutes > 0 && (
              <div style={{ marginTop: 4, padding: "10px 14px", background: C.blue50, borderRadius: 8, fontSize: 12, color: C.blue700, display: "flex", justifyContent: "space-between" }}>
                <span>Add-on totals</span>
                <span style={{ fontFamily: "monospace", fontWeight: 700 }}>+{fmtMin(addOnMinutes)} · {fmt((addOnMinutes / 60) * pricePerHour)}</span>
              </div>
            )}
          </div>
        </Section>

        {/* 07 CREW SIZE */}
        <Section num={sn()} title="Crew Size">
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", boxShadow: C.shadow }}>
            <div style={{ fontSize: 12, color: C.grey500, marginBottom: 10 }}>How many cleaners on this job? (Changes time on-site only — labour cost and price are the same.)</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4].map(n => {
                const on = crewSize === n;
                return (
                  <button key={n} onClick={() => setCrewSize(n)} style={{ flex: 1, padding: "12px 0", background: on ? C.activeBg : C.white, border: `1.5px solid ${on ? C.activeBorder : C.border}`, borderRadius: 10, cursor: "pointer", textAlign: "center", boxShadow: on ? `0 0 0 3px ${C.blue100}` : C.shadow }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: on ? C.blue700 : C.grey500, fontFamily: "monospace" }}>{n}</div>
                    <div style={{ fontSize: 10, color: on ? C.blue600 : C.grey400, marginTop: 2 }}>{n === 1 ? "solo" : "cleaners"}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        {/* TRAVEL */}
        <Section num={sn()} title="Travel">
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", boxShadow: C.shadow }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <Field label="Travel time for this job" sub={`Charged at $${TRAVEL_RATE}/hr · enter total minutes`}>
                <NumInput value={travelMinutes} onChange={v => setTravelMinutes(Math.max(0, v))} suffix="min" width={72} step={5} />
              </Field>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: C.grey500 }}>Adds to the quote</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: travelCharge > 0 ? C.blue700 : C.grey400, fontFamily: "monospace" }}>{fmt(travelCharge)}</div>
              </div>
            </div>
          </div>
        </Section>

        {/* 08 COST & MARGIN */}
        <Section num={sn()} title="Cost &amp; Margin">
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", boxShadow: C.shadow }}>
            {/* cost inputs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Cleaner wage" sub="$/hour, base">
                <NumInput value={wage} onChange={v => setWage(Math.max(0, v))} prefix="$" width={70} />
              </Field>
              <Field label="Employer loading" sub="vacation + CPP + EI + WCB">
                <NumInput value={Math.round(loadingPct * 10000) / 100} onChange={v => setLoadingPct(Math.max(0, v) / 100)} suffix="%" width={64} />
              </Field>
              <Field label="Monthly overhead" sub="insurance, vehicle, software…">
                <NumInput value={overhead} onChange={v => setOverhead(Math.max(0, v))} prefix="$" width={84} step={50} />
              </Field>
              <Field label="Monthly billable hours" sub="team person-hours / month">
                <NumInput value={billableHours} onChange={v => setBillableHours(Math.max(1, v))} width={70} step={10} />
              </Field>
            </div>

            {/* cost readout */}
            <div style={{ marginTop: 14, padding: "12px 14px", background: C.grey100, borderRadius: 9, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, fontSize: 12, color: C.grey700 }}>
              <span>Loaded labour <b style={{ fontFamily: "monospace", color: C.blue900 }}>{fmt2(loadedCostPerHour)}/hr</b></span>
              <span>+ Overhead <b style={{ fontFamily: "monospace", color: C.blue900 }}>{fmt2(overheadPerHour)}/hr</b></span>
              <span>= Your cost <b style={{ fontFamily: "monospace", color: C.blue900 }}>{fmt2(costPerHour)}/person-hr</b></span>
            </div>

            {/* threshold strip */}
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              {[["Break-even", 0], ["15% margin", 0.15], ["20% margin", 0.20], ["25% margin", 0.25]].map(([lab, m]) => (
                <div key={lab} style={{ flex: 1, textAlign: "center", padding: "8px 4px", background: C.blue50, border: `1px solid ${C.blue100}`, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.blue600, fontWeight: 600 }}>{lab}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.blue900, fontFamily: "monospace" }}>{fmt2(rateForMargin(m))}<span style={{ fontSize: 9, fontWeight: 500 }}>/hr</span></div>
                </div>
              ))}
            </div>

            {/* pricing mode */}
            <div style={{ marginTop: 16, borderTop: `1px solid ${C.grey200}`, paddingTop: 14 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {[["margin", "Price for target margin"], ["rate", "Set my own rate"]].map(([k, lab]) => (
                  <button key={k} onClick={() => setPricingMode(k)} style={{ flex: 1, padding: "10px 0", fontSize: 12, fontWeight: 700, background: pricingMode === k ? C.blue600 : C.white, color: pricingMode === k ? "#fff" : C.grey500, border: `1.5px solid ${pricingMode === k ? C.blue600 : C.border}`, borderRadius: 8, cursor: "pointer" }}>{lab}</button>
                ))}
              </div>
              {pricingMode === "margin" ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.grey700 }}>Target net margin</span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: C.blue700, fontFamily: "monospace" }}>{Math.round(targetMargin * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={50} step={1} value={Math.round(targetMargin * 100)} onChange={e => setTargetMargin(Number(e.target.value) / 100)} style={{ width: "100%", accentColor: C.blue600, cursor: "pointer" }} />
                  <div style={{ fontSize: 12, color: C.grey500, marginTop: 6 }}>
                    Charges <b style={{ fontFamily: "monospace", color: C.blue900 }}>{fmt2(pricePerHour)}/person-hr</b>. Market rate here is ~${marketRate}/hr.
                  </div>
                </div>
              ) : (
                <Field label="Your rate" sub={`Market here ~$${marketRate}/hr · break-even ${fmt2(costPerHour)}/hr`}>
                  <NumInput value={manualRate} onChange={v => setManualRate(Math.max(0, v))} prefix="$" suffix="/hr" width={70} />
                </Field>
              )}
            </div>
          </div>
        </Section>

        {/* QUOTE SUMMARY */}
        <div style={{ background: C.navyBg, border: `1px solid ${C.navyBorder}`, borderRadius: 14, padding: "26px 24px", boxShadow: "0 8px 24px rgba(13,45,94,0.25)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.navySubtle, marginBottom: 18 }}>Quote Summary</div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.navyText }}>{service.label}</div>
            <div style={{ fontSize: 12, color: C.navySubtle, marginTop: 3 }}>
              {effectiveSqft.toLocaleString()} sq ft · {beds} bed · {fullBaths + halfBaths * 0.5} bath
              {conditionFactor !== 1 && ` · ${conditionObj.label}`}{selectedAddOns.length > 0 && ` · ${selectedAddOns.length} add-on${selectedAddOns.length !== 1 ? "s" : ""}`}
            </div>
          </div>

          {/* time breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, marginBottom: 14 }}>
            <BreakdownRow
              label={service.model === "deep" ? `Deep base (${DEEP_BASE_MULT}× monthly)`
                   : service.model === "move" ? `Move base (${MOVE_BASE_MULT}× monthly)`
                   : `Base clean time (${coreHours > 0 ? Math.round(effectiveSqft / coreHours) : 0} sq ft/hr)`}
              value={fmtHrs(coreHours)} />
            {cabinetMinutes > 0 && <BreakdownRow label={service.model === "move" ? "Cabinets (interior + exterior)" : "Cabinets (exterior)"} value={`+${fmtMin(cabinetMinutes)}`} />}
            {conditionFactor !== 1 && <BreakdownRow label={`${conditionObj.label} +${Math.round((conditionFactor - 1) * 100)}%`} value={`+${fmtMin((conditionedHours - baseHours) * 60)}`} />}
            {bedBathMinutes > 0 && <BreakdownRow label={`Bed/bath (${beds} bed · ${fullBaths} full · ${halfBaths} half)`} value={`+${fmtMin(bedBathMinutes)}`} />}
            {addOnMinutes > 0 && <BreakdownRow label={`Add-ons (${selectedAddOns.length})`} value={`+${fmtMin(addOnMinutes)}`} />}
            <div style={{ borderTop: `1px solid ${C.navyDim}`, margin: "4px 0" }} />
            <BreakdownRow label="Total person-hours (cleaning)" value={fmtHrs(personHours)} bold />
            {crewSize > 1 && <BreakdownRow label={`On-site with ${crewSize} cleaners`} value={fmtHrs(wallClockHours)} subtle />}
            {travelMinutes > 0 && <BreakdownRow label={`Travel (${travelMinutes} min @ $${TRAVEL_RATE}/hr)`} value={`+${fmt(travelCharge)}`} subtle />}
          </div>

          {minChargeApplied && (
            <div style={{ marginBottom: 10, padding: "10px 14px", background: "rgba(217,119,6,0.15)", border: "1px solid rgba(217,119,6,0.3)", borderRadius: 8, fontSize: 12, color: "#fde68a" }}>
              Clean price ({fmt(cleanPrice)}) is below the ${MIN_CHARGE} minimum — minimum applied (which lifts your margin above target).
            </div>
          )}

          {/* TOTAL */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 14, color: C.navyMid }}>Total quote</div>
              <div style={{ fontSize: 12, color: C.navySubtle, marginTop: 2 }}>{fmtHrs(personHours)} clean · {fmt2(effectiveRate)}/person-hr{crewSize > 1 && ` · ~${fmtHrs(wallClockHours)} on-site`}{travelCharge > 0 && ` · incl. ${fmt(travelCharge)} travel`}</div>
            </div>
            <div style={{ fontSize: 44, fontWeight: 900, color: C.navyText, fontFamily: "monospace", lineHeight: 1 }}>{fmt(totalPrice)}</div>
          </div>

          {/* MARGIN */}
          <div style={{ marginTop: 18, padding: "14px 16px", background: `${marginColor}22`, border: `1px solid ${marginColor}55`, borderRadius: 9 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: marginSoft }}>Per-Visit Profitability</span>
              <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: `${marginColor}33`, color: marginSoft }}>{marginLabel}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <BreakdownRow label={`Labour (${fmtHrs(personHours)} @ ${fmt2(loadedCostPerHour)})`} value={fmt(personHours * loadedCostPerHour)} />
              <BreakdownRow label={`Overhead (${fmtHrs(personHours)} @ ${fmt2(overheadPerHour)})`} value={fmt(personHours * overheadPerHour)} />
              {travelCost > 0 && <BreakdownRow label={`Travel cost (${travelMinutes} min, loaded)`} value={fmt(travelCost)} />}
              <BreakdownRow label="Total cost" value={fmt(totalCost)} />
              <BreakdownRow label="Quote" value={fmt(totalPrice)} />
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", margin: "4px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, color: C.navyText, fontWeight: 700 }}>Net margin</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: marginSoft, fontFamily: "monospace" }}>
                  {fmt(netMargin)} <span style={{ fontSize: 13, fontWeight: 600 }}>({Math.round(netMarginPct * 100)}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* RECURRING VALUE */}
          {monthlyRev && (
            <>
              <div style={{ borderTop: `1px solid ${C.navyDim}`, margin: "16px 0 10px" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, color: C.navyMid }}>Monthly value</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.navySubtle, fontFamily: "monospace" }}>{fmt(monthlyRev)}/mo · {fmt(monthlyProfit)} profit</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <div style={{ fontSize: 13, color: C.navyMid }}>Annual value</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.navySubtle, fontFamily: "monospace" }}>{fmt(annualRev)}/yr</div>
              </div>
              <div style={{ fontSize: 11, color: C.navySubtle, marginTop: 4 }}>~{visitsPerMonth.toFixed(2)} visits/month · 12 months</div>
            </>
          )}

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.navyDim}`, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: C.navySubtle }}>
            <span>{location === "edmonton" ? "Edmonton" : "Leduc / Area"}</span>
            <span>{effectiveSqft.toLocaleString()} sq ft</span>
            <span>{crewSize} cleaner{crewSize !== 1 ? "s" : ""}</span>
            <span>You've averaged ${service.histRevHr.toFixed(0)}/hr on this service</span>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: C.grey400 }}>
          Production rates and costs calibrated from your job log · tune the constants at the top of the file
        </div>
      </div>
    </div>
  );
}

// ── SUB-COMPONENTS ───────────────────────────────────────────────────────────
function ServiceCard({ sv, active, onClick, effectiveSqft, conditionFactor, pricePerHour }) {
  const svHours = (serviceCoreHours(sv, effectiveSqft) + cabinetMinutesFor(sv, effectiveSqft) / 60) * conditionFactor;
  const svPrice = svHours * pricePerHour;
  const svRate  = svHours > 0 ? Math.round(effectiveSqft / svHours) : 0;
  return (
    <button onClick={onClick} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: active ? C.activeBg : C.white, border: `1.5px solid ${active ? C.activeBorder : C.border}`, borderRadius: 10, cursor: "pointer", textAlign: "left", boxShadow: active ? `0 0 0 3px ${C.blue100}` : C.shadow }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: active ? C.activeText : C.black }}>{sv.label}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: active ? C.blue100 : C.grey100, color: active ? C.blue700 : C.grey500 }}>{svRate} sq ft/hr</span>
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
    <button onClick={onClick} style={{ flex: flex ? 1 : "none", padding: "14px 16px", background: active ? C.activeBg : C.white, border: `1.5px solid ${active ? C.activeBorder : C.border}`, borderRadius: 10, cursor: "pointer", textAlign: "left", boxShadow: active ? `0 0 0 3px ${C.blue100}` : C.shadow }}>
      {children}
    </button>
  );
}

function Field({ label, sub, children }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.grey700 }}>{label}</div>
      <div style={{ fontSize: 11, color: C.grey500, margin: "1px 0 6px" }}>{sub}</div>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, prefix, suffix, width = 80, step = 1 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {prefix && <span style={{ fontSize: 16, color: C.blue900, fontWeight: 800 }}>{prefix}</span>}
      <input type="number" value={value} step={step} onChange={e => onChange(Number(e.target.value))}
        style={{ background: C.blue50, border: `1.5px solid ${C.blue500}`, borderRadius: 6, color: C.blue900, fontSize: 16, fontFamily: "monospace", fontWeight: 700, padding: "6px 10px", width, outline: "none", textAlign: "center" }} />
      {suffix && <span style={{ fontSize: 13, color: C.grey500, fontWeight: 600 }}>{suffix}</span>}
    </div>
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
        <button onClick={() => setValue(Math.max(min, value - 1))} disabled={value <= min} style={{ width: 32, height: 32, borderRadius: 6, background: value > min ? C.blue50 : C.grey100, border: `1.5px solid ${value > min ? C.blue500 : C.grey200}`, color: value > min ? C.blue700 : C.grey400, fontSize: 18, fontWeight: 800, cursor: value > min ? "pointer" : "not-allowed" }}>−</button>
        <span style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 800, color: C.blue900, minWidth: 32, textAlign: "center" }}>{value}</span>
        <button onClick={() => setValue(Math.min(max, value + 1))} disabled={value >= max} style={{ width: 32, height: 32, borderRadius: 6, background: value < max ? C.blue50 : C.grey100, border: `1.5px solid ${value < max ? C.blue500 : C.grey200}`, color: value < max ? C.blue700 : C.grey400, fontSize: 18, fontWeight: 800, cursor: value < max ? "pointer" : "not-allowed" }}>+</button>
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
