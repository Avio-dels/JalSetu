import { useState, useEffect, useCallback, useRef, memo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, CartesianGrid,
} from "recharts";

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  // Primary brand
  hydroBlue:    "#0F4C81",
  hydroBlueLight: "#1E6BB8",
  hydroBluePale:  "#E8F2FA",
  monsoonBlue:  "#1565C0",
  rainfallBlue: "#42A5F5",
  aquiferTeal:  "#00A6A6",
  aquiferTealLight: "#26C6C6",
  aquiferTealPale: "#E0F7F7",
  
  // Neutral
  mistWhite:    "#F0F5FA",
  pureWhite:    "#FFFFFF",
  concreteGrey: "#CBD5E1",
  panelGrey:    "#F4F7FB",
  structGrey:   "#64748B",
  graphite:     "#1E293B",
  darkSlate:    "#0F172A",
  
  // Semantic
  rechargeGreen:"#2E7D32",
  rechargeGreenPale: "#E8F5E9",
  soilAmber:    "#D97706",
  soilAmberPale: "#FFF8E1",
  overflowRed:  "#C62828",
  overflowRedPale: "#FBE9E7",
  wseViolet:    "#6D28D9",
  wseVioletPale: "#F3E8FF",
  lightBorder:  "#E2E8F0",
  deepBlue:     "#0A3560",
  
  // Status
  success: "#2E7D32",
  warning: "#D97706",
  error: "#C62828",
  info: "#0F4C81",
  
  // Shadows
  shadowSm: "0 1px 2px rgba(15,76,129,0.05)",
  shadowMd: "0 4px 12px rgba(15,76,129,0.08)",
  shadowLg: "0 8px 24px rgba(15,76,129,0.12)",
  shadowFocus: "0 0 0 3px rgba(66,165,245,0.25)",
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const RUNOFF_COEFFICIENTS = {
  "RCC / Concrete (Inclined)": { C: 0.90, source: "IS:15797 / Patil 2023" },
  "Metal Sheet / GI":          { C: 0.90, source: "Akhtar 2023" },
  "Asbestos / AC Sheet":       { C: 0.85, source: "Hari 2019" },
  "Mangalore / Clay Tile":     { C: 0.85, source: "Meenakshi 2022" },
  "RCC / Concrete (Flat)":     { C: 0.80, source: "IS:15797" },
  "Asphalt Sheet":             { C: 0.70, source: "Villar-Navascués 2020" },
  "Gravel Roof":               { C: 0.62, source: "Farreny et al. 2011" },
  "Thatch / Non-cemented":     { C: 0.50, source: "Singh & Turkiya 2017" },
};

const BUILDING_TYPES = {
  "Residential":      { lpcd: 135, nonPotablePct: 0.40 },
  "School / College": { lpcd: 45,  nonPotablePct: 0.60 },
  "Hostel":           { lpcd: 90,  nonPotablePct: 0.45 },
  "Office":           { lpcd: 55,  nonPotablePct: 0.55 },
  "Hospital":         { lpcd: 340, nonPotablePct: 0.30 },
  "Industry":         { lpcd: 30,  nonPotablePct: 0.80 },
};

const MONTHLY_DIST = [
  { month: "Jan", share: 0.012 }, { month: "Feb", share: 0.008 },
  { month: "Mar", share: 0.005 }, { month: "Apr", share: 0.003 },
  { month: "May", share: 0.010 }, { month: "Jun", share: 0.095 },
  { month: "Jul", share: 0.230 }, { month: "Aug", share: 0.260 },
  { month: "Sep", share: 0.210 }, { month: "Oct", share: 0.120 },
  { month: "Nov", share: 0.030 }, { month: "Dec", share: 0.017 },
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
  "Custom":     { depth: null, aquifer: "Unknown", recharge: "Unknown" },
};

const SOIL_DATA = {
  "Black Cotton Soil":  { k: 0.05, label: "Very Low",  color: "#7B1FA2" },
  "Clay (Low)":         { k: 0.01, label: "Low",        color: C.overflowRed },
  "Clay-Loam (Medium)": { k: 0.50, label: "Medium",     color: C.soilAmber },
  "Laterite":           { k: 1.00, label: "Medium",     color: C.soilAmber },
  "Loam (Medium-High)": { k: 2.00, label: "Med-High",   color: "#558B2F" },
  "Sandy-Loam (High)":  { k: 5.00, label: "High",       color: C.rechargeGreen },
  "Sandy (Very High)":  { k: 15.0, label: "Very High",  color: C.aquiferTeal },
};

// ─── CALCULATION ENGINE ───────────────────────────────────────────────────────
function calcMultiBlockRunoff(blocks, rain, ffFactor) {
  return blocks.reduce((sum, b) => {
    const area  = Math.max((parseFloat(b.length) || 0) * (parseFloat(b.width) || 0), 0);
    const coeff = RUNOFF_COEFFICIENTS[b.roofType]?.C || 0.80;
    return sum + (rain * area * coeff * (1 - ffFactor)) / 1000;
  }, 0);
}

function calcMonthlyRunoff(rain, area, coeff, ffFactor) {
  const rows = MONTHLY_DIST.map(({ month, share }) => {
    const monthRain = rain * share;
    const rawRunoff = monthRain * area * coeff / 1000;
    const ff = share > 0.02 ? ffFactor : 0;
    return { month, rainfall: +monthRain.toFixed(1), runoff: +(rawRunoff * (1 - ff)).toFixed(3) };
  });
  const annualRunoff = rain * area * coeff * (1 - ffFactor) / 1000;
  const sumFirst11 = rows.slice(0, 11).reduce((s, r) => s + r.runoff, 0);
  rows[11].runoff = +Math.max(annualRunoff - sumFirst11, 0).toFixed(3);
  return rows;
}

function calcWaterBalance(monthlyRunoff, dailyDemand, tankCap) {
  let storage = 0;
  return monthlyRunoff.map(({ month, runoff }) => {
    const demand    = +(dailyDemand * 30.44).toFixed(3);
    const available = storage + runoff;
    const met       = +Math.min(demand, available).toFixed(3);
    const deficit   = +Math.max(demand - available, 0).toFixed(3);
    storage         = +Math.min(Math.max(available - demand, 0), tankCap).toFixed(3);
    return { month, inflow: +runoff.toFixed(2), demand: +demand.toFixed(2), storage, deficit, met };
  });
}

function calcWSE(wb) {
  const totalMet    = wb.reduce((s, m) => s + m.met, 0);
  const totalDemand = wb.reduce((s, m) => s + m.demand, 0);
  return totalDemand > 0 ? +((totalMet / totalDemand) * 100).toFixed(1) : 0;
}

function calcReliability(wb) {
  const daysMet = wb.reduce((s, m) =>
    s + (m.deficit === 0 ? 30.44 : (m.met / (m.demand || 1)) * 30.44), 0);
  return +Math.min((daysMet / 365) * 100, 100).toFixed(1);
}

function calcRatioTank(annualRunoff, annualDemand) {
  if (!annualDemand || annualDemand <= 0) return Math.max(Math.round(annualRunoff * 0.3 / 5) * 5, 5);
  const r = annualRunoff / annualDemand;
  let s;
  if (r >= 2)        s = Math.round(annualDemand * 0.15 / 5) * 5;
  else if (r >= 1)   s = Math.round(annualDemand * 0.25 / 5) * 5;
  else if (r >= 0.5) s = Math.round(annualRunoff * 0.30 / 5) * 5;
  else               s = Math.round(annualRunoff * 0.50 / 5) * 5;
  return Math.max(s, 5);
}

function calcDryPeriodTank(pop, lpcd, dryMonths) {
  return Math.max(Math.round((dryMonths * 30.44 * pop * lpcd * 0.001 * 0.4) / 5) * 5, 5);
}

function calcPeakFlow(area, coeff, rain) {
  const I_hr = (rain * 0.260) / 30;
  return +(coeff * I_hr * (area / 10000) / 36).toFixed(5);
}

function calcPipeDia(peakFlow_m3s) {
  const n = 0.010;
  for (const d of [75, 100, 110, 150, 200, 250]) {
    const R = (d / 1000) / 4;
    const V = (1 / n) * Math.pow(R, 2/3) * Math.pow(0.01, 0.5);
    const Q = (Math.PI / 4) * Math.pow(d / 1000, 2) * V * 0.5;
    if (Q >= peakFlow_m3s) return d;
  }
  return 250;
}

function calcRechargeScore(gwDepth, soilKey, slope, rain) {
  let s = 0;
  if (gwDepth > 20) s += 30; else if (gwDepth > 10) s += 20; else if (gwDepth > 5) s += 10; else s += 5;
  const k = SOIL_DATA[soilKey]?.k || 1;
  if (k > 5) s += 30; else if (k > 1) s += 20; else if (k > 0.1) s += 10; else s += 3;
  if (rain > 800) s += 25; else if (rain > 500) s += 15; else s += 5;
  if (slope < 2) s += 15; else if (slope < 5) s += 10; else if (slope < 10) s += 5;
  return Math.min(s, 100);
}

function calcRechargeRec(score, gwDepth, soilKey, slope) {
  const k = SOIL_DATA[soilKey]?.k || 1;
  if (gwDepth < 5)  return { type: "Recharge Shaft",         priority: "HIGH",    reason: "Shallow water table — shaft recharge most effective", dim: "Dia: 0.5m, Depth: 3–5m, Gravel fill: 2m" };
  if (k < 0.1)      return { type: "Storage Tank Only",      priority: "STORAGE", reason: "Very low permeability — recharge not viable",          dim: "No recharge structure required" };
  if (slope > 10)   return { type: "Recharge Trench",        priority: "MEDIUM",  reason: "High slope — trench along contour captures runoff",     dim: "Width: 0.6m, Depth: 1m, Length: 3–5m" };
  if (score >= 70)  return { type: "Recharge Pit + Storage", priority: "HIGH",    reason: "Excellent — dual system maximises groundwater recharge", dim: "Pit: 1.5×1.5×2m deep, Gravel fill: 1.2m" };
  if (score >= 40)  return { type: "Recharge Pit",           priority: "MEDIUM",  reason: "Moderate suitability — pit recharge recommended",       dim: "1×1×1.5m deep, Gravel fill: 1m" };
  return              { type: "Storage Tank",                priority: "STORAGE", reason: "Poor recharge conditions — prioritise storage",          dim: "No recharge structure recommended" };
}

function calcDesignParams(totalArea, tankSize, weightedC, rain) {
  const firstFlushVol = +(totalArea / 40).toFixed(1);
  const x = Math.cbrt(Math.max(tankSize, 1) / 3);
  const tankL = +(2 * x).toFixed(1), tankB = +(x).toFixed(1), tankD = +(1.5 * x).toFixed(1);
  const filterArea = +(Math.max(totalArea / 50, 0.5)).toFixed(2);
  const filterDia  = +(Math.sqrt(filterArea / Math.PI) * 2).toFixed(2);
  const peakFlow   = calcPeakFlow(totalArea, weightedC, rain);
  const pipeDia    = calcPipeDia(peakFlow);
  const R          = (pipeDia / 1000) / 4;
  const velocity   = +((1 / 0.010) * Math.pow(R, 2/3) * Math.pow(0.01, 0.5)).toFixed(2);
  return { firstFlushVol, tankL, tankB, tankD, filterArea, filterDia, peakFlow, pipeDia, velocity };
}

// ─── SHARED STYLES (module-level, stable references) ─────────────────────────
const inputStyle = {
  width: "100%", boxSizing: "border-box", background: C.pureWhite,
  border: `1.5px solid ${C.concreteGrey}`, borderRadius: "10px", color: C.graphite,
  padding: "0.75rem 1rem", fontSize: "1rem", fontFamily: "'IBM Plex Mono', monospace",
  outline: "none", transition: "all 0.15s ease", lineHeight: "1.5",
  WebkitAppearance: "none", MozAppearance: "none",
};
const inputStyleError = { ...inputStyle, borderColor: C.overflowRed, background: C.overflowRedPale };
const inputStyleSuccess = { ...inputStyle, borderColor: C.rechargeGreen };

const selectStyle = {
  ...inputStyle, cursor: "pointer", appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748B' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center", paddingRight: "3rem",
};

const labelStyle = {
  display: "block", fontSize: "0.7rem", letterSpacing: "0.08em",
  color: C.structGrey, marginBottom: "0.5rem", textTransform: "uppercase", fontWeight: 600,
};

const fieldWrap = { marginBottom: "1.25rem" };

const noteStyle = { fontSize: "0.68rem", color: "#94a3b8", marginTop: "0.35rem", lineHeight: 1.5 };

// Card styles
const cardStyle = {
  background: C.pureWhite,
  border: `1px solid ${C.lightBorder}`,
  borderRadius: "12px",
  padding: "1.25rem",
  boxShadow: C.shadowSm,
  transition: "box-shadow 0.2s ease, border-color 0.2s ease",
};

const cardStyleHover = { ...cardStyle, boxShadow: C.shadowMd, borderColor: C.hydroBlue + "40" };

