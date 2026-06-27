import { useState, useCallback, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, CartesianGrid, Legend,
  Cell,
} from "recharts";

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  hydroBlue:    "#0F4C81",
  monsoonBlue:  "#1565C0",
  rainfallBlue: "#42A5F5",
  aquiferTeal:  "#00A6A6",
  mistWhite:    "#F7FAFC",
  pureWhite:    "#FFFFFF",
  concreteGrey: "#D7DEE5",
  structGrey:   "#64748B",
  graphite:     "#1E293B",
  rechargeGreen:"#2E8B57",
  soilAmber:    "#E8B44D",
  overflowRed:  "#D64545",
  wseViolet:    "#7C3AED",
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const RUNOFF_COEFFICIENTS = {
  "RCC / Concrete (Inclined)": { C: 0.90, source: "IS:15797 / Patil 2023" },
  "Metal Sheet / GI":          { C: 0.90, source: "Akhtar 2023" },
  "Mangalore / Clay Tile":     { C: 0.85, source: "Meenakshi 2022" },
  "RCC / Concrete (Flat)":     { C: 0.80, source: "IS:15797 / Villar-Navascués 2020" },
  "Asphalt Sheet":             { C: 0.70, source: "Villar-Navascués 2020" },
  "Asbestos / AC Sheet":       { C: 0.85, source: "Hari 2019 (IJITEE)" },
  "Gravel Roof":               { C: 0.62, source: "Farreny et al. 2011" },
  "Thatch / Non-cemented":     { C: 0.50, source: "Singh & Turkiya 2017" },
};

const BUILDING_TYPES = {
  "Residential":       { lpcd: 135, nonPotablePct: 0.40 },
  "School / College":  { lpcd: 45,  nonPotablePct: 0.60 },
  "Hostel":            { lpcd: 90,  nonPotablePct: 0.45 },
  "Office":            { lpcd: 55,  nonPotablePct: 0.55 },
  "Hospital":          { lpcd: 340, nonPotablePct: 0.30 },
  "Industry":          { lpcd: 30,  nonPotablePct: 0.80 },
};

const MONTHLY_DISTRIBUTION = [
  { month: "Jan", share: 0.012 },
  { month: "Feb", share: 0.008 },
  { month: "Mar", share: 0.005 },
  { month: "Apr", share: 0.003 },
  { month: "May", share: 0.010 },
  { month: "Jun", share: 0.095 },
  { month: "Jul", share: 0.230 },
  { month: "Aug", share: 0.260 },
  { month: "Sep", share: 0.210 },
  { month: "Oct", share: 0.120 },
  { month: "Nov", share: 0.030 },
  { month: "Dec", share: 0.017 },
];

const GW_ZONES = {
  "Amravati":   { depth: 12, aquifer: "Basalt",   recharge: "Moderate" },
  "Osmanabad":  { depth: 18, aquifer: "Basalt",   recharge: "Moderate" },
  "Nagpur":     { depth: 8,  aquifer: "Alluvial", recharge: "Good" },
  "Pune":       { depth: 10, aquifer: "Mixed",    recharge: "Good" },
  "Aurangabad": { depth: 20, aquifer: "Basalt",   recharge: "Poor" },
  "Latur":      { depth: 22, aquifer: "Basalt",   recharge: "Poor" },
  "Nanded":     { depth: 16, aquifer: "Basalt",   recharge: "Moderate" },
  "Yavatmal":   { depth: 14, aquifer: "Basalt",   recharge: "Moderate" },
  "Wardha":     { depth: 10, aquifer: "Alluvial", recharge: "Good" },
  "Chandrapur": { depth: 7,  aquifer: "Mixed",    recharge: "Good" },
  "Hisar":      { depth: 80, aquifer: "Sandy",    recharge: "Good" },
  "Custom":     { depth: null, aquifer: "Unknown", recharge: "Unknown" },
};

const SOIL_PERMEABILITY = {
  "Clay (Low)":         { k: 0.01, label: "Low",      color: C.overflowRed },
  "Black Cotton Soil":  { k: 0.05, label: "Very Low", color: "#b91c1c" },
  "Clay-Loam (Medium)": { k: 0.5,  label: "Medium",   color: C.soilAmber },
  "Laterite":           { k: 1.0,  label: "Medium",   color: C.soilAmber },
  "Loam (Medium-High)": { k: 2.0,  label: "Med-High", color: "#84cc16" },
  "Sandy-Loam (High)":  { k: 5.0,  label: "High",     color: C.rechargeGreen },
  "Sandy (Very High)":  { k: 15.0, label: "Very High",color: C.aquiferTeal },
};

const MANNING_N_PVC = 0.010;

// ─── ENGINE FUNCTIONS ─────────────────────────────────────────────────────────
function calcAnnualRunoff(rain, area, coeff, firstFlushFactor) {
  return (rain * area * coeff * (1 - firstFlushFactor)) / 1000;
}

function calcMonthlyRunoff(rain, area, coeff, firstFlushFactor) {
  return MONTHLY_DISTRIBUTION.map(({ month, share }) => {
    const monthRain = rain * share;
    const rawRunoff = monthRain * area * coeff / 1000;
    const ff = share > 0.02 ? firstFlushFactor : 0;
    return {
      month,
      rainfall: +(monthRain).toFixed(1),
      runoff:   +(rawRunoff * (1 - ff)).toFixed(2),
    };
  });
}

function calcMultiBlockRunoff(blocks, rain, firstFlushFactor) {
  return blocks.reduce((sum, b) => {
    const area = parseFloat(b.length || 0) * parseFloat(b.width || 0);
    const coeff = RUNOFF_COEFFICIENTS[b.roofType]?.C || 0.8;
    return sum + calcAnnualRunoff(rain, area, coeff, firstFlushFactor);
  }, 0);
}

function calcWaterBalance(monthlyRunoff, dailyDemand, tankCapacity) {
  let storage = 0;
  return monthlyRunoff.map(({ month, runoff }) => {
    const demand = dailyDemand * 30.4;
    const available = storage + runoff;
    const met = Math.min(demand, available);
    const deficit = Math.max(demand - available, 0);
    storage = Math.min(Math.max(available - demand, 0), tankCapacity);
    return {
      month,
      inflow:  +runoff.toFixed(2),
      demand:  +demand.toFixed(2),
      storage: +storage.toFixed(2),
      deficit: +deficit.toFixed(2),
      met:     +met.toFixed(2),
    };
  });
}

function calcWSE(waterBalance) {
  const totalMet = waterBalance.reduce((s, m) => s + m.met, 0);
  const totalDemand = waterBalance.reduce((s, m) => s + m.demand, 0);
  return totalDemand > 0 ? +((totalMet / totalDemand) * 100).toFixed(1) : 0;
}

function calcReliability(waterBalance) {
  const daysMet = waterBalance.reduce((s, m) => {
    return s + (m.deficit === 0 ? 30.4 : (m.met / (m.demand || 1)) * 30.4);
  }, 0);
  return +Math.min((daysMet / 365) * 100, 100).toFixed(1);
}

function calcDryPeriodTankSize(population, lpcd, dryMonths) {
  const dryDays = dryMonths * 30.4;
  const vol = (dryDays * population * lpcd * 0.001 * 0.4);
  return Math.round(vol / 5) * 5 || 5;
}

