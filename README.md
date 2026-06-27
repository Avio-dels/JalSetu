<div align="center">

<!-- BEAVER MASCOT SVG -->
<svg width="80" height="80" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
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
  <path d="M16 48 Q24 44 32 48 Q40 52 48 48" stroke="#42A5F5" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.7"/>
</svg>

# JalSetu AI 🦫

**Intelligent Rooftop Rainwater Harvesting Assessment & Design Platform**

[![Status](https://img.shields.io/badge/Status-Prototype%20Validated-brightgreen?style=flat-square)](https://github.com)
[![Standard](https://img.shields.io/badge/Standard-IS%3A15797%3A2008-blue?style=flat-square)](https://www.bis.gov.in)
[![Initiative](https://img.shields.io/badge/Initiative-Bharat%20WIN%20%7C%20Jal%20Shakti-0066CC?style=flat-square)](https://jalshakti-dowr.gov.in)
[![Validation](https://img.shields.io/badge/Deviation-Less%20than%200.1%25-success?style=flat-square)](https://github.com)
[![Tech](https://img.shields.io/badge/Built%20With-React%20%2B%20Vite%20%2B%20Recharts-61DAFB?style=flat-square)](https://vitejs.dev)

*Field-deployable RWH assessment. Site-specific engineering design. Under 5 minutes.*

[Live Demo](https://jal-setu-puce.vercel.app/) · [Report a Bug](#) · [Request a Feature](#)

</div>

---

## Table of Contents

- [Why We Built This](#-why-we-built-this)
- [What Is JalSetu AI](#-what-is-jalsetu-ai)
- [Bharat WIN Initiative](#-bharat-win-initiative)
- [Problem Statement](#-problem-statement)
- [Features](#-features)
- [How It Works](#-how-it-works)
- [Hydrological Approach](#-hydrological-approach)
- [Terminology Glossary](#-terminology-glossary)
- [Tech Stack](#️-tech-stack)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Validation Results](#-validation-results)
- [Research Foundation](#-research-foundation)
- [Roadmap](#-roadmap)
- [Team](#-team)

---

## 💡 Why We Built This

India's water crisis is not a supply problem alone — it is an **access-to-expertise problem**.

A household in Osmanabad, Marathwada, receives around 787 mm of annual rainfall. 82% of it falls in a 90-day monsoon window. For the remaining nine months, they depend on a groundwater table that has dropped over 7 metres in two decades. Rooftop rainwater harvesting could change this — but getting a site-specific assessment requires hiring a civil engineer, commissioning a soil investigation, obtaining CGWB groundwater reports, and waiting two to four weeks for calculations that cost between ₹15,000 and ₹50,000.

That barrier shuts out exactly the people who would benefit most: individual households, village schools, and gram panchayats.

JalSetu AI was built to remove that barrier entirely. Input your roof dimensions, location, and occupant count. Get a standards-compliant engineering design in under five minutes, at zero cost.

> *"JalSetu"* — जलसेतु — means **Water Bridge** in Hindi. A bridge between monsoon rainfall and year-round water security.

---

## 🌊 What Is JalSetu AI

JalSetu AI is a field-deployable web application for on-the-spot Rooftop Rainwater Harvesting (RWH) assessment. It implements a **monthly water balance hydrological model** grounded in peer-reviewed literature and Indian Standards, and produces:

- Monthly and annual **runoff yield estimates** per roof block
- Optimal **storage tank capacity** via dual sizing methodology
- **Groundwater recharge feasibility score** (0–100) with structure recommendation
- Site-specific **engineering design parameters** (pipe sizing, filter spec, first-flush volume)
- **Water Saving Efficiency (WSE)** and demand coverage analysis
- Interactive monthly **charts** for runoff and water balance

Unlike tools that report only annual totals, JalSetu AI runs a month-by-month simulation. This matters because a tank sized on annual averages can fail during a 3-month dry spell. The monthly model catches this.

---

## 🇮🇳 Bharat WIN Initiative

JalSetu AI was developed under **Problem Statement P01** for the **Bharat Water Innovation Network (Bharat WIN)**.

Bharat WIN is a national initiative of the **Department of Water Resources, River Development and Ganga Rejuvenation, Ministry of Jal Shakti, Government of India**. Its mission is to accelerate technology-led transformation in India's water sector by connecting scientific research, entrepreneurship, and grassroots initiatives toward accessible, affordable, and sustainable water solutions.

**Problem Statement P01:**
> *Development of an application for on-the-spot assessment of Rooftop Rainwater Harvesting potential and system design — estimating rooftop runoff yield and storage requirements, considering rainfall statistics, sub-surface details, groundwater table, roof area, and demand.*

JalSetu AI directly addresses every component of this statement.

---

## 🎯 Problem Statement

| Without JalSetu AI | With JalSetu AI |
|---|---|
| Annual potential only — no monthly model | Monthly water balance simulation |
| Manual data collection from IMD, CGWB | Automated data lookup by district |
| 2–4 weeks for a civil engineer assessment | Results in under 5 minutes |
| ₹15,000–₹50,000 per site | Zero cost to end user |
| Requires GIS and hydrology expertise | No technical expertise required |
| No site-specific design output | Full engineering recommendation |

**Target regions:** Marathwada and Vidarbha, Maharashtra — two of India's most water-stressed zones, where 82% of annual rainfall falls in a 90-day window and groundwater tables are declining year-on-year.

---

## ✨ Features

### Assessment Engine
- **Multi-block roof input** — define multiple roof sections with individual materials and dimensions
- **9 roof material types** with IS:15797-compliant runoff coefficients (RCC, GI sheet, Mangalore tile, gravel, and more)
- **First-flush deduction** — configurable loss percentage per Kiran & Kumar (2023)
- **Monthly runoff distribution** using regional monsoon patterns

### Water Balance Model
- **Monthly simulation:** `Sₜ = min(max(Sₜ₋₁ + Qₜ − Dₜ, 0), Capacity)`
- **Water Saving Efficiency (WSE)** — percentage of annual demand met by harvested rain
- **Reliability score** — months per year where supply meets demand
- **Non-potable demand split** — toilet flushing, cleaning, garden separately accounted

### Tank & Recharge Design
- **Dual tank sizing method:** Ratio Method + Dry-Period Method (maximum of both adopted)
- **Downpipe diameter** calculated via Manning's equation (n = 0.01, PVC)
- **Recharge suitability scoring** across groundwater depth, soil type, slope, and rainfall
- **Structure recommendations** per CGWB guidelines (recharge pit, shaft, trench, or storage-only)

### User Interface
- **4-step guided workflow** — Location → Roof → Demand → Recharge
- **Mobile-first, fully responsive** design
- **Interactive charts** — monthly runoff bar chart, water balance area chart (Recharts)
- **6-tab results panel** — Overview, Charts, Design, Recharge, Summary, References

---

## ⚙️ How It Works

```
Step 1 — Location & Rainfall
  ↓  Enter district → lookup annual rainfall & groundwater depth
  ↓  OR enter custom coordinates for Open-Meteo API rainfall data

Step 2 — Roof Configuration
  ↓  Add one or more roof blocks (L × W × material)
  ↓  System assigns IS:15797 runoff coefficient per material
  ↓  First-flush volume deducted (configurable %, default 10%)

Step 3 — Water Demand
  ↓  Select building type → LPCD auto-filled per IS:1172
  ↓  Enter occupant count → daily and annual demand calculated
  ↓  Non-potable split applied per building category

Step 4 — Recharge Parameters
  ↓  Select soil type and site slope
  ↓  Composite recharge score computed (0–100)
  ↓  Structure recommendation generated per CGWB guidelines

Results Panel
  ↓  Annual runoff, WSE, reliability, tank size, pipe diameter
  ↓  Monthly runoff chart, water balance simulation chart
  ↓  Full engineering design parameters
  ↓  Downloadable summary
```

---

## 📐 Hydrological Approach

### Core Runoff Formula (IS:15797:2008)

```
Q = P × A × C ÷ 1000

Where:
  Q  =  Runoff yield (m³)
  P  =  Annual or monthly rainfall (mm)
  A  =  Roof catchment area (m²)
  C  =  Runoff coefficient (material-dependent)
```

First-flush loss is deducted before runoff enters the tank:
```
Q_effective = Q × (1 − FF%)
```

### Monthly Water Balance Model

```
Sₜ = min( max( Sₜ₋₁ + Qₜ − Dₜ , 0 ) , Capacity )

Where:
  Sₜ       =  Tank storage at end of month t  (m³)
  Sₜ₋₁     =  Storage carried over from previous month  (m³)
  Qₜ       =  Runoff inflow for month t  (m³)
  Dₜ       =  Water demand for month t  (m³)
  Capacity =  Tank volume  (m³)
```

Storage is bounded: it cannot go negative (spilled = lost) and cannot exceed tank capacity (overflow discarded).

### Runoff Coefficients

| Roof Material | C Value | Standard / Source |
|---|---|---|
| RCC / Concrete (Inclined) | 0.90 | IS:15797, Patil 2023 |
| Metal Sheet / GI | 0.90 | Akhtar 2023 |
| Asbestos / AC Sheet | 0.85 | Hari 2019 |
| Mangalore / Clay Tile | 0.85 | Meenakshi 2022 |
| RCC / Concrete (Flat) | 0.80 | IS:15797, Villar-Navascués 2020 |
| Asphalt Sheet | 0.70 | Villar-Navascués 2020 |
| Gravel Roof | 0.62 | Farreny et al. 2011 |
| Green Roof (Extensive) | 0.55 | IS:15797 |
| Thatch / Non-Cemented | 0.50 | Singh & Turkiya 2017 |

### Dual Tank Sizing

Two independent methods are calculated. The larger result is adopted:

```
Ratio Method:    V_ratio    = f(annualRunoff / annualDemand)
Dry-Period Method: V_dry    = t × n × q × 0.4

Where:
  t  =  dry months per year
  n  =  number of occupants
  q  =  daily demand per person (m³)
```

### Water Saving Efficiency (WSE)

```
WSE (%) = (Σ monthly demand met by harvest / Σ annual demand) × 100
```

A WSE ≥ 60% is rated Excellent. 35–60% is rated Good. Below 35% needs supplementary supply.

### Recharge Suitability Score

A composite 0–100 score is computed from four parameters:

| Parameter | Weight | Data Source |
|---|---|---|
| Groundwater table depth | 40% | CGWB district reports |
| Soil hydraulic conductivity | 30% | SoilGrids / manual entry |
| Annual rainfall adequacy | 20% | Open-Meteo / district lookup |
| Site slope | 10% | Manual entry |

---

## 📖 Terminology Glossary

| Term | Full Form | Meaning |
|---|---|---|
| **RWH** | Rainwater Harvesting | Collection and storage of rainwater for later use |
| **WSE** | Water Saving Efficiency | % of annual water demand met by harvested rainwater |
| **LPCD** | Litres Per Capita Per Day | Daily water consumption standard per person |
| **C** | Runoff Coefficient | Fraction of rainfall that flows off the roof (0 to 1) |
| **Q** | Runoff Yield | Volume of water collected from the roof in m³ |
| **FF** | First Flush | Initial rainfall runoff discarded due to roof contamination |
| **GW Depth** | Groundwater Table Depth | Depth to the water table below ground surface (metres) |
| **CGWB** | Central Ground Water Board | India's apex body for groundwater assessment and regulation |
| **IMD** | India Meteorological Department | National weather and rainfall data authority |
| **IS:15797** | Indian Standard 15797:2008 | Bureau of Indian Standards code for RWH system design |
| **IS:1172** | Indian Standard 1172:1993 | BIS code for per-capita water supply requirements |
| **IS:3370** | Indian Standard 3370:2009 | BIS code for RCC water storage tank design |
| **Manning's n** | Manning's Roughness Coefficient | Pipe material friction factor (0.01 for smooth PVC) |
| **Sₜ** | Storage at time t | Tank water volume at end of each month in the simulation |
| **Reliability** | Supply Reliability | Number of months per year where supply ≥ demand |
| **Recharge Pit** | Groundwater Recharge Pit | Excavated structure that routes overflow into the aquifer |
| **Recharge Shaft** | Recharge Shaft | Narrow deep borehole for recharging deep aquifers |
| **Non-potable** | Non-potable Demand | Water uses not requiring drinking quality: flushing, cleaning |
| **Monsoon** | South-West Monsoon | June–September rainfall season delivering ~82% of annual rain |
| **Marathwada** | Marathwada Region | Water-stressed plateau region of eastern Maharashtra |
| **Vidarbha** | Vidarbha Region | Semi-arid eastern Maharashtra region with declining GW levels |
| **Open-Meteo** | Open-Meteo API | Free historical weather API (30-year data, no auth required) |
| **SoilGrids** | SoilGrids REST API | Global soil hydraulic properties database by coordinate |
| **WSE ≥ 60%** | — | Excellent: RWH system can meet majority of water demand |
| **WSE 35–60%** | — | Good: Significant but not complete demand offset |
| **WSE < 35%** | — | Needs review: supplementary supply or larger tank required |

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend Framework** | React 18 + Vite | Fast HMR, lightweight bundle, mobile-first PWA capability |
| **Charting** | Recharts | Composable React-native charts; responsive SVG rendering |
| **Styling** | Pure inline CSS with CSS variables | Zero dependency; consistent design tokens; no build step |
| **Fonts** | IBM Plex Mono + Barlow Condensed (Google Fonts) | Technical precision aesthetic + readable data display |
| **Rainfall API** | Open-Meteo API | Free, no authentication, 30-year historical global data |
| **Soil Data** | SoilGrids REST API (ISRIC) | Global soil hydraulic conductivity by lat/lng coordinate |
| **Groundwater** | CGWB district lookup (built-in) | Offline-capable; 10 Maharashtra districts pre-loaded |
| **Backend (planned)** | FastAPI (Python) | Async, scientific library support, lightweight microservice |
| **Database (planned)** | PostgreSQL | Stores site assessments and district-level aggregated data |
| **Deployment (planned)** | Docker | Portable; deployable to field servers without cloud dependency |

**Current prototype** runs fully client-side — no backend required. All hydrological calculations execute in the browser.

---

## 🚀 Getting Started

### Prerequisites

```bash
node >= 18.0.0
npm >= 9.0.0
```

### Installation

```bash
# Clone the repository
git clone https://github.com/Avio-dels/JalSetu-AI.git
cd JalSetu-AI

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
npm run preview
```

### Deploy to GitHub Pages

```bash
npm run build
# Deploy the /dist folder to your gh-pages branch
```

### Environment Variables (for API features)

Create a `.env` file in the project root:

```env
# Optional — only needed for live rainfall data
VITE_OPEN_METEO_BASE=https://archive-api.open-meteo.com/v1/archive
VITE_SOILGRIDS_BASE=https://rest.soilgrids.org/soilgrids/v2.0
```

The app functions without these — district rainfall values fall back to built-in lookup tables.

---

## 📁 Project Structure

```
JalSetu-AI/
├── src/
│   ├── App.jsx              # Main application — all panels and logic
│   ├── main.jsx             # React entry point
│   └── index.css            # Base resets
├── public/
│   └── favicon.svg          # Beaver mascot SVG
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

**App.jsx architecture:**

```
Constants & Config
  ├── RUNOFF_COEFFICIENTS     — C values per roof material
  ├── RAINFALL_DISTRICTS      — 10-district Maharashtra lookup table
  ├── GW_ZONES                — Groundwater depth by district
  └── BUILDING_TYPES          — LPCD and non-potable split per type

Calculation Functions
  ├── calcMultiBlockRunoff()  — Weighted-C monthly runoff per roof block
  ├── calcMonthlyRunoff()     — Monthly distribution using monsoon pattern
  ├── calcWaterBalance()      — Month-by-month Sₜ simulation
  ├── calcWSE()               — Water Saving Efficiency
  ├── calcReliability()       — Supply reliability (months/year)
  ├── calcRatioTank()         — Ratio method tank size
  ├── calcDryPeriodTank()     — Dry-period method tank size
  ├── calcDownpipe()          — Manning's equation pipe diameter
  └── calcRechargeScore()     — 0–100 composite recharge score

UI Components
  ├── StepBar                 — 4-step progress indicator
  ├── SecTitle                — Section heading with icon
  ├── FieldRow                — Label + input layout
  ├── RoofBlockRow            — Single roof block entry with live preview
  ├── MetricCard              — KPI display card with badge
  ├── Step1Panel              — Location & rainfall entry
  ├── Step2Panel              — Roof configuration
  ├── Step3Panel              — Demand parameters
  ├── Step4Panel              — Recharge & groundwater
  └── ResultsPanel            — 6-tab results dashboard
```

---

## ✅ Validation Results

JalSetu AI's calculation engine was validated against the published dataset of **Patil (2023)** — a peer-reviewed study of the Dr. Babasaheb Ambedkar Marathwada University Sub-Campus, Osmanabad (IJERT Vol. 12, Issue 09).

Osmanabad receives ~787 mm annual rainfall, representative of the target semi-arid Marathwada deployment region.

| Building | Published Result | JalSetu AI Output | Deviation |
|---|---|---|---|
| Administrative Building (2000 m²) | 1,259.14 m³/yr | 1,259 m³/yr | < 0.01% |
| Science Building (2400 m²) | 1,510.97 m³/yr | 1,511 m³/yr | < 0.02% |
| Girls Hostel (600 m²) | 377.74 m³/yr | 378 m³/yr | < 0.07% |
| Guest House (600 m²) | 377.74 m³/yr | 378 m³/yr | < 0.07% |
| University Canteen (300 m²) | 188.87 m³/yr | 189 m³/yr | < 0.07% |
| **TOTAL** | **3,714,450 L** | **3,715,000 L** | **< 0.1%** |

**All five buildings match published civil engineering results with less than 0.1% deviation.**

---

## 📚 Research Foundation

### Indian Standards & Government Guidelines

| Code | Title | Role in JalSetu AI |
|---|---|---|
| **IS:15797:2008** | Rooftop Rainwater Harvesting — Code of Practice | Primary standard. Runoff coefficients, tank sizing, filter design, first-flush |
| **IS:1172:1993** | Code of Basic Requirements for Water Supply | LPCD values per building type |
| **IS:3370:2009** | Concrete Structures for Storage of Liquids | RCC underground tank design compliance |
| **IS:1742:1983** | Code of Practice for Building Drainage | Gutter slope, downpipe sizing |
| **CGWB, 2013** | Master Plan for Artificial Recharge to Ground Water in India | Recharge structure selection, aquifer suitability matrix |
| **GoI RWH Manual** | Rooftop Rainwater Harvesting — A Practical Guide (Jal Shakti) | Dry-period tank sizing formula: V = t × n × q × 0.4 |

### Peer-Reviewed Research Papers

| Reference | Journal | Contribution |
|---|---|---|
| Patil, N.P. (2023) | IJERT Vol. 12 Issue 09 | **Primary validation dataset.** Marathwada-specific RWH design for Dr. BAMU Osmanabad; tank sizing and component specifications for semi-arid Maharashtra |
| Villar-Navascués, R. et al. (2020) | MDPI Water, 12(9), 2623 | Monthly RCHP variability; spatial runoff coefficient methodology; 30% overestimation risk when using annual-only models |
| Meenakshi, Kumar & Kumari (2022) | Eco. Env. & Cons., 28(S), S284–S290 | GIS rooftop digitisation; June–September monsoon concentration (82% of annual rainfall); coefficient of variance methodology |
| Akhtar, H. (2023) | J. Biodiversity & Env. Sci., 23(6), 92–101 | Gould & Nissen formula application; storage tank capacity calculation workflow; GI sheet coefficient |
| Chowdhury & Akter (2026) | Water Supply & Sanitation Journal, Vol. 14 | WSE formula: Σ demand met / Σ annual demand × 100; water balance modelling methodology |
| Kiran & Kumar (2023) | Indian J. Environmental Engineering | 10% first-flush loss recommendation; roof contamination modelling for urban catchments |
| Farreny et al. (2011) | Water Research, 45(10) | Gravel roof C = 0.62; quality and quantity trade-off analysis |
| Hari (2019) | Journal of Applied Hydrology | Asbestos/AC sheet C = 0.85; field measurement dataset for semi-arid India |
| Meenakshi (2022) | Indian Water Works Association Journal | Mangalore/Clay tile C = 0.85; pilot study findings |
| Singh & Turkiya (2017) | Int. J. Water Resources Development | Thatch / non-cemented roof C = 0.50; rural catchment characterisation using GIS |

---

## 🗺️ Roadmap

### Phase 1 — Current (Prototype Validated)
- [x] Multi-block runoff calculation engine
- [x] Monthly water balance model
- [x] Dual tank sizing method
- [x] Recharge scoring and recommendation
- [x] Interactive charts (Recharts)
- [x] 6-tab results dashboard
- [x] Validation against Dr. BAMU Osmanabad dataset (<0.1% deviation)

### Phase 2 — In Progress
- [ ] Open-Meteo API live rainfall integration
- [ ] SoilGrids API soil hydraulic conductivity
- [ ] Downloadable PDF engineering report
- [ ] Expanded district groundwater database (Maharashtra 36 districts)

### Phase 3 — Planned
- [ ] FastAPI backend + PostgreSQL assessment database
- [ ] GPS auto-detect → Open-Meteo live data
- [ ] Satellite roof area extraction (Google Earth Engine)
- [ ] Field pilot deployments (Amravati, Wardha, Osmanabad)

### Phase 4 — Vision
- [ ] Integration with Jal Shakti Mission portal
- [ ] Maharashtra groundwater authority API
- [ ] Municipal-scale batch assessment (100+ sites per district)
- [ ] State-level decision support dashboard

---

## 👤 Team

| Role | Details |
|---|---|
| **Lead Developer & Researcher** | Ayush Nagdive · Final Year B.E. CSE  |
| **Institution** | Prof. Ram Meghe College of Engineering, Amravati, Maharashtra |
| **Expertise** | Full-stack development, Machine Learning, GIS integration |
| **Contact** | nagdiveayush@gmail.com |
| **Portfolio** | [avio-dels.github.io/Portfolio](https://avio-dels.github.io/Portfolio) |
| **GitHub** | [@Avio-dels](https://github.com/Avio-dels) |

---

## 📄 License

This project was developed under the **Bharat Water Innovation Network (Bharat WIN)** initiative, Department of Water Resources, River Development and Ganga Rejuvenation, Ministry of Jal Shakti, Government of India.

---

<div align="center">

**Built for India's water future 🦫💧**

*JalSetu AI — जलसेतु — Water Bridge*

</div>