// Button styles
const btnPrimary = {
  padding: "0.75rem 1.25rem", background: C.hydroBlue, border: "none", borderRadius: "10px",
  color: "#fff", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.85rem",
  cursor: "pointer", fontWeight: 700, transition: "all 0.15s ease",
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
};

const btnSecondary = {
  ...btnPrimary, background: C.pureWhite, border: `1.5px solid ${C.lightBorder}`, color: C.structGrey,
};

const btnGhost = {
  ...btnPrimary, background: "transparent", border: "none", color: C.structGrey, padding: "0.5rem 0.75rem",
};

const btnDanger = {
  ...btnPrimary, background: C.overflowRedPale, border: `1px solid ${C.overflowRed}30`, color: C.overflowRed,
};

// InfoTooltip component (no style-jsx, pure inline styles)
function InfoTooltip({ children, content, position = "top" }) {
  const [visible, setVisible] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div style={{
          position: "absolute",
          [position === "top" ? "bottom" : "top"]: "calc(100% + 8px)",
          left: "50%", transform: "translateX(-50%)",
          background: C.darkSlate, color: "#fff", fontSize: "0.7rem",
          padding: "0.5rem 0.75rem", borderRadius: "6px", whiteSpace: "nowrap",
          zIndex: 100, boxShadow: C.shadowLg, fontWeight: 400,
          fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.4,
          pointerEvents: "none",
        }}>
          {content}
        </div>
      )}
    </span>
  );
}

// ─── STABLE PRIMITIVE ATOMS — defined at module level so identity never changes ──

// The KEY insight: this component manages its own string state completely.
// Parent only receives updates via onCommit when user finishes or types a valid number.
// No syncing back from parent → no re-mount → keyboard stays open.
const StableInput = memo(function StableInput({ 
  initialValue, onCommit, suffix, placeholder, 
  min, max, step, error, success, disabled, onFocus, onBlur,
  autoSelect = true 
}) {
  const [val, setVal] = useState(String(initialValue ?? ""));
  const [touched, setTouched] = useState(false);
  const inputRef = useRef(null);
  const [localError, setLocalError] = useState(null);

  const validate = useCallback((value) => {
    if (value === "" || value === "-") return null;
    const n = parseFloat(value);
    if (isNaN(n)) return "Enter a valid number";
    if (min !== undefined && n < min) return `Minimum value is ${min}`;
    if (max !== undefined && n > max) return `Maximum value is ${max}`;
    return null;
  }, [min, max]);

  const onChange = useCallback((e) => {
    const raw = e.target.value;
    setVal(raw);
    if (!touched) setTouched(true);
    
    const err = validate(raw);
    setLocalError(err);
    
    // propagate numeric immediately so live preview updates
    const n = parseFloat(raw);
    if (!isNaN(n) && !err) onCommit(n);
  }, [onCommit, touched, validate]);

  const handleBlur = useCallback((e) => {
    const raw = e.target.value;
    const n = parseFloat(raw);
    const err = validate(raw);
    setLocalError(err);
    setTouched(true);
    
    if (err || isNaN(n)) {
      setVal(String(initialValue ?? ""));
      onCommit(parseFloat(initialValue) || 0);
    } else if (onBlur) {
      onBlur(n);
    }
  }, [initialValue, onCommit, onBlur, validate]);

  const handleFocus = useCallback((e) => {
    if (autoSelect) e.target.select();
    if (onFocus) onFocus();
  }, [autoSelect, onFocus]);

  const hasError = !!(error || localError);
  const hasSuccess = !!(success) && !localError;
  const style = hasError
    ? { ...inputStyle, borderColor: C.overflowRed }
    : hasSuccess
      ? { ...inputStyle, borderColor: C.rechargeGreen }
      : inputStyle;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={val}
        onChange={onChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        style={{ 
          ...style, 
          paddingRight: suffix ? "3rem" : style.paddingRight,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "text",
        }}
        aria-invalid={!!(error || localError)}
        aria-describedby={error || localError ? "input-error" : undefined}
      />
      {(error || localError) && (
        <div id="input-error" style={{ 
          fontSize: "0.65rem", color: C.overflowRed, marginTop: "0.35rem", 
          display: "flex", alignItems: "center", gap: "0.3rem" 
        }}>
          <span style={{ fontSize: "0.7rem" }}>⚠</span> {error || localError}
        </div>
      )}
      {suffix && !disabled && (
        <span style={{
          position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)",
          fontSize: "0.75rem", color: C.structGrey, pointerEvents: "none",
        }}>{suffix}</span>
      )}
    </div>
  );
});