function calcRatioTankSize(annualRunoff, annualDemand) {
  if (!annualDemand || annualDemand <= 0) return Math.round(annualRunoff * 0.3 / 5) * 5 || 5;
  const r = annualRunoff / annualDemand;
  if (r >= 2)   return Math.round(annualDemand * 0.15 / 5) * 5;
  if (r >= 1)   return Math.round(annualDemand * 0.25 / 5) * 5;
  if (r >= 0.5) return Math.round(annualRunoff * 0.30 / 5) * 5;
  return Math.round(annualRunoff * 0.50 / 5) * 5;
}

function calcPeakFlow(area, coeff, rain) {
  const peakMonthShare = 0.260;
  const peakMonthRain = rain * peakMonthShare;
  const I_hr = peakMonthRain / 30;
  return +(coeff * I_hr * (area / 10000) / 36).toFixed(5);
}

function calcPipeDiameter(peakFlow_m3s) {
  const STANDARD_SIZES = [75, 100, 110, 150, 200, 250];
  for (const d of STANDARD_SIZES) {
    const R = (d / 1000) / 4;
    const V = (1 / MANNING_N_PVC) * Math.pow(R, 2/3) * Math.pow(0.01, 0.5);
    const Q = (Math.PI / 4) * Math.pow(d / 1000, 2) * V * 0.5;
    if (Q >= peakFlow_m3s) return d;
  }
  return 250;
}

function rechargeScore(gwDepth, soilKey, slope, rain) {
  let s = 0;
  if (gwDepth > 20) s += 30; else if (gwDepth > 10) s += 20; else if (gwDepth > 5) s += 10; else s += 5;
  const k = SOIL_PERMEABILITY[soilKey]?.k || 1;
  if (k > 5) s += 30; else if (k > 1) s += 20; else if (k > 0.1) s += 10; else s += 3;
  if (rain > 800) s += 25; else if (rain > 500) s += 15; else s += 5;
  if (slope < 2) s += 15; else if (slope < 5) s += 10; else if (slope < 10) s += 5;
  return Math.min(s, 100);
}

function rechargeRecommendation(score, gwDepth, soilKey, slope) {
  const k = SOIL_PERMEABILITY[soilKey]?.k || 1;
  if (gwDepth < 5)  return { type: "Recharge Shaft",        reason: "Shallow water table — shaft recharge most effective", priority: "HIGH" };
  if (k < 0.1)      return { type: "Storage Tank Only",     reason: "Very low permeability — recharge not viable",         priority: "STORAGE" };
  if (slope > 10)   return { type: "Recharge Trench",       reason: "High slope — trench along contour captures runoff",   priority: "MEDIUM" };
  if (score >= 70)  return { type: "Recharge Pit + Storage",reason: "Excellent — dual system maximises recharge",          priority: "HIGH" };
  if (score >= 40)  return { type: "Recharge Pit",          reason: "Moderate suitability — pit recharge recommended",     priority: "MEDIUM" };
  return              { type: "Storage Tank",               reason: "Poor recharge conditions — prioritise storage",       priority: "STORAGE" };
}

// ─── STYLE TOKENS ─────────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", boxSizing: "border-box",
  background: C.pureWhite, border: `1.5px solid ${C.concreteGrey}`,
  borderRadius: "8px", color: C.graphite,
  padding: "0.6rem 0.85rem", fontSize: "0.88rem",
  fontFamily: "'IBM Plex Mono', monospace", outline: "none",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
};
const selectStyle = {
  ...inputStyle, cursor: "pointer", appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748B' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 0.85rem center",
  paddingRight: "2.2rem",
};

// ─── ATOMS ────────────────────────────────────────────────────────────────────
const Field = ({ label, note, children }) => (
  <div style={{ marginBottom: "1.1rem" }}>
    <label style={{
      display: "block", fontSize: "0.65rem",
      fontFamily: "'IBM Plex Mono', monospace",
      letterSpacing: "0.08em", color: C.structGrey,
      marginBottom: "0.4rem", textTransform: "uppercase", fontWeight: 600,
    }}>{label}</label>
    {children}
    {note && (
      <div style={{ fontSize: "0.62rem", color: "#94a3b8", marginTop: "0.3rem", lineHeight: 1.5 }}>
        {note}
      </div>
    )}
  </div>
);

const StyledInput = ({ value, onChange, min, max, step = "1", placeholder }) => (
  <input type="number" value={value} onChange={e => onChange(e.target.value)}
    min={min} max={max} step={step} placeholder={placeholder}
    style={inputStyle}
    onFocus={e => { e.target.style.borderColor = C.hydroBlue; e.target.style.boxShadow = `0 0 0 3px ${C.hydroBlue}18`; }}
    onBlur={e => { e.target.style.borderColor = C.concreteGrey; e.target.style.boxShadow = "none"; }}
  />
);

const StyledSelect = ({ value, onChange, options }) => (
  <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}
    onFocus={e => { e.target.style.borderColor = C.hydroBlue; e.target.style.boxShadow = `0 0 0 3px ${C.hydroBlue}18`; }}
    onBlur={e => { e.target.style.borderColor = C.concreteGrey; e.target.style.boxShadow = "none"; }}
  >
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

const InfoChip = ({ label, value, color }) => (
  <div style={{ background: `${color}12`, border: `1px solid ${color}30`, borderRadius: "8px", padding: "0.5rem 0.7rem" }}>
    <div style={{ fontSize: "0.56rem", color: C.structGrey, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.15rem" }}>{label}</div>
    <div style={{ fontSize: "0.85rem", fontWeight: 700, color, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
  </div>
);

const MetricCard = ({ label, value, unit, color, sub, icon, badge }) => (
  <div className="metric-card" style={{
    background: C.pureWhite, border: `1px solid ${C.concreteGrey}`,
    borderRadius: "12px", padding: "1rem 1.1rem",
    borderTop: `3px solid ${color}`,
    boxShadow: "0 1px 4px rgba(15,76,129,0.06)",
    position: "relative", overflow: "hidden",
  }}>
    {badge && (
      <div style={{
        position: "absolute", top: "0.65rem", right: "0.65rem",
        fontSize: "0.52rem", background: `${color}15`, color,
        border: `1px solid ${color}30`, borderRadius: "4px",
        padding: "0.15rem 0.45rem", fontWeight: 700, letterSpacing: "0.06em",
      }}>{badge}</div>
    )}
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
      {icon && <span style={{ fontSize: "1rem" }}>{icon}</span>}
      <div style={{ fontSize: "0.6rem", color: C.structGrey, letterSpacing: "0.09em", textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.4 }}>{label}</div>
    </div>
    <div className="fade-in" style={{ fontSize: "1.7rem", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: "0.66rem", color: C.structGrey, fontFamily: "'IBM Plex Mono', monospace", marginTop: "0.25rem" }}>{unit}</div>
    {sub && <div style={{ fontSize: "0.61rem", color: "#94a3b8", marginTop: "0.3rem", fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.4 }}>{sub}</div>}
  </div>
);

const SectionTitle = ({ children, action }) => (
  <div style={{
    fontSize: "0.6rem", color: C.aquiferTeal, letterSpacing: "0.12em",
    textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace",
    fontWeight: 700, marginBottom: "1rem",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ width: "14px", height: "2px", background: C.aquiferTeal, borderRadius: "1px" }} />
      {children}
    </div>
    {action}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.pureWhite, border: `1px solid ${C.concreteGrey}`,
      borderRadius: "10px", padding: "0.7rem 1rem",
      boxShadow: "0 8px 24px rgba(15,76,129,0.14)",
    }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.68rem", color: C.structGrey, marginBottom: "0.4rem", fontWeight: 600 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.78rem", color: p.color,
          display: "flex", justifyContent: "space-between", gap: "1.2rem", alignItems: "center",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: p.color, display: "inline-block" }} />
            {p.name}
          </span>
          <strong>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value} m³</strong>
        </div>
      ))}
    </div>
  );
};