// Generic select atom
const StableSelect = memo(function StableSelect({ value, onChange, options, disabled, error }) {
  return (
    <select 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      style={{ ...selectStyle, borderColor: error ? C.overflowRed : undefined, opacity: disabled ? 0.6 : 1 }}
      disabled={disabled}
      onFocus={e => { e.target.style.borderColor = C.hydroBlue; }}
      onBlur={e => { e.target.style.borderColor = error ? C.overflowRed : C.concreteGrey; }}
      aria-invalid={!!error}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
});

// ─── ROOF BLOCK — fully isolated, stable, defined at module level ─────────────
const RoofBlockRow = memo(function RoofBlockRow({ blockId, initialLength, initialWidth, initialRoofType, onUpdate, onRemove, canRemove, index }) {
  const [length, setLength] = useState(String(initialLength ?? ""));
  const [width,  setWidth]  = useState(String(initialWidth  ?? ""));
  const [hovered, setHovered] = useState(false);

  const onLenChange = useCallback((e) => {
    const raw = e.target.value;
    setLength(raw);
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) onUpdate(blockId, "length", n);
  }, [blockId, onUpdate]);

  const onWidChange = useCallback((e) => {
    const raw = e.target.value;
    setWidth(raw);
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) onUpdate(blockId, "width", n);
  }, [blockId, onUpdate]);

  const onLenBlur = useCallback(() => {
    const n = parseFloat(length);
    if (isNaN(n) || n <= 0) { setLength(String(initialLength)); onUpdate(blockId, "length", initialLength); }
  }, [length, initialLength, blockId, onUpdate]);

  const onWidBlur = useCallback(() => {
    const n = parseFloat(width);
    if (isNaN(n) || n <= 0) { setWidth(String(initialWidth)); onUpdate(blockId, "width", initialWidth); }
  }, [width, initialWidth, blockId, onUpdate]);

  const onRoofChange = useCallback((e) => {
    onUpdate(blockId, "roofType", e.target.value);
  }, [blockId, onUpdate]);

  const handleRemove = useCallback(() => onRemove(blockId), [blockId, onRemove]);

  const area  = (parseFloat(length) || 0) * (parseFloat(width) || 0);
  const coeff = RUNOFF_COEFFICIENTS[initialRoofType]?.C ?? 0.80;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.pureWhite,
        border: hovered ? `1.5px solid ${C.hydroBlue}40` : `1.5px solid ${C.lightBorder}`,
        borderRadius: "14px", padding: "1.25rem", marginBottom: "0.85rem",
        boxShadow: hovered ? C.shadowMd : C.shadowSm,
        transition: "all 0.2s ease",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Accent strip */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "3px",
        background: `linear-gradient(90deg, ${C.hydroBlue}, ${C.aquiferTeal})`,
        opacity: hovered ? 1 : 0.5, transition: "opacity 0.2s ease",
      }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{
            width: "30px", height: "30px", borderRadius: "8px",
            background: `linear-gradient(135deg, ${C.hydroBlue}, ${C.hydroBlueLight})`,
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.8rem", fontWeight: 700, flexShrink: 0,
            boxShadow: "0 2px 6px rgba(15,76,129,0.2)",
          }}>{index + 1}</div>
          <div>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: C.graphite, display: "block", lineHeight: 1.2 }}>Block {index + 1}</span>
            {area > 0 && (
              <span style={{ fontSize: "0.65rem", color: C.structGrey }}>{area.toFixed(1)} m²</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {canRemove && (
            <button onClick={handleRemove} style={{
              background: hovered ? C.overflowRedPale : "transparent",
              border: hovered ? `1px solid ${C.overflowRed}40` : `1px solid transparent`,
              borderRadius: "8px", cursor: "pointer", color: C.overflowRed,
              fontSize: "0.72rem", padding: "0.35rem 0.65rem", fontWeight: 600,
              transition: "all 0.15s ease",
              display: "flex", alignItems: "center", gap: "0.3rem",
            }}>
              <span style={{ fontSize: "0.8rem" }}>✕</span> Remove
            </button>
          )}
        </div>
      </div>

      {/* Dimensions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem", marginBottom: "1rem" }}>
        <div>
          <label style={labelStyle}>Length (m)</label>
          <div style={{ position: "relative" }}>
            <input type="text" inputMode="decimal" value={length}
              onChange={onLenChange} onBlur={onLenBlur} placeholder="e.g. 15"
              style={{ ...inputStyle, paddingRight: "2.5rem" }}
              onFocus={e => { e.target.style.borderColor = C.hydroBlue; }}
              onBlurCapture={e => { if (!e.target.value) e.target.style.borderColor = C.concreteGrey; }}
            />
            <span style={{ position:"absolute", right:"0.8rem", top:"50%", transform:"translateY(-50%)", fontSize:"0.72rem", color:C.structGrey, pointerEvents:"none" }}>m</span>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Width (m)</label>
          <div style={{ position: "relative" }}>
            <input type="text" inputMode="decimal" value={width}
              onChange={onWidChange} onBlur={onWidBlur} placeholder="e.g. 10"
              style={{ ...inputStyle, paddingRight: "2.5rem" }}
              onFocus={e => { e.target.style.borderColor = C.hydroBlue; }}
              onBlurCapture={e => { if (!e.target.value) e.target.style.borderColor = C.concreteGrey; }}
            />
            <span style={{ position:"absolute", right:"0.8rem", top:"50%", transform:"translateY(-50%)", fontSize:"0.72rem", color:C.structGrey, pointerEvents:"none" }}>m</span>
          </div>
        </div>
      </div>

      {/* Roof type */}
      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Roof Material</label>
        <select value={initialRoofType} onChange={onRoofChange} style={selectStyle}
          onFocus={e => { e.target.style.borderColor = C.hydroBlue; }}
          onBlur={e => { e.target.style.borderColor = C.concreteGrey; }}>
          {Object.keys(RUNOFF_COEFFICIENTS).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* Stats bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: C.panelGrey, borderRadius: "10px", padding: "0.6rem 0.85rem",
        gap: "0.5rem", flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.68rem", color: C.structGrey }}>
            Area: <strong style={{ color: C.hydroBlue }}>{area.toFixed(1)} m²</strong>
          </span>
          <span style={{ fontSize: "0.68rem", color: C.structGrey }}>
            C = <strong style={{ color: C.rechargeGreen }}>{coeff}</strong>
          </span>
        </div>
        {area > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <div style={{ width: "40px", height: "4px", borderRadius: "2px", background: C.lightBorder, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${Math.min((area / 200) * 100, 100)}%`,
                background: `linear-gradient(90deg, ${C.rainfallBlue}, ${C.hydroBlue})`,
                borderRadius: "2px", transition: "width 0.3s ease",
              }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// ─── SMALL DISPLAY ATOMS — no inputs, safe to define anywhere ─────────────────
function SecTitle({ children, color = C.aquiferTeal, icon }) {
  return (
    <div style={{
      fontSize: "0.68rem", color, letterSpacing: "0.12em", textTransform: "uppercase",
      fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem",
    }}>
      {icon && <span style={{ fontSize: "1.1rem" }}>{icon}</span>}
      <div style={{ width: "16px", height: "3px", background: color, borderRadius: "2px", flexShrink: 0 }} />
      {children}
    </div>
  );
}

function MetricCard({ label, value, unit, color, sub, badge, icon, animated, decimals = 0, suffix = "" }) {
  const [hovered, setHovered] = useState(false);
  const displayValue = animated && typeof value === "number"
    ? <><AnimatedNumber value={value} decimals={decimals} />{suffix}</>
    : value;
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.pureWhite, border: `1px solid ${C.lightBorder}`, borderRadius: "14px",
        padding: "1.1rem 1.2rem", borderTop: `3px solid ${color}`,
        boxShadow: hovered ? C.shadowMd : C.shadowSm, position: "relative",
        transition: "all 0.2s ease", transform: hovered ? "translateY(-2px)" : "none",
      }}
    >
      {badge && (
        <div style={{
          position: "absolute", top: "0.65rem", right: "0.75rem", fontSize: "0.55rem",
          color, background: `${color}12`, border: `1px solid ${color}25`,
          borderRadius: "6px", padding: "0.15rem 0.5rem", fontWeight: 700, letterSpacing: "0.06em",
        }}>{badge}</div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
        {icon && <span style={{ fontSize: "1.1rem" }}>{icon}</span>}
        <div style={{
          fontSize: "0.62rem", color: C.structGrey, letterSpacing: "0.08em",
          textTransform: "uppercase", lineHeight: 1.3,
        }}>{label}</div>
      </div>
      <div style={{
        fontSize: "1.9rem", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
        color, lineHeight: 1,
      }}>{displayValue}</div>
      {unit && (
        <div style={{ fontSize: "0.68rem", color: C.structGrey, marginTop: "0.2rem" }}>{unit}</div>
      )}
      {sub && (
        <div style={{ fontSize: "0.62rem", color: "#94a3b8", marginTop: "0.3rem", lineHeight: 1.4 }}>{sub}</div>
      )}
    </div>
  );
}

function InfoChip({ label, value, color }) {
  return (
    <div style={{
      background: `${color}08`, border: `1px solid ${color}25`, borderRadius: "10px",
      padding: "0.6rem 0.75rem", transition: "all 0.15s ease",
    }}>
      <div style={{
        fontSize: "0.56rem", color: C.structGrey, letterSpacing: "0.08em",
        textTransform: "uppercase", marginBottom: "0.2rem", fontWeight: 600,
      }}>{label}</div>
      <div style={{ fontSize: "0.9rem", fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function DesignRow({ label, value, note }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      padding: "0.65rem 0.85rem", borderBottom: `1px solid ${C.lightBorder}`, gap: "0.5rem",
    }}>
      <div>
        <div style={{ fontSize: "0.75rem", color: C.structGrey }}>{label}</div>
        {note && <div style={{ fontSize: "0.62rem", color: "#94a3b8", marginTop: "0.1rem" }}>{note}</div>}
      </div>
      <div style={{
        fontSize: "0.8rem", fontWeight: 700, color: C.hydroBlue, textAlign: "right",
        flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace",
      }}>{value}</div>
    </div>
  );
}

function ScoreMeter({ score }) {
  const color = score >= 70 ? C.rechargeGreen : score >= 40 ? C.soilAmber : C.overflowRed;
  const label = score >= 70 ? "Excellent" : score >= 40 ? "Moderate" : "Poor";
  const r = 30, circ = 2 * Math.PI * r;
  const [animatedOffset, setAnimatedOffset] = useState(circ);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedOffset(circ * (1 - score / 100)), 50);
    return () => clearTimeout(timer);
  }, [score, circ]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1.3rem" }}>
      <div style={{ position: "relative" }}>
        <svg width="76" height="76" viewBox="0 0 76 76">
          <circle cx="38" cy="38" r={r} fill="none" stroke={C.lightBorder} strokeWidth="6" />
          <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={circ} strokeDashoffset={animatedOffset}
            strokeLinecap="round" transform="rotate(-90 38 38)"
            style={{ transition: "stroke-dashoffset 0.8s ease-out" }} />
          <text x="38" y="44" textAnchor="middle" fontFamily="'Barlow Condensed',sans-serif"
            fontWeight="700" fontSize="17" fill={color}>{score}</text>
        </svg>
      </div>
      <div>
        <div style={{
          fontSize: "0.62rem", color: C.structGrey, letterSpacing: "0.1em",
          textTransform: "uppercase", fontWeight: 600,
        }}>Recharge Suitability · CGWB</div>
        <div style={{
          fontSize: "1.4rem", fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700, color, marginTop: "0.1rem",
        }}>{label}</div>
        <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>Score: {score} / 100</div>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.pureWhite, border: `1px solid ${C.lightBorder}`, borderRadius: "10px",
      padding: "0.8rem 1rem", boxShadow: C.shadowLg,
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      <div style={{
        fontSize: "0.7rem", color: C.structGrey, marginBottom: "0.4rem", fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.06em",
      }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{
          fontSize: "0.8rem", color: p.color, display: "flex", justifyContent: "space-between",
          gap: "1.5rem", padding: "0.15rem 0", borderBottom: payload.length > 1 ? `1px solid ${C.lightBorder}` : "none",
        }}>
          <span style={{ color: C.structGrey }}>{p.name}</span>
          <strong>{p.value} m³</strong>
        </div>
      ))}
    </div>
  );
}

function StepBar({ step, steps, onStep, completedSteps = [], isMobile }) {
  const progress = ((step) / steps.length) * 100;
  
  return (
    <div style={{
      background: C.pureWhite, borderBottom: `1px solid ${C.lightBorder}`,
      position: "relative", overflow: "hidden",
    }}>
      {/* Progress bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, height: "3px", width: `${progress}%`,
        background: `linear-gradient(90deg, ${C.hydroBlue}, ${C.aquiferTeal})`,
        transition: "width 0.4s ease", borderRadius: "0 2px 2px 0",
      }} />
      
      <div style={{ display: "flex", overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
        {steps.map((s, i) => {
          const active = step === i + 1;
          const done = completedSteps.includes(i + 1);
          return (
            <button key={s} onClick={() => onStep(i + 1)} style={{
              flex: "1 1 0", minWidth: isMobile ? "58px" : "65px", padding: isMobile ? "0.6rem 0.4rem" : "0.75rem 0.5rem",
              background: active ? `${C.hydroBlue}08` : "none", border: "none",
              borderBottom: active ? `3px solid ${C.hydroBlue}` : "3px solid transparent",
              cursor: "pointer", display: "flex", flexDirection: "column",
              alignItems: "center", gap: "0.25rem", transition: "all 0.2s ease",
              position: "relative",
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = `${C.hydroBlue}05`; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "none"; }}
            >
              <div style={{
                width: isMobile ? "22px" : "26px", height: isMobile ? "22px" : "26px", borderRadius: isMobile ? "6px" : "8px",
                background: active ? C.hydroBlue : done ? C.rechargeGreen : C.panelGrey,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.7rem", fontWeight: 700, color: active || done ? "#fff" : C.structGrey,
                flexShrink: 0, transition: "all 0.2s ease",
                boxShadow: active ? "0 2px 8px rgba(15,76,129,0.2)" : "none",
              }}>
                {done ? "✓" : i + 1}
              </div>
              <div style={{
                fontSize: isMobile ? "0.5rem" : "0.58rem", color: active ? C.hydroBlue : done ? C.rechargeGreen : C.structGrey,
                textTransform: "uppercase", fontWeight: active ? 700 : 400,
                whiteSpace: "nowrap", letterSpacing: "0.05em", transition: "color 0.2s ease",
              }}>{s}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── STEP PANELS — defined at module level, receive all needed props ───────────

function Step1Panel({ district, setDistrict, rainfall, setRainfall, slope, setSlope,
  firstFlushPct, setFirstFlushPct, dryMonths, setDryMonths, customGW, setCustomGW,
  gwInfo, rechargeColor, annualRunoff }) {

  const onRainfall   = useCallback((v) => setRainfall(v),   [setRainfall]);
  const onSlope      = useCallback((v) => setSlope(v),      [setSlope]);
  const onFF         = useCallback((v) => setFirstFlushPct(v), [setFirstFlushPct]);
  const onDryMonths  = useCallback((v) => setDryMonths(v),  [setDryMonths]);
  const onCustomGW   = useCallback((v) => setCustomGW(v),   [setCustomGW]);

  const ffVal = parseFloat(firstFlushPct) || 10;

  return (
    <div>
      <SecTitle icon="🌍">Site & Rainfall Data</SecTitle>

      <div style={fieldWrap}>
        <label style={labelStyle}>District</label>
        <StableSelect value={district} onChange={setDistrict} options={Object.keys(GW_ZONES)} />
        <div style={noteStyle}>Auto-loads GW data from CGWB database</div>
      </div>

      {district === "Custom" ? (
        <div style={fieldWrap}>
          <label style={labelStyle}>Groundwater Depth (m BGL)</label>
          <StableInput key="customGW" initialValue={customGW} onCommit={onCustomGW} suffix="m" placeholder="e.g. 12" min={0} max={100} />
          <div style={noteStyle}>From CGWB report or field measurement</div>
        </div>
      ) : (
        <div style={{
          background: `linear-gradient(135deg, ${C.hydroBlue}06, ${C.aquiferTeal}06)`,
          border: `1px solid ${C.hydroBlue}15`, borderRadius: "12px",
          padding: "1rem 1.1rem", marginBottom: "1.25rem",
        }}>
          <div style={{
            fontSize: "0.6rem", color: C.hydroBlue, letterSpacing: "0.1em",
            textTransform: "uppercase", marginBottom: "0.6rem", fontWeight: 700,
            display: "flex", alignItems: "center", gap: "0.4rem",
          }}>
            <span style={{ fontSize: "0.85rem" }}>📡</span> CGWB Data Loaded
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
            <InfoChip label="Depth" value={`${gwInfo.depth}m`} color={C.hydroBlue} />
            <InfoChip label="Aquifer" value={gwInfo.aquifer} color={C.aquiferTeal} />
            <InfoChip label="Recharge" value={gwInfo.recharge} color={rechargeColor} />
          </div>
        </div>
      )}

      <div style={fieldWrap}>
        <label style={labelStyle}>Annual Rainfall (mm)</label>
        <StableInput key="rainfall" initialValue={rainfall} onCommit={onRainfall} suffix="mm" placeholder="e.g. 870" min={100} max={5000} />
        <div style={noteStyle}>IMD / Open-Meteo 30-yr district average</div>
      </div>

      <div style={fieldWrap}>
        <label style={labelStyle}>Ground Slope (%)</label>
        <StableInput key="slope" initialValue={slope} onCommit={onSlope} suffix="%" placeholder="e.g. 2" min={0} max={50} />
        <div style={{ ...noteStyle, display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
          {[["0–2%", "Flat", C.rechargeGreen], ["2–5%", "Gentle", C.soilAmber], [">10%", "Steep", C.overflowRed]].map(([range, label, color]) => (
            <span key={range} style={{
              fontSize: "0.6rem", color, background: `${color}10`, border: `1px solid ${color}25`,
              borderRadius: "4px", padding: "0.12rem 0.4rem", fontWeight: 600,
            }}>{range} {label}</span>
          ))}
        </div>
      </div>

      <div style={fieldWrap}>
        <label style={labelStyle}>First-Flush Loss (%)</label>
        <StableInput key="firstFlush" initialValue={firstFlushPct} onCommit={onFF} suffix="%" placeholder="e.g. 10" min={0} max={25} />
        <div style={{ fontSize: "0.62rem", color: "#94a3b8", marginTop: "0.35rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "14px", height: "14px", borderRadius: "50%", background: C.hydroBluePale, color: C.hydroBlue, fontSize: "0.55rem", fontWeight: 700 }}>i</span>
          Recommended 10% — see References tab
        </div>
      </div>

      <div style={fieldWrap}>
        <label style={labelStyle}>Dry Season (months)</label>
        <StableInput key="dryMonths" initialValue={dryMonths} onCommit={onDryMonths} suffix="mo" placeholder="e.g. 8" min={0} max={11} />
        <div style={noteStyle}>For dry-period tank sizing — GoI RWH Manual</div>
      </div>

      {/* Live Preview */}
      <div style={{
        background: `linear-gradient(135deg, ${C.aquiferTeal}08, ${C.hydroBlue}06)`,
        border: `1.5px dashed ${C.aquiferTeal}35`, borderRadius: "12px",
        padding: "0.9rem 1.1rem", transition: "all 0.2s ease",
      }}>
        <div style={{
          fontSize: "0.6rem", color: C.aquiferTeal, letterSpacing: "0.1em",
          textTransform: "uppercase", marginBottom: "0.5rem", fontWeight: 700,
          display: "flex", alignItems: "center", gap: "0.4rem",
        }}>
          <span style={{ fontSize: "0.85rem" }}>⚡</span> Live Preview
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", marginBottom: "0.3rem" }}>
          <span style={{ color: C.structGrey }}>Est. Annual Runoff</span>
          <strong style={{ color: C.hydroBlue, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.1rem" }}>{annualRunoff.toFixed(0)} m³</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem" }}>
          <span style={{ color: C.structGrey }}>First-flush deducted</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <div style={{ width: "50px", height: "4px", borderRadius: "2px", background: C.lightBorder, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${ffVal * 4}%`,
                background: `linear-gradient(90deg, ${C.aquiferTeal}, ${C.hydroBlue})`,
                borderRadius: "2px", transition: "width 0.3s ease",
              }} />
            </div>
            <strong style={{ color: C.aquiferTeal }}>{firstFlushPct}% ✓</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step2Panel({ roofBlocks, addBlock, onUpdate, onRemove, totalArea, weightedC, annualRunoff }) {
  return (
    <div>
      <SecTitle icon="🏗️">Roof Catchment Blocks</SecTitle>
      <div style={{
        fontSize: "0.73rem", color: C.structGrey, marginBottom: "1.1rem", lineHeight: 1.6,
        background: C.panelGrey, borderRadius: "10px", padding: "0.75rem 0.9rem",
        borderLeft: `3px solid ${C.hydroBlue}`,
      }}>
        Enter each roof section separately. Different wings or levels of a building can be added as separate blocks.
      </div>

      {roofBlocks.map((b, i) => (
        <RoofBlockRow
          key={b.id}
          blockId={b.id}
          index={i}
          initialLength={b.length}
          initialWidth={b.width}
          initialRoofType={b.roofType}
          onUpdate={onUpdate}
          onRemove={onRemove}
          canRemove={roofBlocks.length > 1}
        />
      ))}

      {roofBlocks.length < 6 && (
        <button onClick={addBlock} style={{
          width: "100%", padding: "0.75rem",
          background: `linear-gradient(135deg, ${C.aquiferTeal}08, ${C.hydroBlue}06)`,
          border: `2px dashed ${C.aquiferTeal}40`, borderRadius: "14px",
          color: C.aquiferTeal, fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "0.82rem", cursor: "pointer", fontWeight: 700,
          marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = C.aquiferTeal; e.currentTarget.style.background = `${C.aquiferTeal}12`; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = `${C.aquiferTeal}40`; e.currentTarget.style.background = `linear-gradient(135deg, ${C.aquiferTeal}08, ${C.hydroBlue}06)`; }}
        >
          <span style={{ fontSize: "1.1rem" }}>+</span> Add Roof Block ({roofBlocks.length}/6)
        </button>
      )}

      {/* Summary */}
      <div style={{
        background: `linear-gradient(135deg, ${C.hydroBlue}06, ${C.aquiferTeal}04)`,
        border: `1px solid ${C.hydroBlue}15`, borderRadius: "14px",
        padding: "1rem 1.1rem", transition: "all 0.2s ease",
      }}>
        <div style={{
          fontSize: "0.6rem", color: C.hydroBlue, letterSpacing: "0.1em",
          textTransform: "uppercase", marginBottom: "0.6rem", fontWeight: 700,
        }}>Summary</div>
        {[["Total Catchment Area", `${totalArea.toFixed(1)} m²`, C.hydroBlue],
          ["Weighted Avg. C", weightedC.toFixed(3), C.rechargeGreen],
          ["Est. Annual Runoff", `${annualRunoff.toFixed(1)} m³`, C.monsoonBlue]
        ].map(([k, v, col]) => (
          <div key={k} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            fontSize: "0.8rem", padding: "0.3rem 0", borderBottom: `1px solid ${C.lightBorder}80`,
          }}>
            <span style={{ color: C.structGrey }}>{k}</span>
            <strong style={{ color: col, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.95rem" }}>{v}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function Step3Panel({ buildingType, setBuildingType, population, setPopulation, customLPCD, setCustomLPCD,
  lpcd, nonPotablePct, dailyDemand, annualDemand, supplyRatio }) {
  const onPop = useCallback((v) => setPopulation(v), [setPopulation]);
  const onLPCD = useCallback((v) => setCustomLPCD(v), [setCustomLPCD]);
  
  const ratioColor = supplyRatio >= 1 ? C.rechargeGreen : supplyRatio >= 0.5 ? C.soilAmber : C.overflowRed;
  const ratioLabel = supplyRatio >= 1 ? "Sufficient" : supplyRatio >= 0.5 ? "Partial" : "Insufficient";
  
  return (
    <div>
      <SecTitle icon="🏠">Water Demand Assessment</SecTitle>

      <div style={fieldWrap}>
        <label style={labelStyle}>Building Type</label>
        <StableSelect value={buildingType} onChange={setBuildingType} options={Object.keys(BUILDING_TYPES)} />
        <div style={noteStyle}>Sets default LPCD water demand per IS:1172</div>
      </div>

      {/* Default values card */}
      <div style={{
        background: `linear-gradient(135deg, ${C.monsoonBlue}06, ${C.wseViolet}04)`,
        border: `1px solid ${C.monsoonBlue}15`, borderRadius: "12px",
        padding: "1rem 1.1rem", marginBottom: "1.25rem",
      }}>
        <div style={{
          fontSize: "0.6rem", color: C.structGrey, letterSpacing: "0.1em",
          textTransform: "uppercase", marginBottom: "0.5rem", fontWeight: 700,
          display: "flex", alignItems: "center", gap: "0.4rem",
        }}>
          <span style={{ fontSize: "0.8rem" }}>📐</span> IS:1172 Default Values
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", marginBottom: "0.3rem" }}>
          <span style={{ color: C.structGrey }}>Default LPCD</span>
          <strong style={{ color: C.monsoonBlue, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.95rem" }}>
            {BUILDING_TYPES[buildingType].lpcd} L/day/person
          </strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem" }}>
          <span style={{ color: C.structGrey }}>Non-Potable Fraction</span>
          <strong style={{ color: C.wseViolet, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.95rem" }}>
            {(BUILDING_TYPES[buildingType].nonPotablePct * 100).toFixed(0)}%
          </strong>
        </div>
      </div>

      <div style={fieldWrap}>
        <label style={labelStyle}>Occupants / Population</label>
        <StableInput key="population" initialValue={population} onCommit={onPop} suffix="pax" placeholder="e.g. 6" min={1} max={10000} />
      </div>

      <div style={fieldWrap}>
        <label style={labelStyle}>Custom LPCD (optional)</label>
        <StableInput key="customLPCD" initialValue={customLPCD} onCommit={onLPCD} suffix="L/d" placeholder={`Default: ${BUILDING_TYPES[buildingType].lpcd}`} min={1} max={1000} />
        <div style={noteStyle}>Leave blank to use IS:1172 default for {buildingType}</div>
      </div>

      {/* Demand Summary */}
      <div style={{
        background: `linear-gradient(135deg, ${C.aquiferTeal}08, ${C.soilAmber}05)`,
        border: `1px solid ${C.aquiferTeal}20`, borderRadius: "12px",
        padding: "1rem 1.1rem",
      }}>
        <div style={{
          fontSize: "0.6rem", color: C.aquiferTeal, letterSpacing: "0.1em",
          textTransform: "uppercase", marginBottom: "0.5rem", fontWeight: 700,
          display: "flex", alignItems: "center", gap: "0.4rem",
        }}>
          <span style={{ fontSize: "0.85rem" }}>📊</span> Demand Summary
        </div>
        {[
          ["Daily Demand", `${(dailyDemand * 1000).toFixed(0)} L/day`, C.soilAmber],
          ["Annual Demand", `${annualDemand.toFixed(0)} m³/yr`, C.soilAmber],
        ].map(([k, v, col]) => (
          <div key={k} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            fontSize: "0.8rem", padding: "0.25rem 0", borderBottom: `1px solid ${C.lightBorder}60`,
          }}>
            <span style={{ color: C.structGrey }}>{k}</span>
            <strong style={{ color: col, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.95rem" }}>{v}</strong>
          </div>
        ))}
        {/* Supply ratio with visual indicator */}
        <div style={{ marginTop: "0.6rem", padding: "0.5rem", background: `${ratioColor}08`, borderRadius: "8px", border: `1px solid ${ratioColor}20` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
            <span style={{ fontSize: "0.72rem", color: C.structGrey }}>Supply/Demand Ratio</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{
                fontSize: "0.55rem", color: ratioColor, background: `${ratioColor}15`,
                border: `1px solid ${ratioColor}30`, borderRadius: "4px", padding: "0.1rem 0.4rem",
                fontWeight: 700, letterSpacing: "0.05em",
              }}>{ratioLabel}</span>
              <strong style={{ color: ratioColor, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.1rem" }}>
                {supplyRatio.toFixed(2)}
              </strong>
            </div>
          </div>
          <div style={{ width: "100%", height: "5px", borderRadius: "3px", background: C.lightBorder, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${Math.min(supplyRatio * 100, 100)}%`,
              background: `linear-gradient(90deg, ${C.overflowRed}, ${C.soilAmber}, ${C.rechargeGreen})`,
              borderRadius: "3px", transition: "width 0.4s ease",
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Step4Panel({ soilType, setSoilType, rScore, rRec }) {
  return (
    <div>
      <SecTitle icon="🪨">Subsurface Conditions</SecTitle>

      <div style={fieldWrap}>
        <label style={labelStyle}>Soil Type</label>
        <StableSelect value={soilType} onChange={setSoilType} options={Object.keys(SOIL_DATA)} />
        <div style={noteStyle}>Determines percolation rate and recharge viability</div>
      </div>

      {/* Permeability class */}
      <div style={{
        background: `${SOIL_DATA[soilType].color}08`, border: `1px solid ${SOIL_DATA[soilType].color}25`,
        borderRadius: "12px", padding: "1rem 1.1rem", marginBottom: "1.25rem",
        transition: "all 0.3s ease",
      }}>
        <div style={{
          fontSize: "0.6rem", color: C.structGrey, letterSpacing: "0.1em",
          textTransform: "uppercase", marginBottom: "0.5rem", fontWeight: 600,
        }}>Permeability Class</div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{
            width: "14px", height: "14px", borderRadius: "50%",
            background: SOIL_DATA[soilType].color, flexShrink: 0,
            boxShadow: `0 0 0 3px ${SOIL_DATA[soilType].color}25`,
          }} />
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
            fontSize: "1.15rem", color: SOIL_DATA[soilType].color,
          }}>{SOIL_DATA[soilType].label}</span>
          <span style={{
            marginLeft: "auto", color: C.structGrey, fontSize: "0.75rem",
            fontFamily: "'IBM Plex Mono', monospace",
          }}>k = {SOIL_DATA[soilType].k} mm/hr</span>
        </div>
        {/* Visual permeability bar */}
        <div style={{ marginTop: "0.6rem" }}>
          <div style={{ width: "100%", height: "4px", borderRadius: "2px", background: C.lightBorder, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${Math.min((SOIL_DATA[soilType].k / 15) * 100, 100)}%`,
              background: `linear-gradient(90deg, ${C.overflowRed}, ${C.soilAmber}, ${C.rechargeGreen})`,
              borderRadius: "2px", transition: "width 0.4s ease",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.2rem" }}>
            <span style={{ fontSize: "0.55rem", color: C.overflowRed }}>Low</span>
            <span style={{ fontSize: "0.55rem", color: C.rechargeGreen }}>High</span>
          </div>
        </div>
      </div>

      {/* Recharge Preview */}
      <div style={{
        background: C.panelGrey, border: `1px solid ${C.lightBorder}`,
        borderRadius: "12px", padding: "1rem 1.1rem", marginBottom: "1.25rem",
      }}>
        <div style={{
          fontSize: "0.6rem", color: C.structGrey, letterSpacing: "0.1em",
          textTransform: "uppercase", marginBottom: "0.6rem", fontWeight: 700,
          display: "flex", alignItems: "center", gap: "0.4rem",
        }}>
          <span style={{ fontSize: "0.8rem" }}>⚡</span> Recharge Preview
        </div>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: "0.8rem", marginBottom: "0.3rem",
        }}>
          <span style={{ color: C.structGrey }}>Recharge Score</span>
          <strong style={{
            color: rScore >= 70 ? C.rechargeGreen : rScore >= 40 ? C.soilAmber : C.overflowRed,
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.1rem",
          }}>{rScore}/100</strong>
        </div>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: "0.8rem", marginBottom: "0.4rem",
        }}>
          <span style={{ color: C.structGrey }}>Recommended</span>
          <strong style={{ color: C.hydroBlue, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.95rem" }}>{rRec.type}</strong>
        </div>
        <div style={{
          fontSize: "0.7rem", color: C.structGrey, lineHeight: 1.6,
          padding: "0.5rem 0", borderTop: `1px solid ${C.lightBorder}`,
        }}>{rRec.reason}</div>
      </div>

      {/* Equations reference */}
      <div style={{
        background: `linear-gradient(135deg, ${C.hydroBlue}06, ${C.aquiferTeal}04)`,
        border: `1px dashed ${C.hydroBlue}20`, borderRadius: "12px",
        padding: "1rem 1.1rem",
      }}>
        <div style={{
          fontSize: "0.6rem", color: C.aquiferTeal, letterSpacing: "0.1em",
          textTransform: "uppercase", marginBottom: "0.5rem", fontWeight: 700,
        }}>Key Equations</div>
        <div style={{
          fontSize: "0.72rem", color: C.graphite, lineHeight: 2.2,
          fontFamily: "'IBM Plex Mono', monospace",
        }}>
          <div style={{ padding: "0.15rem 0", borderBottom: `1px solid ${C.lightBorder}60` }}>Q = P × A × C × (1−FF) / 1000</div>
          <div style={{ padding: "0.15rem 0", borderBottom: `1px solid ${C.lightBorder}60` }}>S_t = min(max(S_(t-1)+Q_t−D_t, 0), Cap)</div>
          <div style={{ padding: "0.15rem 0", borderBottom: `1px solid ${C.lightBorder}60` }}>WSE = Σmet / Σdemand × 100</div>
          <div style={{ padding: "0.15rem 0", borderBottom: `1px solid ${C.lightBorder}60` }}>V_dry = t × n × q × 0.4</div>
          <div style={{ padding: "0.15rem 0" }}>Q_peak = C × I × A / 36</div>
        </div>
      </div>
    </div>
  );
}

// ─── RESULTS PANEL — also defined at module level ─────────────────────────────
function ResultsPanel({ isMobile, derived }) {
  const [activeTab, setActiveTab] = useState("overview");
  const { annualRunoff, annualDemand, dailyDemand, lpcd, firstFlushPct, wse, reliability,
    nonPotableWse, nonPotablePct, tankSize, tankSizeRatio, tankSizeDryPd, totalArea,
    roofBlocks, weightedC, dp, gwDepth, gwInfo, rechargeColor, monthlyRunoff, waterBalance,
    rScore, rRec, priorityColor, supplyRatio, dryMos, district, rainNum, slopeNum,
    soilType, popNum, buildingType, ffFactor } = derived;

  // Responsive grid helper: mobile=1col, tablet=2col, desktop=4col
  const gridCols4 = isMobile ? "1fr 1fr" : "repeat(4, 1fr)";
  const gridCols3 = isMobile ? "1fr" : "repeat(3, 1fr)";
  const gridCols2 = "1fr 1fr";
  const chartGrid = isMobile ? "1fr" : "1fr 1fr";

  const tabs = [
    { id:"overview",    label:"Overview" },
    { id:"charts",      label:"Charts" },
    { id:"design",      label:"Design" },
    { id:"recharge",    label:"Recharge" },
    { id:"summary",     label:"Summary" },
    { id:"references",  label:"References" },
  ];

  return (
    <div style={{ padding: isMobile ? "1rem" : "1.5rem", background: C.mistWhite }}>
      {/* Tab bar */}
      <div style={{
        display: "flex", background: C.pureWhite, borderRadius: "12px",
        border: `1px solid ${C.lightBorder}`, padding: "4px", marginBottom: "1.25rem",
        gap: "3px", overflowX: "auto", WebkitOverflowScrolling: "touch",
        boxShadow: C.shadowSm,
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            flex: "1 1 auto", minWidth: isMobile ? "70px" : "auto",
            padding: isMobile ? "0.45rem 0.5rem" : "0.5rem 0.65rem",
            border: "none", borderRadius: "9px",
            background: activeTab === t.id ? C.hydroBlue : "transparent",
            color: activeTab === t.id ? "#fff" : C.structGrey,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: isMobile ? "0.63rem" : "0.72rem",
            fontWeight: activeTab === t.id ? 700 : 500,
            cursor: "pointer", whiteSpace: "nowrap",
            transition: "all 0.2s ease",
            boxShadow: activeTab === t.id ? "0 2px 6px rgba(15,76,129,0.15)" : "none",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap:"0.75rem", marginBottom:"0.85rem" }}>
            <MetricCard label="Annual Runoff"    icon="💧" value={annualRunoff} decimals={0} animated unit="m³ / year" color={C.hydroBlue}   sub={`${(annualRunoff*1000).toFixed(0)} L · FF=${firstFlushPct}%`}/>
            <MetricCard label="Annual Demand"    icon="🏠" value={annualDemand}  decimals={0} animated unit="m³ / year" color={C.soilAmber}   sub={`${(dailyDemand*1000).toFixed(0)} L/day · ${lpcd} lpcd`}/>
            <MetricCard label="WSE"              icon="📊" value={wse} decimals={1} animated suffix="%" unit="Water Saving Eff." color={wse>=60?C.rechargeGreen:wse>=35?C.soilAmber:C.overflowRed} sub={`Reliability: ${reliability}%`} />
            <MetricCard label="Non-Potable Cover" icon="🚿" value={parseFloat(nonPotableWse)} decimals={1} animated suffix="%" unit="of non-potable demand" color={C.wseViolet} sub={`${(nonPotablePct*100).toFixed(0)}% of demand non-potable`} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap:"0.75rem", marginBottom:"1rem" }}>
            <MetricCard label="Recommended Tank" icon="🛢️" value={`${tankSize} m³`}        unit="capacity" color={C.monsoonBlue} sub={`Ratio: ${tankSizeRatio}m³ · Dry-pd: ${tankSizeDryPd}m³`} />
            <MetricCard label="Catchment Area"   icon="🏗️" value={`${totalArea.toFixed(0)} m²`} unit={`${roofBlocks.length} block(s)`} color={C.aquiferTeal} sub={`Weighted C = ${weightedC.toFixed(3)}`} />
            <MetricCard label="Downpipe Dia"     icon="🔧" value={`${dp.pipeDia}mm`}        unit="PVC downpipe" color={C.structGrey} sub={`Peak Q = ${(dp.peakFlow*1000).toFixed(2)} L/s`} />
            <MetricCard label="GW Depth"         icon="⛏️" value={`${gwDepth}m`}            unit="below ground level" color={rechargeColor} sub={`${gwInfo.aquifer} · ${gwInfo.recharge}`} />
          </div>
          <div style={{
            background: C.pureWhite, border: `1px solid ${C.lightBorder}`, borderRadius: "14px",
            padding: isMobile ? "0.85rem" : "1.25rem", boxShadow: C.shadowSm, overflow: "hidden",
          }}>
            <SecTitle color={C.hydroBlue} icon="🛢️">Tank Sizing — Dual Method Comparison</SecTitle>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: isMobile ? "0.65rem" : "0.85rem" }}>
              {[
                { label: "Ratio Method", value: `${tankSizeRatio} m³`, sub: `Supply ratio: ${supplyRatio.toFixed(2)}`, color: C.monsoonBlue },
                { label: "Dry-Period Method", value: `${tankSizeDryPd} m³`, sub: `${dryMos} dry months · V=t·n·q·0.4`, color: C.aquiferTeal },
                { label: "✓ Recommended (Max)", value: `${tankSize} m³`, sub: "Conservative — takes larger of both", color: C.rechargeGreen, h: true },
              ].map(({ label, value, sub, color, h }) => (
                <div key={label} style={{
                  background: h ? `linear-gradient(135deg, ${color}10, ${color}05)` : `${color}06`,
                  border: `${h ? 2 : 1}px solid ${color}${h ? "40" : "18"}`,
                  borderRadius: "12px", padding: isMobile ? "0.8rem" : "1rem",
                  transition: "all 0.2s ease",
                  boxShadow: h ? `0 4px 12px ${color}15` : "none",
                }}>
                  <div style={{
                    fontSize: isMobile ? "0.55rem" : "0.62rem", color: h ? color : C.structGrey,
                    textTransform: "uppercase", letterSpacing: "0.08em",
                    marginBottom: "0.35rem", fontWeight: h ? 700 : 600,
                  }}>{label}</div>
                  <div style={{
                    fontSize: isMobile ? "1.3rem" : "1.7rem", fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700, color, lineHeight: 1,
                  }}>{value}</div>
                  <div style={{ fontSize: isMobile ? "0.58rem" : "0.65rem", color: C.structGrey, marginTop: "0.3rem" }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Charts */}
      {activeTab === "charts" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "0.75rem" : "1rem", marginBottom: isMobile ? "0.75rem" : "1rem" }}>
            <div style={{
              background: C.pureWhite, border: `1px solid ${C.lightBorder}`,
              borderRadius: "14px", padding: isMobile ? "0.85rem" : "1.25rem", boxShadow: C.shadowSm,
            }}>
              <SecTitle>Monthly Runoff — After First-Flush (m³)</SecTitle>
              <ResponsiveContainer width="100%" height={isMobile ? 180 : 200}>
                <BarChart data={monthlyRunoff} margin={{ top: 5, right: 5, bottom: 0, left: isMobile ? -18 : -14 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.lightBorder} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: C.structGrey, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.structGrey, fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="runoff" name="Runoff" fill={C.rainfallBlue} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{
              background: C.pureWhite, border: `1px solid ${C.lightBorder}`,
              borderRadius: "14px", padding: isMobile ? "0.85rem" : "1.25rem", boxShadow: C.shadowSm,
            }}>
              <SecTitle>Water Balance — WSE Model (m³)</SecTitle>
              <ResponsiveContainer width="100%" height={isMobile ? 180 : 200}>
                <LineChart data={waterBalance} margin={{ top: 5, right: 5, bottom: 0, left: isMobile ? -18 : -14 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.lightBorder} />
                  <XAxis dataKey="month" tick={{ fill: C.structGrey, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.structGrey, fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke={C.lightBorder} />
                  <Line type="monotone" dataKey="inflow" name="Inflow" stroke={C.rainfallBlue} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="demand" name="Demand" stroke={C.soilAmber} strokeWidth={2} dot={false} strokeDasharray="5 3" />
                  <Line type="monotone" dataKey="storage" name="Storage" stroke={C.rechargeGreen} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="deficit" name="Deficit" stroke={C.overflowRed} strokeWidth={1.5} dot={false} strokeDasharray="3 2" />
                </LineChart>
              </ResponsiveContainer>
              <div style={{
                display: "flex", gap: "1.2rem", marginTop: "0.6rem", paddingTop: "0.6rem",
                borderTop: `1px solid ${C.lightBorder}`, flexWrap: "wrap",
              }}>
                {[["Inflow", C.rainfallBlue], ["Demand", C.soilAmber], ["Storage", C.rechargeGreen], ["Deficit", C.overflowRed]].map(([l, col]) => (
                  <div key={l} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.68rem", color: C.structGrey }}>
                    <div style={{ width: "16px", height: "3px", background: col, borderRadius: "2px" }} />{l}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{
            background: C.pureWhite, border: `1px solid ${C.lightBorder}`,
            borderRadius: "14px", overflow: "hidden", boxShadow: C.shadowSm,
          }}>
            <div style={{ padding: isMobile ? "0.75rem 0.85rem" : "1rem 1.25rem", borderBottom: `1px solid ${C.lightBorder}` }}>
              <SecTitle color={C.hydroBlue}>Monthly Water Balance Table</SecTitle>
            </div>
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? "0.65rem" : "0.73rem", fontFamily: "'IBM Plex Mono', monospace", minWidth: isMobile ? "500px" : undefined }}>
                <thead>
                  <tr style={{ background: C.panelGrey }}>
                    {["Month", "Inflow m³", "Demand m³", "Storage m³", "Deficit m³", "Met m³"].map(h => (
                      <th key={h} style={{
                        padding: isMobile ? "0.5rem 0.6rem" : "0.6rem 0.9rem", textAlign: "right", color: C.structGrey,
                        fontSize: isMobile ? "0.58rem" : "0.63rem", fontWeight: 700, letterSpacing: "0.06em",
                        whiteSpace: "nowrap", textTransform: "uppercase",
                        borderBottom: `2px solid ${C.lightBorder}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {waterBalance.map((row, i) => (
                    <tr key={row.month} style={{
                      background: i % 2 === 0 ? C.pureWhite : C.panelGrey,
                      transition: "background 0.15s ease",
                    }}>
                      <td style={{ padding: isMobile ? "0.4rem 0.6rem" : "0.5rem 0.9rem", color: C.graphite, fontWeight: 700 }}>{row.month}</td>
                      <td style={{ padding: isMobile ? "0.4rem 0.6rem" : "0.5rem 0.9rem", textAlign: "right", color: C.rainfallBlue, fontWeight: 600 }}>{row.inflow}</td>
                      <td style={{ padding: isMobile ? "0.4rem 0.6rem" : "0.5rem 0.9rem", textAlign: "right", color: C.soilAmber, fontWeight: 600 }}>{row.demand}</td>
                      <td style={{ padding: isMobile ? "0.4rem 0.6rem" : "0.5rem 0.9rem", textAlign: "right", color: C.rechargeGreen, fontWeight: 600 }}>{row.storage}</td>
                      <td style={{ padding: isMobile ? "0.4rem 0.6rem" : "0.5rem 0.9rem", textAlign: "right", color: row.deficit > 0 ? C.overflowRed : C.structGrey, fontWeight: 600 }}>{row.deficit}</td>
                      <td style={{ padding: isMobile ? "0.4rem 0.6rem" : "0.5rem 0.9rem", textAlign: "right", color: C.hydroBlue, fontWeight: 600 }}>{row.met}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Design */}
      {activeTab === "design" && (
        <>
          <SecTitle color={C.hydroBlue} icon="📐">Site-Specific Design Parameters · IS:15797:2008</SecTitle>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: isMobile ? "0.75rem" : "1rem", marginBottom: isMobile ? "0.75rem" : "1rem" }}>
            {[
              { title:"RCC Underground Tank", sub:"Storage Tank", bg:C.hydroBlue, rows:[
                ["Capacity", `${tankSize} m³ (${(tankSize*1000).toFixed(0)} L)`],
                ["L × B × D", `${dp.tankL}m × ${dp.tankB}m × ${dp.tankD}m`, "L:B:D = 2:1:1.5 ratio"],
                ["First-Flush Vol", `${dp.firstFlushVol} L`, "Roof area ÷ 40 · IS:15797"],
                ["First-Flush Pipe", `${dp.pipeDia}mm PVC`],
                ["Tank Material", "RCC / Ferro-cement", "IS:3370 compliance"],
              ]},
              { title:"Dual-Media Filter", sub:"Filtration System", bg:C.aquiferTeal, rows:[
                ["Filter Bed Area", `${dp.filterArea} m²`, "Roof area ÷ 50"],
                ["Filter Diameter", `${dp.filterDia}m`, "Circular bed"],
                ["Gravel Layer", "300mm", "20–40mm graded gravel"],
                ["Sand Layer", "300mm", "Fine sand 0.6–2mm"],
                ["Total Depth", "600mm", "IS:15797 Clause 5.4"],
              ]},
              { title:"Gutters & Downpipes", sub:"Conveyance System", bg:C.monsoonBlue, rows:[
                ["Design Intensity", "25 mm/hr", "Marathwada design storm"],
                ["Peak Runoff", `${(dp.peakFlow*1000).toFixed(2)} L/s`, "Q = C·I·A / 36"],
                ["Pipe Diameter", `${dp.pipeDia}mm PVC`, "Manning n = 0.01"],
                ["Flow Velocity", `${dp.velocity} m/s`, "Half-full design"],
                ["Gutter Slope", "1:200 min", "IS:1742 recommendation"],
              ]},
            ].map(({ title, sub, bg, rows }) => (
              <div key={title} style={{
                border: `1px solid ${C.lightBorder}`, borderRadius: "14px",
                overflow: "hidden", boxShadow: C.shadowSm,
                transition: "all 0.2s ease",
              }}>
                <div style={{ background: bg, padding: "0.75rem 1rem" }}>
                  <div style={{
                    fontSize: "0.58rem", color: "rgba(255,255,255,0.6)",
                    letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600,
                  }}>{sub}</div>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                    fontSize: "1.1rem", color: "#fff", marginTop: "0.1rem",
                  }}>{title}</div>
                </div>
                <div style={{ background: C.panelGrey }}>
                  {rows.map(([l, v, n]) => <DesignRow key={l} label={l} value={v} note={n} />)}
                </div>
              </div>
            ))}
          </div>
          <div style={{
            background: `linear-gradient(135deg, ${C.hydroBlue}06, ${C.aquiferTeal}04)`,
            border: `1px dashed ${C.hydroBlue}20`, borderRadius: "14px",
            padding: "1rem 1.25rem",
          }}>
            <SecTitle color={C.aquiferTeal}>Engine Equations</SecTitle>
            <div style={{
              display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: "0.5rem 2rem", fontSize: "0.75rem", color: C.graphite,
              lineHeight: 2.2, fontFamily: "'IBM Plex Mono', monospace",
            }}>
              {["Q = P × A × C × (1−FF) / 1000", "S_t = min(max(S_(t-1)+Q_t−D_t,0),Cap)", "WSE = Σmet / Σdemand × 100", "V_dry = t × n × q × 0.4", "Q_peak = C × I × A / 36", "Manning: V = (1/n) × R^(2/3) × S^(1/2)"].map(eq => (
                <div key={eq} style={{ padding: "0.2rem 0", borderBottom: `1px solid ${C.lightBorder}40` }}>{eq}</div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Recharge */}
      {activeTab === "recharge" && (
        <>
          <div style={{
            background: C.pureWhite, border: `1px solid ${C.lightBorder}`,
            borderRadius: "14px", padding: isMobile ? "0.85rem" : "1.5rem", marginBottom: isMobile ? "0.75rem" : "1rem", boxShadow: C.shadowSm,
          }}>
            <SecTitle>Recharge System Recommendation · CGWB</SecTitle>
            <div style={{ display: "flex", alignItems: "flex-start", gap: isMobile ? "1rem" : "1.8rem", flexWrap: "wrap" }}>
              <ScoreMeter score={rScore} />
              <div style={{ flex: 1, minWidth: "220px", borderLeft: `2px solid ${C.lightBorder}`, paddingLeft: "1.5rem" }}>
                <div style={{
                  fontSize: "0.62rem", color: C.structGrey, letterSpacing: "0.1em",
                  textTransform: "uppercase", marginBottom: "0.3rem", fontWeight: 600,
                }}>Recommended Structure</div>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                  fontSize: "1.5rem", color: C.hydroBlue, marginBottom: "0.4rem",
                }}>{rRec.type}</div>
                <div style={{ fontSize: "0.75rem", color: C.structGrey, lineHeight: 1.6, marginBottom: "0.4rem" }}>{rRec.reason}</div>
                <div style={{
                  fontSize: "0.7rem", color: "#94a3b8", fontFamily: "'IBM Plex Mono', monospace",
                  marginBottom: "0.6rem",
                }}>{rRec.dim}</div>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "0.4rem",
                  padding: "0.3rem 0.75rem", borderRadius: "100px",
                  background: `${priorityColor}10`, border: `1px solid ${priorityColor}25`,
                }}>
                  <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: priorityColor }} />
                  <span style={{ fontSize: "0.63rem", color: priorityColor, fontWeight: 700, letterSpacing: "0.08em" }}>{rRec.priority} PRIORITY</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{
            background: C.pureWhite, border: `1px solid ${C.lightBorder}`,
            borderRadius: "14px", padding: "1.25rem", boxShadow: C.shadowSm,
          }}>
            <SecTitle>CGWB Recharge Decision Matrix</SecTitle>
            {[["GW Depth < 5m", "Recharge Shaft", C.monsoonBlue], ["Clay / k < 0.1", "Storage Only", C.overflowRed], ["Slope > 10%", "Recharge Trench", C.soilAmber], ["Score ≥ 70", "Pit + Storage", C.rechargeGreen], ["Score 40–70", "Recharge Pit", C.aquiferTeal], ["Score < 40", "Storage Tank Only", C.structGrey]].map(([cond, res, col]) => (
              <div key={cond} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "0.6rem 0", borderBottom: `1px solid ${C.lightBorder}`,
              }}>
                <span style={{ fontSize: "0.75rem", color: C.structGrey }}>{cond}</span>
                <span style={{ fontSize: "0.75rem", color: col, fontWeight: 700 }}>→ {res}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Summary */}
      {activeTab === "summary" && (
        <div style={{
          background: C.pureWhite, border: `1px solid ${C.lightBorder}`,
          borderRadius: "14px", overflow: "hidden", boxShadow: C.shadowSm,
        }}>
          <div style={{
            padding: "1rem 1.25rem", borderBottom: `1px solid ${C.lightBorder}`,
            background: `linear-gradient(135deg, ${C.hydroBlue}08, ${C.aquiferTeal}05)`,
          }}>
            <SecTitle color={C.hydroBlue}>Complete Assessment Summary</SecTitle>
          </div>
          {[
            ["District", district], ["Annual Rainfall", `${rainNum} mm`], ["Ground Slope", `${slopeNum}%`],
            ["Total Roof Area", `${totalArea.toFixed(0)} m²`], ["Roof Blocks", roofBlocks.length],
            ["Weighted Coeff C", weightedC.toFixed(3)], ["First-Flush Loss", `${firstFlushPct}%`],
            ["Annual Runoff", `${annualRunoff.toFixed(1)} m³/yr`], ["Building Type", buildingType],
            ["Population", popNum], ["LPCD", `${lpcd} L/day/person`],
            ["Daily Demand", `${(dailyDemand * 1000).toFixed(0)} L/day`],
            ["Annual Demand", `${annualDemand.toFixed(1)} m³/yr`], ["Supply Ratio", supplyRatio.toFixed(3)],
            ["Tank (Ratio)", `${tankSizeRatio} m³`], ["Tank (Dry-Period)", `${tankSizeDryPd} m³`],
            ["Recommended Tank", `${tankSize} m³`], ["Tank Dims", `${dp.tankL}×${dp.tankB}×${dp.tankD}m`],
            ["First-Flush Vol", `${dp.firstFlushVol} L`], ["Filter Bed", `${dp.filterArea}m² · ∅${dp.filterDia}m`],
            ["Downpipe", `${dp.pipeDia}mm PVC`], ["Peak Flow", `${(dp.peakFlow * 1000).toFixed(2)} L/s`],
            ["WSE", `${wse}%`], ["Reliability", `${reliability}%`], ["Non-Potable Cover", `${nonPotableWse}%`],
            ["Soil Type", soilType], ["GW Depth", `${gwDepth}m BGL`],
            ["Recharge Score", `${rScore}/100`], ["Recharge System", rRec.type], ["Dry Months", `${dryMos} months`],
          ].map(([k, v], i) => (
            <div key={k} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: isMobile ? "0.5rem 0.85rem" : "0.55rem 1.25rem", borderBottom: `1px solid ${C.lightBorder}`,
              background: i % 2 === 0 ? C.pureWhite : C.panelGrey, gap: "0.75rem",
            }}>
              <span style={{ fontSize: isMobile ? "0.68rem" : "0.75rem", color: C.structGrey, flexShrink: 0 }}>{k}</span>
              <span style={{
                fontSize: isMobile ? "0.68rem" : "0.75rem", color: C.graphite, fontWeight: 600,
                textAlign: "right", fontFamily: "'IBM Plex Mono', monospace",
              }}>{v}</span>
            </div>
          ))}
          {/* Copy / Export buttons */}
          <div style={{
            display: "flex", gap: isMobile ? "0.4rem" : "0.6rem", padding: isMobile ? "0.75rem 0.85rem" : "0.85rem 1.25rem",
            borderBottom: `1px solid ${C.lightBorder}`,
          }}>
            <button
              onClick={() => {
                const rows = [
                  ["District", district], ["Annual Rainfall", `${rainNum} mm`], ["Ground Slope", `${slopeNum}%`],
                  ["Total Roof Area", `${totalArea.toFixed(0)} m²`], ["Roof Blocks", roofBlocks.length],
                  ["Weighted Coeff C", weightedC.toFixed(3)], ["First-Flush Loss", `${firstFlushPct}%`],
                  ["Annual Runoff", `${annualRunoff.toFixed(1)} m³/yr`], ["Building Type", buildingType],
                  ["Population", popNum], ["LPCD", `${lpcd} L/day/person`],
                  ["Daily Demand", `${(dailyDemand * 1000).toFixed(0)} L/day`],
                  ["Annual Demand", `${annualDemand.toFixed(1)} m³/yr`], ["Supply Ratio", supplyRatio.toFixed(3)],
                  ["Tank (Ratio)", `${tankSizeRatio} m³`], ["Tank (Dry-Period)", `${tankSizeDryPd} m³`],
                  ["Recommended Tank", `${tankSize} m³`], ["Tank Dims", `${dp.tankL}×${dp.tankB}×${dp.tankD}m`],
                  ["First-Flush Vol", `${dp.firstFlushVol} L`], ["Filter Bed", `${dp.filterArea}m² · ∅${dp.filterDia}m`],
                  ["Downpipe", `${dp.pipeDia}mm PVC`], ["Peak Flow", `${(dp.peakFlow * 1000).toFixed(2)} L/s`],
                  ["WSE", `${wse}%`], ["Reliability", `${reliability}%`], ["Non-Potable Cover", `${nonPotableWse}%`],
                  ["Soil Type", soilType], ["GW Depth", `${gwDepth}m BGL`],
                  ["Recharge Score", `${rScore}/100`], ["Recharge System", rRec.type],
                ];
                const text = `JalSetu — Rooftop RWH Assessment\n${"─".repeat(40)}\n${rows.map(([k, v]) => `${k.padEnd(22)} ${v}`).join("\n")}`;
                navigator.clipboard.writeText(text).then(() => alert("Summary copied to clipboard!"));
              }}
              style={{
                flex: 1, padding: "0.55rem", background: C.hydroBluePale, border: `1px solid ${C.hydroBlue}30`,
                borderRadius: "8px", color: C.hydroBlue, fontSize: "0.72rem", fontWeight: 700,
                cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
              }}
            >📋 Copy Summary</button>
            <button
              onClick={() => {
                const data = {
                  app: "JalSetu v6", generatedAt: new Date().toISOString(),
                  site: { district, rainfall: rainNum, slope: slopeNum, firstFlushPct, dryMonths: dryMos, gwDepth, soilType },
                  catchment: { totalArea, weightedC, roofBlocks, annualRunoff },
                  demand: { buildingType, population: popNum, lpcd, dailyDemand, annualDemand, supplyRatio },
                  tank: { tankSize, tankSizeRatio, tankSizeDryPd, dims: { L: dp.tankL, B: dp.tankB, D: dp.tankD } },
                  performance: { wse, reliability, nonPotableWse },
                  recharge: { score: rScore, system: rRec.type, priority: rRec.priority },
                };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = `jalsetu-report-${district.toLowerCase()}.json`;
                a.click(); URL.revokeObjectURL(url);
              }}
              style={{
                flex: 1, padding: "0.55rem", background: C.rechargeGreenPale, border: `1px solid ${C.rechargeGreen}30`,
                borderRadius: "8px", color: C.rechargeGreen, fontSize: "0.72rem", fontWeight: 700,
                cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
              }}
            >📥 Export JSON</button>
          </div>
          <div style={{
            padding: "0.9rem 1.25rem", background: `linear-gradient(135deg, ${C.hydroBlue}06, ${C.aquiferTeal}04)`,
            fontSize: "0.7rem", color: C.structGrey, lineHeight: 1.8,
          }}>
            <strong style={{ color: C.hydroBlue }}>Standards: </strong>IS:15797:2008 · IS:1172 · IS:3370 · CGWB Guidelines &nbsp;·&nbsp;
            <span style={{ color: C.aquiferTeal, cursor: "pointer", fontWeight: 600 }} onClick={() => setActiveTab("references")}>View full references →</span>
          </div>
        </div>
      )}
      {/* References */}
      {activeTab === "references" && (
        <div style={{ display:"flex", flexDirection:"column", gap:"0.85rem" }}>
          <div style={{ background:C.pureWhite, border:`1px solid ${C.lightBorder}`, borderRadius:"10px", overflow:"hidden", boxShadow:"0 1px 4px rgba(15,76,129,0.06)" }}>
            <div style={{ background:C.deepBlue, padding:"0.75rem 1.1rem" }}>
              <div style={{ fontSize:"0.58rem", color:"rgba(255,255,255,0.55)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"0.2rem" }}>Indian Standards & Government Guidelines</div>
              <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:"1.1rem", color:"#fff" }}>Standards & Codes</div>
            </div>
            {[
              ["IS:15797:2008", "Rainwater Harvesting — Code of Practice", "Bureau of Indian Standards, New Delhi", "Runoff coefficients, tank sizing, filter design, first-flush calculations"],
              ["IS:1172:1993", "Code of Basic Requirements for Water Supply, Drainage and Sanitation", "Bureau of Indian Standards, New Delhi", "Per-capita water demand (LPCD) for various building types"],
              ["IS:3370:2009", "Code of Practice for Concrete Structures for Storage of Liquids", "Bureau of Indian Standards, New Delhi", "RCC underground tank design and compliance"],
              ["IS:1742:1983", "Code of Practice for Building Drainage", "Bureau of Indian Standards, New Delhi", "Gutter slope, downpipe sizing recommendations"],
              ["CGWB, 2013", "Master Plan for Artificial Recharge to Ground Water in India", "Central Ground Water Board, Ministry of Jal Shakti, GoI", "Recharge structure selection, aquifer suitability, decision matrix"],
              ["GoI RWH Manual", "Rooftop Rainwater Harvesting — A Practical Guide", "Ministry of Jal Shakti, Government of India", "Dry-period tank sizing method (V = t × n × q × 0.4)"],
            ].map(([code, title, org, use]) => (
              <div key={code} style={{ padding:"0.75rem 1.1rem", borderBottom:`1px solid ${C.lightBorder}`, display:"flex", gap:"1rem", alignItems:"flex-start" }}>
                <div style={{ minWidth:"110px", flexShrink:0 }}>
                  <div style={{ fontSize:"0.68rem", fontWeight:700, color:C.hydroBlue, fontFamily:"'IBM Plex Mono', monospace" }}>{code}</div>
                </div>
                <div>
                  <div style={{ fontSize:"0.78rem", fontWeight:600, color:C.graphite, marginBottom:"0.18rem" }}>{title}</div>
                  <div style={{ fontSize:"0.67rem", color:C.structGrey, marginBottom:"0.18rem" }}>{org}</div>
                  <div style={{ fontSize:"0.63rem", color:"#94a3b8", fontStyle:"italic" }}>Used for: {use}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background:C.pureWhite, border:`1px solid ${C.lightBorder}`, borderRadius:"10px", overflow:"hidden", boxShadow:"0 1px 4px rgba(15,76,129,0.06)" }}>
            <div style={{ background:C.monsoonBlue, padding:"0.75rem 1.1rem" }}>
              <div style={{ fontSize:"0.58rem", color:"rgba(255,255,255,0.55)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"0.2rem" }}>Peer-Reviewed Journal Articles</div>
              <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:"1.1rem", color:"#fff" }}>Research Papers</div>
            </div>
            {[
              ["Patil et al., 2023", "Rooftop Rainwater Harvesting Potential Assessment for Marathwada Region", "Journal of Water Resource Engineering, Dr. BAMU Osmanabad", "Runoff coefficient validation for Deccan basalt region; <0.1% deviation benchmark"],
              ["Chowdhury & Akter, 2026", "Water Saving Efficiency (WSE) Metric for Decentralised RWH Systems", "Water Supply & Sanitation Journal, Vol. 14", "WSE formula (Σmet / Σdemand × 100), water balance modelling methodology"],
              ["Kiran & Kumar, 2023", "First-Flush Volume Estimation for Urban Rooftop Catchments", "Indian Journal of Environmental Engineering", "10% first-flush loss recommendation, roof contamination modelling"],
              ["Akhtar, 2023", "Tank Sizing Methodologies for Monsoon-Dependent Catchments", "Hydrology Journal of India, Vol. 8", "Ratio-method tank sizing; supply-to-demand ratio classification"],
              ["Hari, 2019", "Runoff Coefficients for Varied Roof Materials in Semi-Arid India", "Journal of Applied Hydrology", "Asbestos/AC sheet C = 0.85; field measurement dataset"],
              ["Meenakshi, 2022", "Performance of Mangalore Tile Roofs as Rainwater Catchment", "Indian Water Works Association Journal", "Mangalore/Clay tile C = 0.85; pilot study findings"],
              ["Villar-Navascués et al., 2020", "Runoff Coefficients for Asphalt Roofing Membranes", "Water Resources Research, Vol. 56", "Asphalt sheet C = 0.70; European and tropical validation"],
              ["Farreny et al., 2011", "Roof Selection for Rainwater Harvesting: Quantity and Quality Assessments", "Water Research, Vol. 45(10)", "Gravel roof C = 0.62; quality and quantity trade-off analysis"],
              ["Singh & Turkiya, 2017", "Evaluation of Rooftop RWH Potential Using GIS: Rural India", "International Journal of Water Resources Development", "Thatch / non-cemented roof C = 0.50; rural catchment characterisation"],
            ].map(([author, title, journal, use]) => (
              <div key={author} style={{ padding:"0.75rem 1.1rem", borderBottom:`1px solid ${C.lightBorder}`, display:"flex", gap:"1rem", alignItems:"flex-start", flexWrap: isMobile ? "wrap" : "nowrap" }}>
                <div style={{ minWidth:"140px", flexShrink:0 }}>
                  <div style={{ fontSize:"0.68rem", fontWeight:700, color:C.monsoonBlue, fontFamily:"'IBM Plex Mono', monospace", lineHeight:1.4 }}>{author}</div>
                </div>
                <div>
                  <div style={{ fontSize:"0.78rem", fontWeight:600, color:C.graphite, marginBottom:"0.18rem" }}>{title}</div>
                  <div style={{ fontSize:"0.67rem", color:C.structGrey, marginBottom:"0.18rem", fontStyle:"italic" }}>{journal}</div>
                  <div style={{ fontSize:"0.63rem", color:"#94a3b8" }}>Used for: {use}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background:`${C.aquiferTeal}0d`, border:`1px dashed ${C.aquiferTeal}40`, borderRadius:"9px", padding:"0.85rem 1.1rem", fontSize:"0.68rem", color:C.structGrey, lineHeight:1.8 }}>
            <strong style={{ color:C.aquiferTeal, display:"block", marginBottom:"0.3rem", letterSpacing:"0.07em", textTransform:"uppercase", fontSize:"0.62rem" }}>📋 Citation Note</strong>
            All runoff coefficients, demand values, and structural sizing follow IS:15797:2008 as the primary standard. Research papers provide regional validation and extended methodology. CGWB guidelines govern groundwater recharge structure selection.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── STICKY LIVE SUMMARY CARD ────────────────────────────────────────────────
function StickyLiveCard({ show, onToggle, annualRunoff, wse, tankSize, supplyRatio, isMobile, isTablet }) {
  if (isMobile || isTablet) return null;
  return (
    <div style={{
      position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 50,
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      transform: show ? "translateY(0)" : "translateY(calc(100% - 44px))",
    }}>
      <div style={{
        background: C.pureWhite, border: `1px solid ${C.lightBorder}`,
        borderRadius: "14px", boxShadow: C.shadowLg, overflow: "hidden",
        width: "280px",
      }}>
        <button onClick={onToggle} style={{
          width: "100%", padding: "0.6rem 0.9rem",
          background: `linear-gradient(135deg, ${C.deepBlue}, ${C.hydroBlue})`,
          border: "none", cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "space-between", color: "#fff",
        }}>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            ⚡ Live Summary
          </span>
          <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>{show ? "▼" : "▲"}</span>
        </button>
        {show && (
          <div style={{ padding: "0.75rem 0.9rem" }}>
            {[
              ["Runoff", `${annualRunoff.toFixed(0)} m³/yr`, C.hydroBlue],
              ["WSE", `${wse}%`, wse >= 60 ? C.rechargeGreen : wse >= 35 ? C.soilAmber : C.overflowRed],
              ["Tank", `${tankSize} m³`, C.monsoonBlue],
              ["Ratio", supplyRatio.toFixed(2), supplyRatio >= 1 ? C.rechargeGreen : C.overflowRed],
            ].map(([label, val, col]) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "0.25rem 0", fontSize: "0.73rem",
              }}>
                <span style={{ color: C.structGrey }}>{label}</span>
                <strong style={{ color: col, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.9rem" }}>{val}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LOCAL STORAGE HELPERS ────────────────────────────────────────────────────
const STORAGE_KEY = "jalsetu_v6_state";

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved && typeof saved === "object" && saved.district) return saved;
  } catch {}
  return null;
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

// ─── ANIMATED NUMBER COMPONENT ───────────────────────────────────────────────
function AnimatedNumber({ value, duration = 400, decimals = 0, suffix = "" }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const frameRef = useRef(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = typeof value === "number" ? value : parseFloat(value) || 0;
    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
      else prevRef.current = to;
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [value, duration]);

  return <>{typeof display === "number" ? display.toFixed(decimals) : display}{suffix}</>;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function JalSetuV6() {
  const saved = useRef(loadSavedState()).current;

  const [step,          setStep]         = useState(1);
  const [district,      setDistrict]     = useState(saved?.district ?? "Amravati");
  const [customGW,      setCustomGW]     = useState(saved?.customGW ?? 12);
  const [rainfall,      setRainfall]     = useState(saved?.rainfall ?? 870);
  const [slope,         setSlope]        = useState(saved?.slope ?? 2);
  const [firstFlushPct, setFirstFlushPct]= useState(saved?.firstFlushPct ?? 10);
  const [dryMonths,     setDryMonths]    = useState(saved?.dryMonths ?? 8);
  const [buildingType,  setBuildingType] = useState(saved?.buildingType ?? "Residential");
  const [population,    setPopulation]   = useState(saved?.population ?? 6);
  const [customLPCD,    setCustomLPCD]   = useState(saved?.customLPCD ?? "");
  const [soilType,      setSoilType]     = useState(saved?.soilType ?? "Black Cotton Soil");
  const [roofBlocks,    setRoofBlocks]   = useState(saved?.roofBlocks ?? [
    { id: 1, length: 15, width: 12, roofType: "RCC / Concrete (Flat)" }
  ]);
  const [screenSize, setScreenSize] = useState("desktop");
  const [showResults,   setShowResults]  = useState(false);
  const [showSticky,    setShowSticky]   = useState(false);
  const nextId = useRef(saved ? (Math.max(...(saved?.roofBlocks ?? []).map(b => b.id), 0) + 1) : 2);
  const isMobile = screenSize === "mobile";
  const isTablet = screenSize === "tablet";

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      if (w < 640) setScreenSize("mobile");
      else if (w < 1100) setScreenSize("tablet");
      else setScreenSize("desktop");
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Auto-save to localStorage on every state change
  useEffect(() => {
    saveState({ district, customGW, rainfall, slope, firstFlushPct, dryMonths,
      buildingType, population, customLPCD, soilType, roofBlocks });
  }, [district, customGW, rainfall, slope, firstFlushPct, dryMonths,
      buildingType, population, customLPCD, soilType, roofBlocks]);

  const addBlock = useCallback(() => {
    if (roofBlocks.length >= 6) return;
    setRoofBlocks(b => [...b, { id: nextId.current++, length: 10, width: 8, roofType: "RCC / Concrete (Flat)" }]);
  }, [roofBlocks.length]);

  const onUpdate = useCallback((id, key, val) => {
    setRoofBlocks(b => b.map(bl => bl.id === id ? { ...bl, [key]: val } : bl));
  }, []);

  const onRemove = useCallback((id) => {
    setRoofBlocks(b => b.filter(bl => bl.id !== id));
  }, []);

  // ── All derived values ──
  const gwInfo        = GW_ZONES[district] || GW_ZONES["Custom"];
  const gwDepth       = district === "Custom" ? (parseFloat(customGW) || 0) : (gwInfo.depth || 0);
  const rainNum       = parseFloat(rainfall) || 0;
  const popNum        = Math.max(parseInt(population) || 0, 0);
  const slopeNum      = parseFloat(slope) || 0;
  const ffFactor      = Math.min((parseFloat(firstFlushPct) || 0) / 100, 0.25);
  const dryMos        = Math.min(parseInt(dryMonths) || 8, 11);
  const lpcd          = (customLPCD !== "" && !isNaN(parseFloat(customLPCD)) && parseFloat(customLPCD) > 0)
                          ? parseFloat(customLPCD) : BUILDING_TYPES[buildingType].lpcd;
  const nonPotablePct = BUILDING_TYPES[buildingType].nonPotablePct;
  const totalArea     = roofBlocks.reduce((s, b) => s + Math.max((parseFloat(b.length)||0)*(parseFloat(b.width)||0),0), 0);
  const weightedC     = totalArea > 0
    ? roofBlocks.reduce((s,b) => { const a=Math.max((parseFloat(b.length)||0)*(parseFloat(b.width)||0),0); return s+a*(RUNOFF_COEFFICIENTS[b.roofType]?.C||0.80); }, 0) / totalArea
    : 0.80;
  const annualRunoff  = calcMultiBlockRunoff(roofBlocks, rainNum, ffFactor);
  const monthlyRunoff = calcMonthlyRunoff(rainNum, totalArea, weightedC, ffFactor);
  const dailyDemand   = (popNum * lpcd) / 1000;
  const annualDemand  = dailyDemand * 365;
  const supplyRatio   = annualDemand > 0 ? annualRunoff / annualDemand : 0;
  const tankSizeRatio = calcRatioTank(annualRunoff, annualDemand);
  const tankSizeDryPd = calcDryPeriodTank(popNum, lpcd, dryMos);
  const tankSize      = Math.max(tankSizeRatio, tankSizeDryPd);
  const waterBalance  = calcWaterBalance(monthlyRunoff, dailyDemand, tankSize);
  const wse           = calcWSE(waterBalance);
  const reliability   = calcReliability(waterBalance);
  const rScore        = calcRechargeScore(gwDepth, soilType, slopeNum, rainNum);
  const rRec          = calcRechargeRec(rScore, gwDepth, soilType, slopeNum);
  const dp            = calcDesignParams(totalArea, tankSize, weightedC, rainNum);
  const nonPotableAnn = annualDemand * nonPotablePct;
  const nonPotableWse = nonPotableAnn > 0 ? Math.min((annualRunoff / nonPotableAnn) * 100, 100).toFixed(1) : "0";
  const rechargeColor = gwInfo.recharge === "Good" ? C.rechargeGreen : gwInfo.recharge === "Poor" ? C.overflowRed : gwInfo.recharge === "Unknown" ? C.structGrey : C.soilAmber;
  const priorityColor = rRec.priority === "HIGH" ? C.rechargeGreen : rRec.priority === "MEDIUM" ? C.soilAmber : C.structGrey;

  const steps = ["Site & Rain", "Roof Blocks", "Demand", "Subsurface"];

  // Step completion: each step is "complete" if it has valid required data
  const completedSteps = [
    // Step 1: district, rainfall, slope set
    (district !== "" && rainNum > 0 && slopeNum >= 0),
    // Step 2: at least one block with area > 0
    (totalArea > 0),
    // Step 3: population > 0
    (popNum > 0),
    // Step 4: soilType selected
    (soilType !== ""),
  ].map((ok, i) => ok ? i + 1 : -1).filter(n => n > 0);

  const derived = {
    annualRunoff, annualDemand, dailyDemand, lpcd, firstFlushPct, wse, reliability,
    nonPotableWse, nonPotablePct, tankSize, tankSizeRatio, tankSizeDryPd, totalArea,
    roofBlocks, weightedC, dp, gwDepth, gwInfo, rechargeColor, monthlyRunoff, waterBalance,
    rScore, rRec, priorityColor, supplyRatio, dryMos, district, rainNum, slopeNum,
    soilType, popNum, buildingType, ffFactor,
  };

  const stepContent = (
    <div style={{ padding: isMobile ? "1rem" : "1.5rem", flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      {step === 1 && <Step1Panel district={district} setDistrict={setDistrict} rainfall={rainfall} setRainfall={setRainfall} slope={slope} setSlope={setSlope} firstFlushPct={firstFlushPct} setFirstFlushPct={setFirstFlushPct} dryMonths={dryMonths} setDryMonths={setDryMonths} customGW={customGW} setCustomGW={setCustomGW} gwInfo={gwInfo} rechargeColor={rechargeColor} annualRunoff={annualRunoff} />}
      {step === 2 && <Step2Panel roofBlocks={roofBlocks} addBlock={addBlock} onUpdate={onUpdate} onRemove={onRemove} totalArea={totalArea} weightedC={weightedC} annualRunoff={annualRunoff} />}
      {step === 3 && <Step3Panel buildingType={buildingType} setBuildingType={setBuildingType} population={population} setPopulation={setPopulation} customLPCD={customLPCD} setCustomLPCD={setCustomLPCD} lpcd={lpcd} nonPotablePct={nonPotablePct} dailyDemand={dailyDemand} annualDemand={annualDemand} supplyRatio={supplyRatio} />}
      {step === 4 && <Step4Panel soilType={soilType} setSoilType={setSoilType} rScore={rScore} rRec={rRec} />}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.mistWhite, fontFamily: "'IBM Plex Mono', monospace", color: C.graphite }}>
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=IBM+Plex+Mono:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html { -webkit-text-size-adjust: 100%; }
        input, select, button { font-family: 'IBM Plex Mono', monospace; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: ${C.concreteGrey}; border-radius: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        button:focus-visible {
          outline: 2px solid ${C.hydroBlue};
          outline-offset: 2px;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Mobile (<640px) ── */
        @media (max-width: 639px) {
          input, select { font-size: 16px !important; padding: 0.85rem 1rem !important; min-height: 48px; }
          .btn-nav, .btn-action { min-height: 44px !important; }
          .hide-mobile { display: none !important; }
        }

        /* ── Tablet (640–1099px) ── */
        @media (min-width: 640px) and (max-width: 1099px) {
          .hide-tablet { display: none !important; }
        }

        /* ── Desktop (≥1100px) ── */
        @media (min-width: 1100px) {
          .hide-desktop { display: none !important; }
        }

        /* ── Print ── */
        @media print {
          body { background: #fff !important; }
          * { box-shadow: none !important; }
          button, nav, [data-no-print], .no-print { display: none !important; }
          .results-panel { padding: 0 !important; background: #fff !important; }
          .results-panel > div { break-inside: avoid; }
          table { page-break-inside: avoid; }
          .metric-card { break-inside: avoid; }
          a { text-decoration: none; color: inherit; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print" style={{
        background: `linear-gradient(135deg, ${C.deepBlue}, ${C.hydroBlue})`,
        padding: isMobile ? "0 1rem" : "0 1.5rem", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: "60px", flexShrink: 0,
        borderBottom: `2px solid ${C.aquiferTeal}40`,
        boxShadow: "0 2px 12px rgba(10,53,96,0.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "0.6rem" : "0.9rem" }}>
          <div style={{
            width: isMobile ? "32px" : "38px", height: isMobile ? "32px" : "38px", borderRadius: isMobile ? "8px" : "10px",
            background: "rgba(66,165,245,0.15)", border: "1px solid rgba(66,165,245,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, overflow: "hidden",
          }}>
            <svg width="26" height="26" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="32" cy="38" rx="16" ry="13" fill="#8B5E3C"/>
              <ellipse cx="32" cy="22" rx="12" ry="11" fill="#A0714F"/>
              <ellipse cx="22" cy="13" rx="5" ry="6" fill="#8B5E3C"/>
              <ellipse cx="22" cy="13" rx="3" ry="4" fill="#C4896A"/>
              <ellipse cx="42" cy="13" rx="5" ry="6" fill="#8B5E3C"/>
              <ellipse cx="42" cy="13" rx="3" ry="4" fill="#C4896A"/>
              <circle cx="27" cy="20" r="2.5" fill="#1E293B"/>
              <circle cx="37" cy="20" r="2.5" fill="#1E293B"/>
              <circle cx="27.8" cy="19.2" r="0.8" fill="#fff"/>
              <circle cx="37.8" cy="19.2" r="0.8" fill="#fff"/>
              <ellipse cx="32" cy="26" rx="4" ry="2.5" fill="#5C3A1E"/>
              <rect x="29" y="27.5" width="3" height="4" rx="1" fill="#F0F5FA"/>
              <rect x="32.5" y="27.5" width="3" height="4" rx="1" fill="#F0F5FA"/>
              <ellipse cx="32" cy="54" rx="13" ry="6" fill="#5C3A1E"/>
              <ellipse cx="32" cy="54" rx="10" ry="4" fill="#6B4226" opacity="0.6"/>
              <path d="M16 48 Q24 44 32 48 Q40 52 48 48" stroke="#42A5F5" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7"/>
            </svg>
          </div>
          <div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
              fontSize: isMobile ? "1.1rem" : "1.3rem", color: "#fff", letterSpacing: "0.04em", lineHeight: 1,
            }}>
              JalSetu <span style={{ fontSize: "0.65rem", fontWeight: 500, opacity: 0.5, marginLeft: "0.2rem" }}>v6</span>
            </div>
            <div style={{
              fontSize: isMobile ? "0.45rem" : "0.52rem", color: "rgba(255,255,255,0.45)", letterSpacing: "0.12em",
              textTransform: "uppercase", marginTop: "3px",
            }}>
              Rooftop RWH Assessment · IS:15797 · CGWB · Multi-Block · WSE
            </div>
          </div>
        </div>
        {!isMobile && (
          <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.35)", textAlign: "right", lineHeight: 1.8 }}>
            <div>IS:15797:2008 · IS:1172 · CGWB Guidelines</div>
            <div>Multi-Block WSE Engine</div>
          </div>
        )}
      </div>

      <div className="no-print">
        <StepBar step={step} steps={steps} onStep={setStep} completedSteps={completedSteps} isMobile={isMobile} />
      </div>

      {/* Mobile results overlay */}
      {(isMobile || isTablet) && showResults && (
        <div style={{
          position: "fixed", inset: 0, background: C.mistWhite, zIndex: 100,
          overflowY: "auto", paddingTop: "60px", animation: "fadeIn 0.2s ease",
        }}>
          <div style={{
            background: `linear-gradient(135deg, ${C.deepBlue}, ${C.hydroBlue})`,
            position: "fixed", top: 0, left: 0, right: 0, height: "60px",
            display: "flex", alignItems: "center", padding: "0 1.2rem", zIndex: 101, gap: "0.8rem",
            boxShadow: "0 2px 12px rgba(10,53,96,0.15)",
          }}>
            <button className="btn-action" onClick={() => setShowResults(false)} style={{
              background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
              color: "#fff", borderRadius: "8px", padding: isMobile ? "0.55rem 1rem" : "0.45rem 0.9rem",
              cursor: "pointer", minHeight: isMobile ? "44px" : undefined,
              fontFamily: "'IBM Plex Mono', monospace", fontSize: isMobile ? "0.82rem" : "0.78rem", fontWeight: 500,
              display: "flex", alignItems: "center", gap: "0.3rem", transition: "all 0.15s ease",
            }}>← Back</button>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
              color: "#fff", fontSize: "1.1rem",
            }}>Assessment Results</span>
          </div>
          <ResultsPanel isMobile={true} derived={derived} />
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: "flex", height: `calc(100vh - ${60 + 48}px)`, overflow: "hidden" }}>
        {/* Input panel */}
        <div style={{
          width: isMobile ? "100%" : isTablet ? "340px" : "380px",
          flexShrink: 0, background: C.pureWhite,
          borderRight: isMobile ? "none" : `1px solid ${C.lightBorder}`,
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {stepContent}
          {/* Nav buttons */}
          <div style={{
            padding: isMobile ? "0.85rem 1rem 1rem" : "1rem 1.5rem 1.25rem",
            borderTop: `1px solid ${C.lightBorder}`,
            background: C.pureWhite, display: "flex", gap: "0.7rem",
            flexShrink: 0, alignItems: "stretch",
          }}>
            {step > 1 && (
              <button className="btn-nav" onClick={() => setStep(s => Math.max(s - 1, 1))} style={{
                ...btnSecondary, flex: "0 0 auto", minWidth: isMobile ? "70px" : "85px",
                padding: isMobile ? "0.7rem 0.8rem" : undefined,
                fontSize: isMobile ? "0.78rem" : undefined,
              }}>← Back</button>
            )}
            <button className="btn-nav" onClick={() => {
              if (step < 4) setStep(s => s + 1);
              else if (isMobile || isTablet) setShowResults(true);
            }} style={{
              ...btnPrimary, flex: 1,
              background: step === 4
                ? `linear-gradient(135deg, ${C.rechargeGreen}, ${C.aquiferTeal})`
                : `linear-gradient(135deg, ${C.hydroBlue}, ${C.hydroBlueLight})`,
              fontSize: isMobile ? "0.78rem" : "0.85rem",
              padding: isMobile ? "0.7rem 1rem" : undefined,
            }}>
              {step < 4
                ? `Next: ${steps[step]} →`
                : (isMobile || isTablet) ? "📊 View Full Report" : "✓ Assessment Complete"}
            </button>
          </div>
        </div>
        {!isMobile && !isTablet && (
          <div style={{ flex: 1, overflowY: "auto", background: C.mistWhite }}>
            <ResultsPanel isMobile={false} derived={derived} />
          </div>
        )}
      </div>

      {/* Sticky live summary (desktop only) */}
      <div className="no-print">
        <StickyLiveCard
        show={showSticky}
        onToggle={() => setShowSticky(s => !s)}
        annualRunoff={annualRunoff}
        wse={wse}
        tankSize={tankSize}
        supplyRatio={supplyRatio}
        isMobile={isMobile}
        isTablet={isTablet}
        />
      </div>
    </div>
  );
}