const ScoreMeter = ({ score }) => {
  const color = score >= 70 ? C.rechargeGreen : score >= 40 ? C.soilAmber : C.overflowRed;
  const label = score >= 70 ? "Excellent" : score >= 40 ? "Moderate" : "Poor";
  const circumference = 2 * Math.PI * 26;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}>
      <div style={{ position: "relative", width: "72px", height: "72px", flexShrink: 0 }}>
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="28" fill="none" stroke={`${color}20`} strokeWidth="6" />
          <circle cx="36" cy="36" r="28" fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={`${circumference * (1 - score / 100)}`}
            strokeLinecap="round" transform="rotate(-90 36 36)"
            style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
          />
          <text x="36" y="41" textAnchor="middle" fontFamily="'Barlow Condensed'" fontWeight="700" fontSize="16" fill={color}>{score}</text>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: "0.58rem", color: C.structGrey, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace" }}>Recharge Suitability</div>
        <div style={{ fontSize: "1.3rem", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color, letterSpacing: "0.02em" }}>{label}</div>
        <div style={{ fontSize: "0.63rem", color: "#94a3b8", fontFamily: "'IBM Plex Mono', monospace" }}>Score: {score}/100 · CGWB</div>
      </div>
    </div>
  );
};

const PriorityBadge = ({ priority }) => {
  const cfg = {
    HIGH:    { bg: `${C.rechargeGreen}15`, color: C.rechargeGreen, border: `${C.rechargeGreen}30` },
    MEDIUM:  { bg: `${C.soilAmber}15`,     color: C.soilAmber,     border: `${C.soilAmber}30`     },
    STORAGE: { bg: `${C.structGrey}15`,    color: C.structGrey,    border: `${C.structGrey}30`    },
  }[priority] || {};
  return (
    <div style={{
      marginTop: "0.6rem", display: "inline-flex", alignItems: "center", gap: "0.4rem",
      padding: "0.25rem 0.7rem", borderRadius: "100px",
      background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: cfg.color }} />
      <span style={{ fontSize: "0.6rem", color: cfg.color, fontWeight: 700, letterSpacing: "0.1em" }}>
        {priority === "STORAGE" ? "STORAGE FOCUS" : `${priority} PRIORITY`}
      </span>
    </div>
  );
};

// ─── STEP BAR ─────────────────────────────────────────────────────────────────
const StepBar = ({ step, steps, onStep }) => (
  <div className="step-bar" style={{
    display: "flex", background: C.pureWhite,
    borderBottom: `1px solid ${C.concreteGrey}`, flexShrink: 0,
  }}>
    {steps.map((s, i) => {
      const active = step === i + 1, done = step > i + 1;
      return (
        <button key={s} className="step-btn" onClick={() => onStep(i + 1)} style={{
          flex: 1, minWidth: "80px",
          padding: "0.7rem 0.5rem", background: "none", border: "none",
          borderBottom: active ? `3px solid ${C.hydroBlue}` : done ? `3px solid ${C.aquiferTeal}` : "3px solid transparent",
          cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem",
        }}>
          <div style={{
            width: "22px", height: "22px", borderRadius: "50%",
            background: active ? C.hydroBlue : done ? C.aquiferTeal : C.concreteGrey,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.6rem", fontWeight: 700,
            color: active || done ? "#fff" : C.structGrey,
            fontFamily: "'IBM Plex Mono', monospace",
            transition: "background 0.2s ease",
          }}>
            {done ? "✓" : i + 1}
          </div>
          <div style={{
            fontSize: "0.56rem", color: active ? C.hydroBlue : done ? C.aquiferTeal : C.structGrey,
            fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.05em",
            textTransform: "uppercase", fontWeight: active ? 700 : 400,
            transition: "color 0.2s ease",
          }}>{s}</div>
        </button>
      );
    })}
  </div>
);

// ─── ROOF BLOCK ROW ───────────────────────────────────────────────────────────
const RoofBlockRow = ({ block, index, onChange, onRemove, canRemove }) => {
  const area = (parseFloat(block.length || 0) * parseFloat(block.width || 0));
  const coeff = RUNOFF_COEFFICIENTS[block.roofType]?.C || 0.8;
  return (
    <div style={{
      background: `${C.hydroBlue}04`, border: `1px solid ${C.concreteGrey}`,
      borderRadius: "10px", padding: "0.9rem", marginBottom: "0.75rem",
      transition: "border-color 0.15s ease",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = `${C.hydroBlue}40`}
      onMouseLeave={e => e.currentTarget.style.borderColor = C.concreteGrey}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.7rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ width: "20px", height: "20px", borderRadius: "6px", background: `${C.aquiferTeal}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 700, color: C.aquiferTeal, fontFamily: "'IBM Plex Mono'" }}>
            {index + 1}
          </div>
          <span style={{ fontSize: "0.63rem", fontFamily: "'IBM Plex Mono'", color: C.aquiferTeal, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Roof Block</span>
        </div>
        {canRemove && (
          <button onClick={onRemove} style={{
            background: `${C.overflowRed}10`, border: `1px solid ${C.overflowRed}25`,
            borderRadius: "6px", cursor: "pointer", color: C.overflowRed,
            fontSize: "0.7rem", padding: "0.2rem 0.55rem", fontFamily: "'IBM Plex Mono'",
            transition: "background 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = `${C.overflowRed}20`}
            onMouseLeave={e => e.currentTarget.style.background = `${C.overflowRed}10`}
          >Remove</button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.58rem", color: C.structGrey, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem", fontFamily: "'IBM Plex Mono'" }}>Length (m)</label>
          <input type="number" value={block.length} onChange={e => onChange("length", e.target.value)}
            style={{ ...inputStyle, padding: "0.45rem 0.65rem", fontSize: "0.82rem" }} min={1}
            onFocus={e => e.target.style.borderColor = C.hydroBlue}
            onBlur={e => e.target.style.borderColor = C.concreteGrey}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.58rem", color: C.structGrey, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem", fontFamily: "'IBM Plex Mono'" }}>Width (m)</label>
          <input type="number" value={block.width} onChange={e => onChange("width", e.target.value)}
            style={{ ...inputStyle, padding: "0.45rem 0.65rem", fontSize: "0.82rem" }} min={1}
            onFocus={e => e.target.style.borderColor = C.hydroBlue}
            onBlur={e => e.target.style.borderColor = C.concreteGrey}
          />
        </div>
      </div>
      <div>
        <label style={{ display: "block", fontSize: "0.58rem", color: C.structGrey, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem", fontFamily: "'IBM Plex Mono'" }}>Roof Material</label>
        <select value={block.roofType} onChange={e => onChange("roofType", e.target.value)}
          style={{ ...selectStyle, padding: "0.45rem 2rem 0.45rem 0.65rem", fontSize: "0.78rem" }}
          onFocus={e => e.target.style.borderColor = C.hydroBlue}
          onBlur={e => e.target.style.borderColor = C.concreteGrey}
        >
          {Object.keys(RUNOFF_COEFFICIENTS).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div style={{
        marginTop: "0.6rem", display: "flex", justifyContent: "space-between",
        background: `${C.hydroBlue}06`, borderRadius: "6px",
        padding: "0.4rem 0.65rem", fontSize: "0.67rem",
      }}>
        <span style={{ color: C.structGrey }}>Area: <strong style={{ color: C.hydroBlue }}>{area.toFixed(0)} m²</strong></span>
        <span style={{ color: C.structGrey }}>Coeff C = <strong style={{ color: C.rechargeGreen }}>{coeff}</strong></span>
      </div>
    </div>
  );
};

// ─── PROGRESS BAR ─────────────────────────────────────────────────────────────
const ProgressBar = ({ value, max, color, label, height = 8 }) => {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ marginBottom: "0.5rem" }}>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem", fontSize: "0.63rem", color: C.structGrey }}>
          <span>{label}</span>
          <strong style={{ color }}>{pct.toFixed(0)}%</strong>
        </div>
      )}
      <div style={{ background: `${color}20`, borderRadius: "100px", height, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: "100px",
          background: `linear-gradient(90deg, ${color}cc, ${color})`,
          width: `${pct}%`,
          transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
        }} />
      </div>
    </div>
  );
};

// ─── TOAST ────────────────────────────────────────────────────────────────────
const Toast = ({ message }) => (
  <div className="toast">{message}</div>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function JalSetuEngine() {
  const [district, setDistrict] = useState("Amravati");
  const [customGWDepth, setCustomGWDepth] = useState(12);
  const [annualRainfall, setAnnualRainfall] = useState(870);
  const [slope, setSlope] = useState(2);
  const [buildingType, setBuildingType] = useState("Residential");
  const [population, setPopulation] = useState(6);
  const [customLPCD, setCustomLPCD] = useState(null);
  const [soilType, setSoilType] = useState("Black Cotton Soil");
  const [firstFlushPct, setFirstFlushPct] = useState(10);
  const [dryMonths, setDryMonths] = useState(8);
  const [step, setStep] = useState(1);
  const [toast, setToast] = useState(null);

  const [roofBlocks, setRoofBlocks] = useState([
    { length: 15, width: 12, roofType: "RCC / Concrete (Flat)" },
  ]);

  const showToast = useCallback((msg, duration = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(null), duration);
  }, []);

  const addBlock = () => {
    if (roofBlocks.length < 5) {
      setRoofBlocks(b => [...b, { length: 10, width: 8, roofType: "RCC / Concrete (Flat)" }]);
      showToast("Roof block added");
    }
  };
  const removeBlock = (i) => { setRoofBlocks(b => b.filter((_, idx) => idx !== i)); showToast("Block removed"); };
  const updateBlock = (i, key, val) => setRoofBlocks(b => b.map((bl, idx) => idx === i ? { ...bl, [key]: val } : bl));

  // ─── DERIVED ────────────────────────────────────────────────────────────────
  const gwInfo        = GW_ZONES[district] || GW_ZONES["Custom"];
  const gwDepth       = district === "Custom" ? (parseFloat(customGWDepth) || 0) : (gwInfo.depth || 0);
  const rainfallNum   = parseFloat(annualRainfall) || 0;
  const populationNum = Math.max(parseInt(population) || 0, 0);
  const slopeNum      = parseFloat(slope) || 0;
  const lpcd          = customLPCD || BUILDING_TYPES[buildingType].lpcd;
  const nonPotablePct = BUILDING_TYPES[buildingType].nonPotablePct;
  const ffFactor      = (parseFloat(firstFlushPct) || 0) / 100;

  const totalArea = roofBlocks.reduce((s, b) => s + (parseFloat(b.length || 0) * parseFloat(b.width || 0)), 0);
  const weightedC = totalArea > 0
    ? roofBlocks.reduce((s, b) => {
        const a = parseFloat(b.length || 0) * parseFloat(b.width || 0);
        return s + a * (RUNOFF_COEFFICIENTS[b.roofType]?.C || 0.8);
      }, 0) / totalArea
    : 0.8;

  const annualRunoff   = calcMultiBlockRunoff(roofBlocks, rainfallNum, ffFactor);
  const monthlyRunoff  = calcMonthlyRunoff(rainfallNum, totalArea, weightedC, ffFactor);
  const dailyDemand    = (populationNum * lpcd) / 1000;
  const annualDemand   = dailyDemand * 365;
  const supplyRatio    = annualDemand > 0 ? annualRunoff / annualDemand : 0;
  const tankSizeRatio  = calcRatioTankSize(annualRunoff, annualDemand);
  const tankSizeDryPd  = calcDryPeriodTankSize(populationNum, lpcd, dryMonths);
  const tankSize       = Math.max(tankSizeRatio, tankSizeDryPd);
  const waterBalance   = calcWaterBalance(monthlyRunoff, dailyDemand, tankSize);
  const wse            = calcWSE(waterBalance);
  const reliability    = calcReliability(waterBalance);
  const coveragePct    = Math.min((annualRunoff / (annualDemand || 1)) * 100, 100).toFixed(1);
  const peakFlow       = calcPeakFlow(totalArea, weightedC, rainfallNum);
  const pipeDiameter   = calcPipeDiameter(peakFlow);
  const rScore         = rechargeScore(gwDepth, soilType, slopeNum, rainfallNum);
  const rRec           = rechargeRecommendation(rScore, gwDepth, soilType, slopeNum);
  const rechargeColor  = gwInfo.recharge === "Good" ? C.rechargeGreen : gwInfo.recharge === "Moderate" ? C.soilAmber : C.overflowRed;
  const nonPotableAnnual = annualDemand * nonPotablePct;
  const nonPotableWsePct = nonPotableAnnual > 0 ? Math.min((annualRunoff / nonPotableAnnual) * 100, 100).toFixed(1) : "0";

  const handleCopyReport = () => {
    const text = [
      "JalSetu RWH Assessment Report",
      "==============================",
      `District: ${district}`,
      `Annual Rainfall: ${rainfallNum} mm`,
      `Total Roof Area: ${totalArea.toFixed(0)} m²`,
      `Annual Runoff: ${annualRunoff.toFixed(1)} m³/yr`,
      `Recommended Tank: ${tankSize} m³`,
      `WSE: ${wse}% | Reliability: ${reliability}%`,
      `Pipe Diameter: ${pipeDiameter} mm PVC`,
      `Recharge System: ${rRec.type}`,
      `GW Depth: ${gwDepth} m BGL`,
      "",
      "Standards: IS:15797:2008 · CGWB · Patil 2023 · Akhtar 2023 · Chowdhury & Akter 2026 · Kiran & Kumar 2023",
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => showToast("✓ Report copied to clipboard")).catch(() => showToast("Copy failed — try again"));
  };

  const steps = ["Site & Rainfall", "Roof Blocks", "Subsurface", "Results"];

  const wseColor = wse >= 80 ? C.rechargeGreen : wse >= 40 ? C.soilAmber : C.overflowRed;

  return (
    <div style={{ minHeight: "100vh", background: C.mistWhite, fontFamily: "'IBM Plex Mono', monospace", color: C.graphite, display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=IBM+Plex+Mono:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* ── HEADER ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.hydroBlue} 0%, ${C.monsoonBlue} 100%)`,
        padding: "0 1.5rem", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: "58px", flexShrink: 0,
        boxShadow: "0 2px 12px rgba(15,76,129,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem",
          }}>💧</div>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.2rem", color: "#fff", letterSpacing: "0.04em", lineHeight: 1 }}>
              JalSetu AI <span style={{ fontSize: "0.75rem", fontWeight: 600, opacity: 0.6 }}>v4</span>
            </div>
            <div className="header-title-sub" style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.55)", letterSpacing: "0.09em", textTransform: "uppercase", marginTop: "2px" }}>
              Rooftop RWH Assessment · IS:15797 · CGWB · Multi-Block · WSE Analysis
            </div>
          </div>
        </div>
        <div className="header-refs" style={{ fontSize: "0.56rem", color: "rgba(255,255,255,0.4)", textAlign: "right", lineHeight: 1.7 }}>
          <div>IS:15797 · CGWB · Patil 2023 · Akhtar 2023</div>
          <div>Chowdhury 2026 · Kiran & Kumar 2023 · Hari 2019</div>
          <div>Villar-Navascués 2020 · Meenakshi 2022 · Singh 2017</div>
        </div>
      </div>

      <StepBar step={step} steps={steps} onStep={setStep} />

      {/* ── BODY ── */}
      <div className="body-layout" style={{ display: "flex", flex: 1, minHeight: 0 }}>

        {/* LEFT PANEL */}
        <div className="left-panel" style={{
          width: "320px", flexShrink: 0,
          borderRight: `1px solid ${C.concreteGrey}`,
          padding: "1.4rem 1.2rem",
          background: C.pureWhite,
          overflowY: "auto",
          display: "flex", flexDirection: "column",
        }}>

          {/* STEP 1 */}
          {step === 1 && (
            <>
              <SectionTitle>Site & Rainfall Data</SectionTitle>

              <Field label="District" note="GW depth auto-loaded from CGWB database">
                <StyledSelect value={district} onChange={setDistrict} options={Object.keys(GW_ZONES)} />
              </Field>

              {district === "Custom" ? (
                <Field label="Groundwater Depth (m BGL)" note="From CGWB report or field survey">
                  <StyledInput value={customGWDepth} onChange={setCustomGWDepth} min={1} max={150} />
                </Field>
              ) : (
                <div style={{ background: `${C.hydroBlue}07`, border: `1px solid ${C.hydroBlue}18`, borderRadius: "10px", padding: "0.9rem", marginBottom: "1.1rem" }}>
                  <div style={{ fontSize: "0.58rem", color: C.aquiferTeal, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.6rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span>●</span> CGWB Data Loaded
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                    <InfoChip label="Depth" value={`${gwInfo.depth}m`} color={C.hydroBlue} />
                    <InfoChip label="Aquifer" value={gwInfo.aquifer} color={C.aquiferTeal} />
                    <InfoChip label="Recharge" value={gwInfo.recharge} color={rechargeColor} />
                  </div>
                </div>
              )}

              <Field label="Annual Rainfall (mm)" note="IMD / Open-Meteo 30-yr district average">
                <StyledInput value={annualRainfall} onChange={setAnnualRainfall} min={200} max={3000} />
              </Field>

              <Field label="Ground Slope (%)" note="0–2% flat · 2–5% gentle · >10% steep">
                <StyledInput value={slope} onChange={setSlope} min={0} max={45} step="0.5" />
              </Field>

              <Field label="First-Flush Loss (%)" note="Recommended 10% — Kiran & Kumar 2023, Chowdhury 2026">
                <StyledInput value={firstFlushPct} onChange={setFirstFlushPct} min={0} max={25} step="1" />
              </Field>

              <Field label="Dry Season Duration (months)" note="Used for dry-period tank sizing — GoI Manual Ch.6">
                <StyledInput value={dryMonths} onChange={setDryMonths} min={1} max={11} step="1" />
              </Field>

              <div style={{ background: `${C.aquiferTeal}0d`, border: `1px dashed ${C.aquiferTeal}50`, borderRadius: "10px", padding: "0.85rem", marginTop: "auto" }}>
                <div style={{ fontSize: "0.58rem", color: C.aquiferTeal, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.55rem", fontWeight: 700 }}>Live Preview</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginBottom: "0.35rem" }}>
                  <span style={{ color: C.structGrey }}>Est. Annual Runoff</span>
                  <strong style={{ color: C.hydroBlue }}>{annualRunoff.toFixed(0)} m³</strong>
                </div>
                <ProgressBar value={annualRunoff} max={Math.max(annualRunoff * 1.5, 100)} color={C.rainfallBlue} />
                <div style={{ fontSize: "0.62rem", color: "#94a3b8", marginTop: "0.3rem" }}>First-flush {firstFlushPct}% already deducted</div>
              </div>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <SectionTitle>Roof Catchment Blocks</SectionTitle>
              <div style={{ fontSize: "0.63rem", color: C.structGrey, marginBottom: "1rem", lineHeight: 1.7, background: `${C.rainfallBlue}08`, borderRadius: "8px", padding: "0.65rem 0.8rem", border: `1px solid ${C.rainfallBlue}20` }}>
                Add each roof section separately — different materials have different runoff coefficients.
                <br /><span style={{ color: "#94a3b8" }}>Method: Hari 2019 (IJITEE), Kiran & Kumar 2023</span>
              </div>

              {roofBlocks.map((b, i) => (
                <RoofBlockRow key={i} block={b} index={i}
                  onChange={(k, v) => updateBlock(i, k, v)}
                  onRemove={() => removeBlock(i)}
                  canRemove={roofBlocks.length > 1}
                />
              ))}

              {roofBlocks.length < 5 && (
                <button onClick={addBlock} style={{
                  width: "100%", padding: "0.65rem",
                  background: "none", border: `1.5px dashed ${C.aquiferTeal}60`,
                  borderRadius: "10px", cursor: "pointer", color: C.aquiferTeal,
                  fontSize: "0.7rem", fontFamily: "'IBM Plex Mono', monospace",
                  fontWeight: 600, marginBottom: "1rem",
                  transition: "background 0.15s, border-color 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${C.aquiferTeal}0a`; e.currentTarget.style.borderColor = C.aquiferTeal; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = `${C.aquiferTeal}60`; }}
                >
                  + Add Roof Block ({roofBlocks.length}/5)
                </button>
              )}

              <Field label="Building Type">
                <StyledSelect value={buildingType} onChange={setBuildingType} options={Object.keys(BUILDING_TYPES)} />
              </Field>

              <Field label="Occupants / Population">
                <StyledInput value={population} onChange={setPopulation} min={1} max={10000} />
              </Field>

              <Field label="Custom LPCD (optional)" note={`Default for ${buildingType}: ${BUILDING_TYPES[buildingType].lpcd} lpcd · Non-potable: ${(BUILDING_TYPES[buildingType].nonPotablePct * 100).toFixed(0)}%`}>
                <StyledInput value={customLPCD || ""} onChange={v => setCustomLPCD(v ? parseFloat(v) : null)} placeholder={`${BUILDING_TYPES[buildingType].lpcd}`} min={5} max={500} />
              </Field>

              <div style={{ background: `${C.hydroBlue}07`, border: `1px solid ${C.hydroBlue}15`, borderRadius: "10px", padding: "0.9rem", marginTop: "auto" }}>
                <div style={{ fontSize: "0.58rem", color: C.aquiferTeal, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.6rem", fontWeight: 700 }}>Block Summary</div>
                {[
                  ["Total Roof Area", `${totalArea.toFixed(0)} m²`, C.hydroBlue],
                  ["Weighted Coeff C", weightedC.toFixed(3), C.rechargeGreen],
                  ["Annual Runoff", `${annualRunoff.toFixed(1)} m³`, C.rainfallBlue],
                  ["Annual Demand", `${annualDemand.toFixed(0)} m³`, C.soilAmber],
                ].map(([k, v, col]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", padding: "0.22rem 0", borderBottom: `1px solid ${C.concreteGrey}` }}>
                    <span style={{ color: C.structGrey }}>{k}</span>
                    <strong style={{ color: col }}>{v}</strong>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <>
              <SectionTitle>Subsurface Conditions</SectionTitle>

              <Field label="Soil Type" note="Determines percolation rate and recharge structure type">
                <StyledSelect value={soilType} onChange={setSoilType} options={Object.keys(SOIL_PERMEABILITY)} />
              </Field>

              <div style={{
                background: `${SOIL_PERMEABILITY[soilType].color}10`,
                border: `1px solid ${SOIL_PERMEABILITY[soilType].color}40`,
                borderRadius: "10px", padding: "0.85rem", marginBottom: "1.2rem",
              }}>
                <div style={{ fontSize: "0.58rem", color: C.structGrey, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Hydraulic Conductivity</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: SOIL_PERMEABILITY[soilType].color }} />
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "1.1rem", color: SOIL_PERMEABILITY[soilType].color }}>{SOIL_PERMEABILITY[soilType].label}</span>
                  <span style={{ color: C.structGrey, fontSize: "0.7rem", marginLeft: "auto" }}>k = {SOIL_PERMEABILITY[soilType].k} mm/hr</span>
                </div>
                <ProgressBar value={Math.log10(SOIL_PERMEABILITY[soilType].k + 0.1) + 2} max={4} color={SOIL_PERMEABILITY[soilType].color} />
              </div>

              <div style={{ background: "#f8fafc", border: `1px solid ${C.concreteGrey}`, borderRadius: "10px", padding: "0.9rem", marginBottom: "1.2rem" }}>
                <div style={{ fontSize: "0.58rem", color: C.structGrey, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.7rem", fontWeight: 600 }}>Decision Matrix · CGWB</div>
                {[
                  ["GW Depth < 5m",  "Recharge Shaft",   C.monsoonBlue],
                  ["Clay / k < 0.1", "Storage Only",     C.overflowRed],
                  ["Slope > 10%",    "Recharge Trench",  C.soilAmber],
                  ["Score ≥ 70",     "Pit + Storage",    C.rechargeGreen],
                  ["Score 40–70",    "Recharge Pit",     C.aquiferTeal],
                  ["Score < 40",     "Storage Tank",     C.structGrey],
                ].map(([cond, res, col]) => (
                  <div key={cond} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.28rem 0", borderBottom: `1px solid ${C.concreteGrey}` }}>
                    <span style={{ fontSize: "0.63rem", color: C.structGrey }}>{cond}</span>
                    <span style={{ fontSize: "0.63rem", color: col, fontWeight: 600 }}>→ {res}</span>
                  </div>
                ))}
              </div>

              <div style={{ background: `${C.hydroBlue}07`, border: `1px dashed ${C.hydroBlue}30`, borderRadius: "10px", padding: "0.85rem", marginTop: "auto" }}>
                <div style={{ fontSize: "0.58rem", color: C.aquiferTeal, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem", fontWeight: 700 }}>Engine Equations</div>
                <div style={{ fontSize: "0.67rem", color: C.graphite, lineHeight: 2, fontFamily: "'IBM Plex Mono'" }}>
                  Q = P × A × C × (1−FF) / 1000<br />
                  S_t = min(max(S_(t-1)+Q_t−D_t, 0), Cap)<br />
                  WSE = Σmet / Σdemand × 100<br />
                  V_dry = t × n × q × 0.4<br />
                  Q_peak = C × I × A / 36
                </div>
              </div>
            </>
          )}

          {/* STEP 4 — Summary */}
          {step === 4 && (
            <>
              <SectionTitle
                action={
                  <button onClick={handleCopyReport} style={{
                    background: `${C.hydroBlue}10`, border: `1px solid ${C.hydroBlue}30`,
                    borderRadius: "6px", padding: "0.2rem 0.6rem",
                    color: C.hydroBlue, fontSize: "0.58rem", cursor: "pointer",
                    fontFamily: "'IBM Plex Mono'", fontWeight: 600, letterSpacing: "0.05em",
                    transition: "background 0.15s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = `${C.hydroBlue}18`}
                    onMouseLeave={e => e.currentTarget.style.background = `${C.hydroBlue}10`}
                  >Copy Report</button>
                }
              >Assessment Summary</SectionTitle>

              <div style={{ fontSize: "0.67rem", color: C.structGrey, lineHeight: 1.8 }}>
                {[
                  ["District", district, C.hydroBlue],
                  ["Annual Rainfall", `${rainfallNum} mm`, C.rainfallBlue],
                  ["Total Roof Area", `${totalArea.toFixed(0)} m²`, C.aquiferTeal],
                  ["Roof Blocks", roofBlocks.length, C.graphite],
                  ["Weighted Coeff C", weightedC.toFixed(3), C.rechargeGreen],
                  ["First-Flush Loss", `${firstFlushPct}%`, C.structGrey],
                  ["Annual Runoff", `${annualRunoff.toFixed(1)} m³/yr`, C.rainfallBlue],
                  ["Recommended Tank", `${tankSize} m³`, C.monsoonBlue],
                  ["Tank (Ratio Method)", `${tankSizeRatio} m³`, C.structGrey],
                  ["Tank (Dry-Period)", `${tankSizeDryPd} m³`, C.structGrey],
                  ["Daily Demand", `${(dailyDemand * 1000).toFixed(0)} L/day`, C.soilAmber],
                  ["WSE", `${wse}%`, wseColor],
                  ["Reliability", `${reliability}%`, C.wseViolet],
                  ["Peak Flow", `${(peakFlow * 1000).toFixed(2)} L/s`, C.structGrey],
                  ["Pipe Diameter", `${pipeDiameter} mm PVC`, C.structGrey],
                  ["Recharge System", rRec.type, C.aquiferTeal],
                  ["GW Depth", `${gwDepth} m BGL`, C.hydroBlue],
                  ["Soil Type", soilType, C.graphite],
                  ["Recharge Score", `${rScore}/100`, rScore >= 70 ? C.rechargeGreen : rScore >= 40 ? C.soilAmber : C.overflowRed],
                ].map(([k, v, col]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.26rem 0", borderBottom: `1px solid ${C.concreteGrey}` }}>
                    <span style={{ color: C.structGrey, flexShrink: 0, marginRight: "0.5rem" }}>{k}</span>
                    <span style={{ color: col || C.graphite, fontWeight: 500, textAlign: "right" }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "1rem", padding: "0.8rem", background: `${C.hydroBlue}08`, border: `1px solid ${C.hydroBlue}18`, borderRadius: "8px", borderLeft: `3px solid ${C.hydroBlue}`, fontSize: "0.6rem", color: C.structGrey, lineHeight: 1.75 }}>
                <strong style={{ color: C.hydroBlue }}>References: </strong>
                IS:15797:2008 · CGWB · Patil 2023 · Akhtar 2023 · Villar-Navascués 2020 · Meenakshi 2022 · Chowdhury & Akter 2026 · Kiran & Kumar 2023 · Hari 2019 · Singh & Turkiya 2017 · Jadhav et al. 2024 · GoI Ch.6
              </div>
            </>
          )}

          {/* NAVIGATION */}
          <div style={{ marginTop: "1.4rem", display: "flex", gap: "0.6rem" }}>
            {step > 1 && (
              <button className="nav-btn" onClick={() => setStep(s => Math.max(s - 1, 1))} style={{
                flex: 1, padding: "0.7rem",
                background: C.pureWhite, border: `1.5px solid ${C.concreteGrey}`,
                borderRadius: "8px", color: C.structGrey,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem",
                cursor: "pointer", fontWeight: 500,
              }}>← Back</button>
            )}
            <button className="nav-btn" onClick={() => setStep(s => Math.min(s + 1, 4))} style={{
              flex: 2, padding: "0.7rem",
              background: step === 4 ? C.rechargeGreen : `linear-gradient(135deg, ${C.hydroBlue}, ${C.monsoonBlue})`,
              border: "none", borderRadius: "8px", color: "#fff",
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem",
              cursor: "pointer", fontWeight: 600, letterSpacing: "0.04em",
              boxShadow: `0 2px 8px ${step === 4 ? C.rechargeGreen : C.hydroBlue}40`,
            }}>
              {step < 4 ? `Next: ${steps[step]} →` : "✓ Complete"}
            </button>
          </div>
        </div>

        {/* ── RIGHT PANEL — RESULTS ── */}
        <div className="right-panel" style={{ flex: 1, padding: "1.5rem", overflowY: "auto", background: C.mistWhite, minWidth: 0 }}>

          {/* ROW 1: Core Metrics */}
          <div className="metrics-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.85rem", marginBottom: "0.9rem" }}>
            <MetricCard label="Annual Runoff Yield" icon="🌧️"
              value={annualRunoff.toFixed(0)} unit="m³ / year"
              color={C.hydroBlue}
              sub={`${(annualRunoff * 1000).toFixed(0)} L · FF=${firstFlushPct}%`}
              badge="IS:15797"
            />
            <MetricCard label="Annual Water Demand" icon="🏠"
              value={annualDemand.toFixed(0)} unit="m³ / year"
              color={C.soilAmber}
              sub={`${(dailyDemand * 1000).toFixed(0)} L/day · ${lpcd} lpcd`}
            />
            <MetricCard label="Water Saving Efficiency" icon="📊"
              value={`${wse}%`} unit="WSE — demand met"
              color={wseColor}
              sub={`Reliability: ${reliability}%`}
              badge="Chowdhury 2026"
            />
            <MetricCard label="Non-Potable Coverage" icon="🚿"
              value={`${nonPotableWsePct}%`} unit="of non-potable demand"
              color={C.wseViolet}
              sub={`${(nonPotablePct * 100).toFixed(0)}% of demand non-potable`}
              badge="Kiran 2023"
            />
          </div>

          {/* ROW 2: Design Outputs */}
          <div className="metrics-grid-4-sm" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.85rem", marginBottom: "1.2rem" }}>
            <MetricCard label="Recommended Tank" icon="🛢️"
              value={tankSize} unit="m³ capacity"
              color={C.monsoonBlue}
              sub={`Ratio: ${tankSizeRatio}m³ · Dry-pd: ${tankSizeDryPd}m³`}
              badge="Dual Method"
            />
            <MetricCard label="Total Roof Catchment" icon="🏗️"
              value={totalArea.toFixed(0)} unit="m² across all blocks"
              color={C.aquiferTeal}
              sub={`${roofBlocks.length} block(s) · Wtd C = ${weightedC.toFixed(3)}`}
            />
            <MetricCard label="Recommended Pipe" icon="🔧"
              value={`${pipeDiameter}mm`} unit="PVC downpipe"
              color={C.structGrey}
              sub={`Peak Q = ${(peakFlow * 1000).toFixed(2)} L/s · n=0.01`}
              badge="Kiran 2023"
            />
            <MetricCard label="Groundwater Depth" icon="⛏️"
              value={`${gwDepth}m`} unit="below ground level"
              color={C.structGrey}
              sub={`${gwInfo.aquifer} · ${gwInfo.recharge}`}
            />
          </div>

          {/* EFFICIENCY OVERVIEW */}
          <div style={{ background: C.pureWhite, border: `1px solid ${C.concreteGrey}`, borderRadius: "12px", padding: "1.2rem 1.3rem", marginBottom: "1.2rem", boxShadow: "0 1px 4px rgba(15,76,129,0.06)" }}>
            <SectionTitle>System Efficiency Overview</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem" }}>
              {[
                ["WSE", wse, 100, wseColor, "Water Saving Efficiency"],
                ["Reliability", reliability, 100, C.wseViolet, "Days demand fully met"],
                ["Coverage", parseFloat(coveragePct), 100, C.rainfallBlue, "Annual runoff vs demand"],
                ["Non-Potable", parseFloat(nonPotableWsePct), 100, C.aquiferTeal, "Non-potable demand met"],
              ].map(([key, val, max, col, desc]) => (
                <div key={key}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.63rem", color: C.structGrey, fontFamily: "'IBM Plex Mono'" }}>{key}</span>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: col, fontFamily: "'Barlow Condensed'" }}>{val}%</span>
                  </div>
                  <div style={{ background: `${col}15`, borderRadius: "100px", height: "6px", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: "100px", background: col, width: `${Math.min(val, 100)}%`, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
                  </div>
                  <div style={{ fontSize: "0.58rem", color: "#94a3b8", marginTop: "0.3rem", fontFamily: "'IBM Plex Mono'" }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* TANK SIZING COMPARISON */}
          <div className="tank-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.85rem", marginBottom: "1.2rem" }}>
            {[
              { label: "Ratio Method", value: `${tankSizeRatio} m³`, color: C.monsoonBlue, sub: `Supply ratio: ${supplyRatio.toFixed(2)} · Akhtar 2023`, highlight: false },
              { label: "Dry-Period Method", value: `${tankSizeDryPd} m³`, color: C.aquiferTeal, sub: `V = t×n×q×0.4 · ${dryMonths} dry months · GoI Ch.6`, highlight: false },
              { label: "✓ Recommended (Max)", value: `${tankSize} m³`, color: C.rechargeGreen, sub: "Conservative — takes larger of two estimates", highlight: true },
            ].map(({ label, value, color, sub, highlight }) => (
              <div key={label} style={{
                background: highlight ? `${color}08` : C.pureWhite,
                border: `${highlight ? "2px" : "1px"} solid ${color}${highlight ? "40" : "20"}`,
                borderRadius: "12px", padding: "1rem 1.1rem",
                boxShadow: highlight ? `0 2px 12px ${color}20` : "none",
              }}>
                <div style={{ fontSize: "0.6rem", color: highlight ? color : C.structGrey, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem", fontWeight: highlight ? 700 : 400 }}>{label}</div>
                <div style={{ fontSize: "1.7rem", fontFamily: "'Barlow Condensed'", fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: "0.62rem", color: C.structGrey, marginTop: "0.25rem", lineHeight: 1.5 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* RECHARGE PANEL */}
          <div style={{ background: C.pureWhite, border: `1px solid ${C.concreteGrey}`, borderRadius: "12px", padding: "1.2rem 1.3rem", marginBottom: "1.2rem", boxShadow: "0 1px 4px rgba(15,76,129,0.06)" }}>
            <SectionTitle>Recharge System Recommendation · CGWB</SectionTitle>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "2rem", flexWrap: "wrap" }}>
              <ScoreMeter score={rScore} />
              <div style={{ flex: 1, minWidth: "200px", borderLeft: `2px solid ${C.concreteGrey}`, paddingLeft: "1.5rem" }}>
                <div style={{ fontSize: "0.58rem", color: C.structGrey, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.35rem" }}>Recommended Structure</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "1.35rem", color: C.hydroBlue }}>{rRec.type}</div>
                <div style={{ fontSize: "0.7rem", color: C.structGrey, marginTop: "0.3rem", lineHeight: 1.6 }}>{rRec.reason}</div>
                <PriorityBadge priority={rRec.priority} />
              </div>
            </div>
          </div>

          {/* MONTHLY RUNOFF CHART */}
          <div style={{ background: C.pureWhite, border: `1px solid ${C.concreteGrey}`, borderRadius: "12px", padding: "1.2rem 1.3rem", marginBottom: "1.2rem", boxShadow: "0 1px 4px rgba(15,76,129,0.06)" }}>
            <SectionTitle>Monthly Runoff Yield — After First-Flush Deduction (m³)</SectionTitle>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={monthlyRunoff} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.concreteGrey} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: C.structGrey, fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.structGrey, fontSize: 9, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="runoff" name="Runoff" radius={[4, 4, 0, 0]}>
                  {monthlyRunoff.map((entry, index) => (
                    <Cell key={index} fill={entry.runoff > (annualRunoff / 12) * 1.5 ? C.monsoonBlue : entry.runoff > 0 ? C.rainfallBlue : C.concreteGrey} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* WATER BALANCE CHART */}
          <div style={{ background: C.pureWhite, border: `1px solid ${C.concreteGrey}`, borderRadius: "12px", padding: "1.2rem 1.3rem", marginBottom: "1.2rem", boxShadow: "0 1px 4px rgba(15,76,129,0.06)" }}>
            <SectionTitle>Monthly Water Balance — WSE Model (m³) · Chowdhury & Akter 2026</SectionTitle>
            <ResponsiveContainer width="100%" height={175}>
              <LineChart data={waterBalance} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.concreteGrey} />
                <XAxis dataKey="month" tick={{ fill: C.structGrey, fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.structGrey, fontSize: 9, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke={C.concreteGrey} />
                <Line type="monotone" dataKey="inflow"  name="Inflow"  stroke={C.rainfallBlue}  strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="demand"  name="Demand"  stroke={C.soilAmber}      strokeWidth={2}   dot={false} strokeDasharray="5 3" />
                <Line type="monotone" dataKey="storage" name="Storage" stroke={C.rechargeGreen}  strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="deficit" name="Deficit" stroke={C.overflowRed}    strokeWidth={2}   dot={false} strokeDasharray="3 2" />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: "1.4rem", marginTop: "0.7rem", paddingTop: "0.65rem", borderTop: `1px solid ${C.concreteGrey}`, flexWrap: "wrap" }}>
              {[["Inflow", C.rainfallBlue], ["Demand", C.soilAmber], ["Storage", C.rechargeGreen], ["Deficit", C.overflowRed]].map(([l, c]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.63rem", color: C.structGrey, fontFamily: "'IBM Plex Mono', monospace" }}>
                  <div style={{ width: "18px", height: "3px", background: c, borderRadius: "2px" }} />{l}
                </div>
              ))}
            </div>
          </div>

          {/* FINAL RECOMMENDATION */}
          <div style={{ background: C.pureWhite, border: `1px solid ${C.concreteGrey}`, borderRadius: "12px", padding: "1.2rem 1.3rem", boxShadow: "0 1px 4px rgba(15,76,129,0.06)" }}>
            <SectionTitle>Engineering Design Recommendation</SectionTitle>
            <div style={{ padding: "1.1rem 1.2rem", background: `${C.hydroBlue}06`, border: `1px solid ${C.hydroBlue}18`, borderRadius: "10px", borderLeft: `4px solid ${C.hydroBlue}` }}>
              <div style={{ fontSize: "0.78rem", color: C.graphite, lineHeight: 2 }}>
                <strong style={{ color: C.hydroBlue }}>Storage: </strong>
                Install a <strong style={{ color: C.hydroBlue }}>{tankSize} m³</strong> ({(tankSize * 1000).toFixed(0)} L) RCC/ferro-cement tank with first-flush diverter ({firstFlushPct}% discarded) and dual-media sand-gravel filtration (IS 3370).
                {" "}<strong style={{ color: C.monsoonBlue }}>{pipeDiameter}mm</strong> PVC downpipes at min 1:110 gradient (Manning n=0.01).
              </div>
              <div style={{ fontSize: "0.78rem", color: C.graphite, lineHeight: 2, marginTop: "0.5rem" }}>
                {rRec.type !== "Storage Tank Only" && rRec.type !== "Storage Tank" && (
                  <><strong style={{ color: C.aquiferTeal }}>Recharge: </strong>Construct a <strong style={{ color: C.aquiferTeal }}>{rRec.type}</strong> per CGWB guidelines. {rRec.reason}.<br /></>
                )}
                <strong style={{ color: wseColor }}>WSE: {wse}%</strong> of annual demand met ·{" "}
                <strong style={{ color: C.wseViolet }}>Reliability: {reliability}%</strong> of days ·{" "}
                Non-potable coverage: <strong>{nonPotableWsePct}%</strong>.
                {" "}System serves <strong>{populationNum}</strong> {buildingType.toLowerCase()} occupants from <strong>{totalArea.toFixed(0)} m²</strong> catchment across <strong>{roofBlocks.length}</strong> roof block(s).
              </div>
            </div>
            <div style={{ marginTop: "0.9rem", fontSize: "0.59rem", color: "#94a3b8", lineHeight: 1.75, fontStyle: "italic" }}>
              IS:15797:2008 · CGWB Aquifer Reports · Patil 2023 · Akhtar 2023 · Villar-Navascués 2020 · Meenakshi 2022 · Chowdhury & Akter 2026 (WSE/Reliability) · Kiran & Kumar 2023 (Pipe sizing) · Hari 2019 (Multi-block) · Singh & Turkiya 2017 (Runoff coefficients) · Jadhav et al. 2024 (Dry-period) · GoI Water Harvesting Manual Ch.6
            </div>
          </div>

        </div>{/* end right panel */}
      </div>{/* end body */}

      {toast && <Toast message={toast} />}
    </div>
  );
}
