import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, ShieldAlert, Settings, Ruler, Info, Grid, AlertTriangle, Plus, Trash2, Sparkles, Loader2, Bot, Calculator, List, Sun, Moon } from 'lucide-react';

// --- Constants & Data ---

const API5L_GRADES = [
  { name: 'Grade A', metric: 207, imperial: 30000 },
  { name: 'Grade B', metric: 241, imperial: 35000 },
  { name: 'X42', metric: 290, imperial: 42000 },
  { name: 'X46', metric: 317, imperial: 46000 },
  { name: 'X52', metric: 359, imperial: 52000 },
  { name: 'X56', metric: 386, imperial: 56000 },
  { name: 'X60', metric: 414, imperial: 60000 },
  { name: 'X65', metric: 448, imperial: 65000 },
  { name: 'X70', metric: 483, imperial: 70000 },
  { name: 'X80', metric: 552, imperial: 80000 },
  { name: 'Custom', metric: '', imperial: '' },
];

// --- Core Calculation Logic ---
// We do the math entirely in the output unit system to make steps readable.

const fromMetricLength = (val, u) => u === 'imperial' ? val / 25.4 : val;
const fromMetricPress = (val, u) => u === 'imperial' ? val * 145.038 : val;

const calcB31G_Level0 = (mD, mt, mSmys, mMaop, mL, md, f, outSys) => {
  if (!mD || !mt || !mSmys || !mL || md === undefined) return null;
  
  const D = fromMetricLength(mD, outSys);
  const t = fromMetricLength(mt, outSys);
  const L = fromMetricLength(mL, outSys);
  const d = fromMetricLength(md, outSys);
  const smys = fromMetricPress(mSmys, outSys);
  const maop = fromMetricPress(mMaop, outSys);

  const s_flow = 1.1 * smys;
  const z = (L * L) / (D * t);
  let M;
  let Pf;
  let steps = [];
  const u_press = outSys === 'metric' ? 'MPa' : 'psi';

  steps.push(`1. Flow Stress (S_flow) = 1.1 × SMYS = 1.1 × ${smys.toFixed(2)} = ${s_flow.toFixed(2)} ${u_press}`);
  steps.push(`2. Parameter (z) = L² / (D × t) = ${L.toFixed(2)}² / (${D.toFixed(2)} × ${t.toFixed(2)}) = ${z.toFixed(4)}`);

  if (z <= 20) {
    M = Math.sqrt(1 + 0.8 * z);
    Pf = ((2 * t * s_flow) / D) * ((1 - (2 / 3) * (d / t)) / (1 - ((2 / 3) * (d / t)) / M));
    steps.push(`3. Failure Pressure (Pf) [for z ≤ 20] = (2 × t × S_flow / D) × [(1 - 2/3(d/t)) / (1 - 2/3(d/t)/M)] = ${Pf.toFixed(2)} ${u_press}`);
  } else {
    M = Infinity;
    Pf = ((2 * t * s_flow) / D) * (1 - d / t);
    steps.push(`3. Failure Pressure (Pf) [for z > 20] = (2 × t × S_flow / D) × (1 - d/t) = ${Pf.toFixed(2)} ${u_press}`);
  }

  const Psafe = Pf * f;
  steps.push(`4. Safe Pressure (Psafe) = Pf × F = ${Pf.toFixed(2)} × ${f} = ${Psafe.toFixed(2)} ${u_press}`);
  
  const ERF = Psafe > 0 ? maop / Psafe : Infinity;
  steps.push(`5. Estimated Repair Factor (ERF) = MAOP / Psafe = ${maop.toFixed(2)} / ${Psafe.toFixed(2)} = ${ERF.toFixed(4)}`);
  
  return { Pf, Psafe, ERF, s_flow, z, steps, max_d: d };
};

const calcB31G_Level1 = (mD, mt, mSmys, mMaop, mL, md, f, outSys) => {
  if (!mD || !mt || !mSmys || !mL || md === undefined) return null;
  
  const D = fromMetricLength(mD, outSys);
  const t = fromMetricLength(mt, outSys);
  const L = fromMetricLength(mL, outSys);
  const d = fromMetricLength(md, outSys);
  const smys = fromMetricPress(mSmys, outSys);
  const maop = fromMetricPress(mMaop, outSys);

  const s_flow_add = outSys === 'metric' ? 68.95 : 10000;
  const s_flow = smys + s_flow_add; 
  const z = (L * L) / (D * t);
  let M;
  let steps = [];
  const u_press = outSys === 'metric' ? 'MPa' : 'psi';

  steps.push(`1. Flow Stress (S_flow) = SMYS + ${s_flow_add} = ${smys.toFixed(2)} + ${s_flow_add} = ${s_flow.toFixed(2)} ${u_press}`);
  steps.push(`2. Parameter (z) = L² / (D × t) = ${L.toFixed(2)}² / (${D.toFixed(2)} × ${t.toFixed(2)}) = ${z.toFixed(4)}`);

  if (z <= 50) {
    M = Math.sqrt(1 + 0.6275 * z - 0.003375 * z * z);
  } else {
    M = 0.032 * z + 3.3;
  }

  const Pf = ((2 * t * s_flow) / D) * ((1 - 0.85 * (d / t)) / (1 - (0.85 * (d / t)) / M));
  steps.push(`3. Failure Pressure (Pf) = (2 × t × S_flow / D) × [(1 - 0.85(d/t)) / (1 - 0.85(d/t)/M)] = ${Pf.toFixed(2)} ${u_press}`);
  
  const Psafe = Pf * f;
  steps.push(`4. Safe Pressure (Psafe) = Pf × F = ${Pf.toFixed(2)} × ${f} = ${Psafe.toFixed(2)} ${u_press}`);
  
  const ERF = Psafe > 0 ? maop / Psafe : Infinity;
  steps.push(`5. Estimated Repair Factor (ERF) = MAOP / Psafe = ${maop.toFixed(2)} / ${Psafe.toFixed(2)} = ${ERF.toFixed(4)}`);

  return { Pf, Psafe, ERF, s_flow, z, steps, max_d: d };
};

const calcB31G_Level2 = (mD, mt, mSmys, mMaop, mPoints, f, outSys) => {
  if (!mD || !mt || !mSmys || mPoints.length < 2) return null;
  
  const D = fromMetricLength(mD, outSys);
  const t = fromMetricLength(mt, outSys);
  const smys = fromMetricPress(mSmys, outSys);
  const maop = fromMetricPress(mMaop, outSys);
  
  // Convert all points to output system
  const sorted = mPoints.map(p => ({
    x: fromMetricLength(p.x, outSys),
    d: fromMetricLength(p.d, outSys)
  })).sort((a, b) => a.x - b.x);

  const s_flow_add = outSys === 'metric' ? 68.95 : 10000;
  const s_flow = smys + s_flow_add; 
  let minPf = Infinity;
  let critL = 0;
  let critA = 0;
  let critPair = [0, 0];
  let steps = [];
  const u_press = outSys === 'metric' ? 'MPa' : 'psi';
  const u_len = outSys === 'metric' ? 'mm' : 'in';

  steps.push(`1. Flow Stress (S_flow) = SMYS + ${s_flow_add} = ${smys.toFixed(2)} + ${s_flow_add} = ${s_flow.toFixed(2)} ${u_press}`);
  steps.push(`2. Evaluated ${sorted.length} river-bottom points to find the critical effective area.`);

  for (let i = 0; i < sorted.length - 1; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const L_ij = sorted.x !== undefined ? sorted[j].x - sorted[i].x : 0;
      if (L_ij <= 0) continue;

      let A_ij = 0;
      for (let k = i; k < j; k++) {
        const dx = sorted[k + 1].x - sorted[k].x;
        const avg_d = (sorted[k + 1].d + sorted[k].d) / 2;
        A_ij += dx * avg_d;
      }

      const z = (L_ij * L_ij) / (D * t);
      let M = 1;
      if (z <= 50) {
        M = Math.sqrt(1 + 0.6275 * z - 0.003375 * z * z);
      } else {
        M = 0.032 * z + 3.3;
      }

      const dt_ratio = A_ij / (L_ij * t);
      let Pf = 0;
      if (dt_ratio < 1) {
        Pf = ((2 * t * s_flow) / D) * ((1 - dt_ratio) / (1 - dt_ratio / M));
      }

      if (Pf < minPf) {
        minPf = Pf;
        critL = L_ij;
        critA = A_ij;
        critPair = [sorted[i].x, sorted[j].x];
      }
    }
  }

  const max_d = Math.max(...sorted.map(p => p.d));
  if(max_d >= t) {
    minPf = 0; // Leak condition
    steps.push(`!!! LEAK DETECTED: Max depth (${max_d.toFixed(2)}) >= Wall Thickness (${t.toFixed(2)}) !!!`);
  }

  steps.push(`3. Minimum Failure Pressure found between X = ${critPair[0].toFixed(2)} and X = ${critPair[1].toFixed(2)}`);
  steps.push(`   - Critical Length (L_crit) = ${critL.toFixed(2)} ${u_len}`);
  steps.push(`   - Critical Area (A_crit) = ${critA.toFixed(2)} ${u_len}²`);
  steps.push(`   - Area Ratio (A / Lt) = ${(critA / (critL * t)).toFixed(4)}`);
  steps.push(`4. Critical Failure Pressure (Pf) = ${minPf.toFixed(2)} ${u_press}`);

  const Psafe = minPf * f;
  steps.push(`5. Safe Pressure (Psafe) = Pf × F = ${minPf.toFixed(2)} × ${f} = ${Psafe.toFixed(2)} ${u_press}`);

  const ERF = Psafe > 0 ? maop / Psafe : Infinity;
  steps.push(`6. Estimated Repair Factor (ERF) = MAOP / Psafe = ${maop.toFixed(2)} / ${Psafe.toFixed(2)} = ${ERF.toFixed(4)}`);

  return { Pf: minPf, Psafe, ERF, critL, critA, critPair, max_d, steps };
};

// --- UI Components ---

const InputGroup = ({ label, unitType, unit, value, onChange, onUnitToggle, min, max, step, disabled }) => (
  <div className={`flex flex-col mb-4 ${disabled ? 'opacity-50' : ''}`}>
    <div className="flex justify-between items-center mb-1.5">
      <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{label}</label>
      {unitType && (
        <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded p-0.5 text-[10px] font-medium border border-zinc-200 dark:border-zinc-700">
          <button 
            onClick={() => onUnitToggle(unitType === 'length' ? 'mm' : 'MPa')} 
            className={`px-1.5 py-0.5 rounded transition-all ${unit === 'mm' || unit === 'MPa' ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
          >
            {unitType === 'length' ? 'mm' : 'MPa'}
          </button>
          <button 
            onClick={() => onUnitToggle(unitType === 'length' ? 'in' : 'psi')} 
            className={`px-1.5 py-0.5 rounded transition-all ${unit === 'in' || unit === 'psi' ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
          >
            {unitType === 'length' ? 'in' : 'psi'}
          </button>
        </div>
      )}
      {!unitType && unit && <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{unit}</span>}
    </div>
    <input
      type="number"
      value={Number.isNaN(value) ? '' : value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-800 dark:text-zinc-100 text-sm focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 dark:focus:ring-indigo-500 transition-colors disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed"
    />
  </div>
);

const ResultCard = ({ title, value, unit, highlight = false }) => {
  let colors = 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm';
  let titleColors = 'text-zinc-500 dark:text-zinc-400';
  let valColors = 'text-zinc-900 dark:text-white';
  
  if (highlight === 'safe') {
     colors = 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 shadow-md';
     titleColors = 'text-emerald-700 dark:text-emerald-400';
     valColors = 'text-emerald-900 dark:text-emerald-300';
  } else if (highlight === 'danger') {
     colors = 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/50 shadow-md';
     titleColors = 'text-rose-700 dark:text-rose-400';
     valColors = 'text-rose-900 dark:text-rose-300';
  } else if (highlight === true) {
     colors = 'bg-zinc-800 dark:bg-zinc-100 border-zinc-800 dark:border-zinc-100 text-white dark:text-zinc-900 shadow-md';
     titleColors = 'text-zinc-300 dark:text-zinc-600';
     valColors = 'text-white dark:text-zinc-900';
  }

  return (
    <div className={`p-5 rounded-xl border flex flex-col justify-between ${colors}`}>
      <div className={`text-xs font-medium uppercase tracking-wider mb-2 ${titleColors}`}>{title}</div>
      <div className="flex items-baseline space-x-1">
        <span className={`text-3xl font-light tracking-tight ${valColors}`}>
           {value !== null && !isNaN(value) && value !== Infinity ? value.toFixed(value < 10 && value > 0 ? 4 : 2) : '--'}
        </span>
        {unit && <span className={`text-sm ${titleColors}`}>{unit}</span>}
      </div>
    </div>
  );
}

const StatusBanner = ({ ERF, maxDepth, t }) => {
  if (ERF === null || isNaN(ERF)) return null;
  
  const isLeak = maxDepth >= t;
  const isDeep = maxDepth > 0.8 * t && !isLeak;
  const isSafe = ERF <= 1 && !isLeak && !isDeep;

  let state = 'safe';
  let message = 'Defect is Acceptable';
  let submessage = 'Safe Operating Pressure exceeds MAOP (ERF ≤ 1.0).';
  let Icon = ShieldCheck;

  if (isLeak) {
    state = 'danger';
    message = 'Unacceptable: Leak Detected';
    submessage = 'Maximum defect depth exceeds or equals wall thickness.';
    Icon = ShieldAlert;
  } else if (isDeep) {
    state = 'warning';
    message = 'Unacceptable: Depth > 80% WT';
    submessage = 'ASME B31G requires repair or replacement for defects deeper than 80% of wall thickness regardless of length.';
    Icon = AlertTriangle;
  } else if (!isSafe) {
    state = 'danger';
    message = 'Defect is Unacceptable';
    submessage = 'Safe Operating Pressure is below MAOP (ERF > 1.0).';
    Icon = ShieldAlert;
  }

  const colors = {
    safe: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300',
    danger: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300',
  };

  const iconColors = {
    safe: 'text-emerald-500 dark:text-emerald-400',
    warning: 'text-amber-500 dark:text-amber-400',
    danger: 'text-rose-500 dark:text-rose-400',
  };

  return (
    <div className={`p-4 rounded-xl border flex items-start space-x-4 mb-6 ${colors[state]}`}>
      <div className={`p-2 rounded-full bg-white/60 dark:bg-zinc-900/60 ${iconColors[state]}`}>
        <Icon size={24} />
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-semibold">{message}</h3>
        <p className="text-sm opacity-80 mt-0.5">{submessage}</p>
      </div>
    </div>
  );
};

// Simple Markdown Formatter for LLM response
const FormattedText = ({ text }) => {
  if (!text) return null;
  const formatParagraph = (paragraph, i) => {
    const parts = paragraph.split(/(\*\*.*?\*\*)/g);
    return (
      <p key={i} className="mb-3 last:mb-0 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j} className="font-semibold text-zinc-900 dark:text-white">{part.slice(2, -2)}</strong>;
          }
          return part;
        })}
      </p>
    );
  };
  return <div className="prose-sm">{text.split('\n').filter(p => p.trim() !== '').map((paragraph, i) => formatParagraph(paragraph, i))}</div>;
};

// --- Main App Component ---

export default function App() {
  // Global State
  const [isDark, setIsDark] = useState(false);
  const [outputSystem, setOutputSystem] = useState('metric'); // 'metric' or 'imperial'
  const [selectedGrade, setSelectedGrade] = useState('X52');
  const [activeTab, setActiveTab] = useState(1); // 0: Lvl 0, 1: Lvl 1, 2: Lvl 2
  
  // Per-Input Unit State
  const [units, setUnits] = useState({
    D: 'mm', t: 'mm', smys: 'MPa', maop: 'MPa', f: '',
    L: 'mm', d: 'mm',
    profileX: 'mm', profileD: 'mm'
  });

  const [pipeline, setPipeline] = useState({
    D: 610, t: 12.7, smys: 359, maop: 8.0, f: 0.72      
  });

  const [defect, setDefect] = useState({
    L: 200, d: 5.0       
  });

  const [profile, setProfile] = useState([
    { id: 1, x: 0, d: 0 },
    { id: 2, x: 50, d: 2.5 },
    { id: 3, x: 100, d: 6.2 },
    { id: 4, x: 150, d: 4.1 },
    { id: 5, x: 200, d: 0 }
  ]);

  // Calculation State
  const [calculatedResults, setCalculatedResults] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState('');

  // Helpers
  const getOutLenUnit = () => outputSystem === 'metric' ? 'mm' : 'in';
  const getOutPressUnit = () => outputSystem === 'metric' ? 'MPa' : 'psi';

  const toMetricLength = (val, u) => u === 'in' ? val * 25.4 : val;
  const toMetricPress = (val, u) => u === 'psi' ? val / 145.038 : val;

  // State Updaters
  const updatePipeline = (key, val) => {
    setPipeline(prev => ({ ...prev, [key]: Number.isNaN(val) ? '' : val }));
    setIsDirty(true);
  };
  const updateDefect = (key, val) => {
    setDefect(prev => ({ ...prev, [key]: Number.isNaN(val) ? '' : val }));
    setIsDirty(true);
  };

  const handleUnitToggle = (key, unitType) => {
    const currentU = units[key];
    const newU = unitType === 'length' ? (currentU === 'mm' ? 'in' : 'mm') : (currentU === 'MPa' ? 'psi' : 'MPa');
    
    let converter = (v) => v;
    if (unitType === 'length') {
       converter = newU === 'in' ? (v => v / 25.4) : (v => v * 25.4);
    } else {
       converter = newU === 'psi' ? (v => v * 145.038) : (v => v / 145.038);
    }

    setUnits(u => ({ ...u, [key]: newU }));
    
    if (key in pipeline) {
       setPipeline(p => ({ ...p, [key]: p[key] === '' ? '' : converter(p[key]) }));
       if (key === 'smys' && selectedGrade !== 'Custom') {
          const grade = API5L_GRADES.find(g => g.name === selectedGrade);
          setPipeline(p => ({ ...p, smys: newU === 'psi' ? grade.imperial : grade.metric }));
       }
    } else if (key in defect) {
       setDefect(d => ({ ...d, [key]: d[key] === '' ? '' : converter(d[key]) }));
    }
    setIsDirty(true);
  };

  const handleGradeChange = (e) => {
    const gradeName = e.target.value;
    setSelectedGrade(gradeName);
    if (gradeName !== 'Custom') {
      const grade = API5L_GRADES.find(g => g.name === gradeName);
      updatePipeline('smys', units.smys === 'MPa' ? grade.metric : grade.imperial);
    } else {
      setIsDirty(true);
    }
  };

  const toggleOutputUnits = () => {
    setOutputSystem(outputSystem === 'metric' ? 'imperial' : 'metric');
    // If we change output unit, we want the results to update immediately if they exist.
    // The actual conversion is done in handleCalculate, so we just set dirty to encourage recalculation.
    setIsDirty(true); 
  };

  const addProfilePoint = () => {
    const lastX = profile.length > 0 ? profile[profile.length - 1].x : 0;
    const step = units.profileX === 'metric' ? 50 : 2;
    setProfile([...profile, { id: Date.now(), x: lastX + step, d: 0 }]);
    setIsDirty(true);
  };

  const removeProfilePoint = (id) => {
    setProfile(profile.filter(p => p.id !== id));
    setIsDirty(true);
  };

  const updateProfilePoint = (id, field, value) => {
    setProfile(profile.map(p => p.id === id ? { ...p, [field]: Number.isNaN(value) ? '' : value } : p));
    setIsDirty(true);
  };

  const toggleProfileUnit = (field, newU) => {
    if (units[field] === newU) return;
    const converter = newU === 'in' ? (v => v / 25.4) : (v => v * 25.4);
    setUnits(u => ({ ...u, [field]: newU }));
    setProfile(prof => prof.map(p => {
       const key = field === 'profileX' ? 'x' : 'd';
       return { ...p, [key]: p[key] === '' ? '' : converter(p[key]) };
    }));
    setIsDirty(true);
  };

  useEffect(() => {
    setCalculatedResults(null);
    setIsDirty(false);
    setAiReport('');
  }, [activeTab]);

  const handleCalculate = () => {
    // 1. Normalize all inputs to metric for calculations
    const mD = toMetricLength(pipeline.D, units.D);
    const mt = toMetricLength(pipeline.t, units.t);
    const mSmys = toMetricPress(pipeline.smys, units.smys);
    const mMaop = toMetricPress(pipeline.maop, units.maop);
    
    let res;
    if (activeTab === 0) {
      const mL = toMetricLength(defect.L, units.L);
      const md = toMetricLength(defect.d, units.d);
      res = calcB31G_Level0(mD, mt, mSmys, mMaop, mL, md, pipeline.f, outputSystem);
    }
    if (activeTab === 1) {
      const mL = toMetricLength(defect.L, units.L);
      const md = toMetricLength(defect.d, units.d);
      res = calcB31G_Level1(mD, mt, mSmys, mMaop, mL, md, pipeline.f, outputSystem);
    }
    if (activeTab === 2) {
      const mPoints = profile.map(p => ({
         id: p.id,
         x: toMetricLength(p.x, units.profileX),
         d: toMetricLength(p.d, units.profileD)
      }));
      res = calcB31G_Level2(mD, mt, mSmys, mMaop, mPoints, pipeline.f, outputSystem);
    }
    
    setCalculatedResults(res);
    setIsDirty(false);
  };

  const generateAIReport = async () => {
    if (!calculatedResults || calculatedResults.Psafe === null) return;
    setAiLoading(true);
    setAiReport('');
    const apiKey = ""; 

    const maxD = calculatedResults.max_d;
    const t_out = fromMetricLength(toMetricLength(pipeline.t, units.t), outputSystem);
    const maop_out = fromMetricPress(toMetricPress(pipeline.maop, units.maop), outputSystem);
    
    const isLeak = maxD >= t_out;
    const isDeep = maxD > 0.8 * t_out && !isLeak;
    const isSafe = calculatedResults.ERF <= 1 && !isLeak && !isDeep;

    const levelName = activeTab === 0 ? "Original B31G (Level 0)" : activeTab === 1 ? "Modified B31G (Level 1)" : "RSTRENG Effective Area (Level 2)";
    const u_press = getOutPressUnit();
    const u_len = getOutLenUnit();

    const defectDetails = activeTab === 2 
      ? `Defect Profile: ${profile.length} points evaluated. Max Depth = ${maxD.toFixed(2)} ${u_len}.`
      : `Defect: Length = ${fromMetricLength(toMetricLength(defect.L, units.L), outputSystem).toFixed(2)} ${u_len}, Max Depth = ${maxD.toFixed(2)} ${u_len}.`;

    const userPrompt = `
      Analyze the following pipeline defect assessment:
      - Assessment Method: ${levelName}
      - Pipeline Material Grade: ${selectedGrade}, Design Factor = ${pipeline.f}.
      - ${defectDetails}
      - Results: Failure Pressure (Pf) = ${calculatedResults.Pf?.toFixed(2)} ${u_press}, Safe Operating Pressure (Psafe) = ${calculatedResults.Psafe?.toFixed(2)} ${u_press}.
      - MAOP = ${maop_out.toFixed(2)} ${u_press}.
      - ERF (Estimated Repair Factor) = ${calculatedResults.ERF?.toFixed(4)}.
      - Acceptability Status: ${isSafe ? 'ACCEPTABLE' : 'UNACCEPTABLE'} (Leak detected: ${isLeak}, Depth > 80% WT: ${isDeep}).

      Write a concise, professional engineering summary. 
      Include:
      1. A clear statement on whether the defect is acceptable for the current MAOP.
      2. An explanation of the failure pressure margin and ERF.
      3. Recommended next steps (e.g., monitoring, specific repair methods like recoating or sleeving, or pressure derating) based on industry best practices.
      Format with clear spacing and bold text for emphasis.
    `;

    const payload = {
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: "You are an expert pipeline integrity engineer. Provide professional, clear, and actionable fitness-for-service advice based on standard industry practices." }] }
    };

    const maxRetries = 5;
    const delays = [1000, 2000, 4000, 8000, 16000];
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (text) {
          setAiReport(text);
          setAiLoading(false);
          return;
        } else throw new Error('No text in response');
      } catch (e) {
        if (attempt === maxRetries - 1) {
          setAiReport("Failed to generate AI engineering report. Please verify your connection and try again.");
          setAiLoading(false);
          return;
        }
        await new Promise(r => setTimeout(r, delays[attempt]));
        attempt++;
      }
    }
  };

  return (
    <div className={`${isDark ? 'dark' : ''}`}>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-zinc-200 dark:selection:bg-zinc-700 transition-colors duration-200">
        
        {/* Header */}
        <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 transition-colors duration-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-zinc-900 dark:bg-zinc-100 p-2 rounded-lg">
                <Activity className="text-white dark:text-zinc-900" size={20} />
              </div>
              <div>
                <h1 className="text-lg font-semibold leading-tight">ASME B31G Assessor</h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Pipeline Defect Evaluation</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              
              <button 
                onClick={toggleOutputUnits} 
                className="hidden sm:flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-medium transition-colors"
                title="Toggle Output Display Units"
              >
                <span>Output:</span>
                <span className="font-bold">{outputSystem === 'metric' ? 'Metric' : 'Imperial'}</span>
              </button>

              <div className="hidden sm:flex space-x-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                {[0, 1, 2].map((level) => (
                  <button
                    key={level}
                    onClick={() => setActiveTab(level)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === level ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                  >
                    Level {level}
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setIsDark(!isDark)} 
                className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Sidebar - Inputs */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Pipeline Parameters */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-colors">
                <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex items-center space-x-2">
                  <Settings size={18} className="text-zinc-400 dark:text-zinc-500" />
                  <h2 className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">Pipeline Parameters</h2>
                </div>
                <div className="p-5">
                  <InputGroup label="Outer Diameter (D)" unitType="length" unit={units.D} value={pipeline.D} onChange={(v) => updatePipeline('D', v)} onUnitToggle={(u) => handleUnitToggle('D', u)} min={0} />
                  <InputGroup label="Wall Thickness (t)" unitType="length" unit={units.t} value={pipeline.t} onChange={(v) => updatePipeline('t', v)} onUnitToggle={(u) => handleUnitToggle('t', u)} min={0} step={0.1} />
                  
                  {/* Material Grade Dropdown */}
                  <div className="flex flex-col mb-4">
                    <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-1.5">Material Grade</label>
                    <select 
                      value={selectedGrade} 
                      onChange={handleGradeChange}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-800 dark:text-zinc-100 text-sm focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 dark:focus:ring-indigo-500 transition-colors"
                    >
                      {API5L_GRADES.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                    </select>
                  </div>

                  <InputGroup 
                    label="Yield Strength (SMYS)" 
                    unitType="pressure" 
                    unit={units.smys} 
                    value={pipeline.smys} 
                    onChange={(v) => { updatePipeline('smys', v); setSelectedGrade('Custom'); }} 
                    onUnitToggle={(u) => handleUnitToggle('smys', u)}
                    min={0} 
                    disabled={selectedGrade !== 'Custom'}
                  />
                  <InputGroup label="MAOP" unitType="pressure" unit={units.maop} value={pipeline.maop} onChange={(v) => updatePipeline('maop', v)} onUnitToggle={(u) => handleUnitToggle('maop', u)} min={0} step={0.1} />
                  <InputGroup label="Design Factor (F)" unitType={null} unit="" value={pipeline.f} onChange={(v) => updatePipeline('f', v)} min={0.1} max={1.0} step={0.01} />
                </div>
              </div>

              {/* Defect Parameters (Level 0 and 1) */}
              {(activeTab === 0 || activeTab === 1) && (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-colors">
                  <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex items-center space-x-2">
                    <Ruler size={18} className="text-zinc-400 dark:text-zinc-500" />
                    <h2 className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">Max Defect Dimensions</h2>
                  </div>
                  <div className="p-5">
                    <InputGroup label="Maximum Length (L)" unitType="length" unit={units.L} value={defect.L} onChange={(v) => updateDefect('L', v)} onUnitToggle={(u) => handleUnitToggle('L', u)} min={0} />
                    <InputGroup label="Maximum Depth (d)" unitType="length" unit={units.d} value={defect.d} onChange={(v) => updateDefect('d', v)} onUnitToggle={(u) => handleUnitToggle('d', u)} min={0} step={0.1} />
                  </div>
                </div>
              )}
              
              {/* Mobile Tab Switcher */}
              <div className="block sm:hidden space-y-2 mt-6">
                <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Assessment Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((level) => (
                    <button
                      key={level}
                      onClick={() => setActiveTab(level)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${activeTab === level ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100 text-white dark:text-zinc-900' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`}
                    >
                      Lvl {level}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between bg-zinc-100 dark:bg-zinc-800 p-2 rounded-lg">
                   <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Output Units:</span>
                   <button onClick={toggleOutputUnits} className="px-3 py-1 bg-white dark:bg-zinc-700 rounded shadow-sm text-sm font-bold">
                     {outputSystem === 'metric' ? 'Metric' : 'Imperial'}
                   </button>
                </div>
              </div>

            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-9 flex flex-col space-y-6">
              
              {/* Context Header */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-light tracking-tight text-zinc-900 dark:text-zinc-100">
                    {activeTab === 0 && 'Original B31G Assessment (Level 0)'}
                    {activeTab === 1 && 'Modified B31G Assessment (Level 1)'}
                    {activeTab === 2 && 'RSTRENG Effective Area (Level 2)'}
                  </h2>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                    {activeTab === 0 && 'Uses parabolic area approximation for short corrosion and rectangular for long corrosion.'}
                    {activeTab === 1 && 'Uses an arbitrary shape approximation (0.85dL) and advanced Foltz factor for improved accuracy.'}
                    {activeTab === 2 && 'Evaluates the exact river-bottom profile of the defect to find the critical effective area.'}
                  </p>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={handleCalculate}
                    className="inline-flex items-center justify-center space-x-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
                  >
                    <Calculator size={18} />
                    <span>Calculate Now</span>
                  </button>
                  
                  <button
                    onClick={generateAIReport}
                    disabled={aiLoading || !calculatedResults}
                    className="inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm"
                  >
                    {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    <span className="hidden sm:inline">✨ Generate AI Report</span>
                    <span className="inline sm:hidden">✨ AI Report</span>
                  </button>
                </div>
              </div>

              {isDirty && calculatedResults && (
                <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm p-4 rounded-xl border border-amber-200 dark:border-amber-800/50 flex items-center space-x-3">
                  <AlertTriangle size={20} className="text-amber-500 dark:text-amber-400 shrink-0" />
                  <span className="font-medium">Pipeline inputs or units have changed. Please click "Calculate Now" to update the results.</span>
                </div>
              )}

              {!calculatedResults ? (
                 <div className="p-12 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600 transition-colors">
                    <Calculator size={48} className="mb-4 opacity-50" />
                    <p className="font-medium">No results generated</p>
                    <p className="text-sm mt-1">Adjust parameters on the left and click Calculate Now.</p>
                 </div>
              ) : (
                <>
                  {/* Status Banner */}
                  <StatusBanner 
                    ERF={calculatedResults.ERF} 
                    maxDepth={calculatedResults.max_d} 
                    t={fromMetricLength(toMetricLength(pipeline.t, units.t), outputSystem)} 
                  />

                  {/* Results Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ResultCard title="Failure Pressure (Pf)" value={calculatedResults.Pf} unit={getOutPressUnit()} />
                    <ResultCard title="Safe Pressure (Psafe)" value={calculatedResults.Psafe} unit={getOutPressUnit()} highlight={true} />
                    <ResultCard 
                      title="ERF (MAOP / Psafe)" 
                      value={calculatedResults.ERF} 
                      unit="" 
                      highlight={calculatedResults.ERF <= 1 ? 'safe' : 'danger'} 
                    />
                  </div>

                  {/* Full Calculation Steps */}
                  {calculatedResults.steps && (
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-colors">
                      <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex items-center space-x-2">
                        <List size={18} className="text-zinc-400 dark:text-zinc-500" />
                        <h2 className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">Calculation Details (in {outputSystem === 'metric' ? 'Metric' : 'Imperial'})</h2>
                      </div>
                      <div className="p-5 font-mono text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 space-y-3 bg-zinc-50 dark:bg-zinc-900/50 overflow-x-auto">
                        {calculatedResults.steps.map((step, i) => (
                          <div key={i} className={`${step.startsWith('!!!') ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}`}>{step}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* AI Report Section */}
              {(aiLoading || aiReport) && (
                <div className="bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-xl overflow-hidden shadow-sm transition-colors">
                  <div className="px-5 py-3 border-b border-indigo-100 dark:border-indigo-800/50 bg-white dark:bg-indigo-950/30 flex items-center space-x-2">
                    <Bot size={18} className="text-indigo-500 dark:text-indigo-400" />
                    <h3 className="font-semibold text-indigo-900 dark:text-indigo-200 text-sm">AI Integrity Engineer Assessment</h3>
                  </div>
                  <div className="p-6 bg-white dark:bg-zinc-900 transition-colors">
                    {aiLoading ? (
                      <div className="flex items-center space-x-3 text-indigo-600 dark:text-indigo-400">
                        <Loader2 size={18} className="animate-spin" />
                        <span className="text-sm font-medium">Analyzing defect profile and generating recommendations...</span>
                      </div>
                    ) : (
                      <FormattedText text={aiReport} />
                    )}
                  </div>
                </div>
              )}

              {/* Level 2 Interactive Profile Editor */}
              {activeTab === 2 && (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col flex-1 transition-colors">
                  <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
                    <div className="flex items-center space-x-2">
                      <Grid size={18} className="text-zinc-400 dark:text-zinc-500" />
                      <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">Defect Profile (River-Bottom)</h3>
                    </div>
                    <button 
                      onClick={addProfilePoint}
                      className="flex items-center space-x-1 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-md transition-colors"
                    >
                      <Plus size={14} />
                      <span>Add Point</span>
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-zinc-100 dark:divide-zinc-800 flex-1">
                    
                    {/* Table */}
                    <div className="p-0 max-h-[400px] overflow-y-auto bg-zinc-50/30 dark:bg-zinc-900/30">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-50 dark:bg-zinc-800/80 sticky top-0 border-b border-zinc-100 dark:border-zinc-800">
                          <tr>
                            <th className="px-6 py-3 font-medium">
                              <div className="flex items-center justify-between">
                                <span>Distance (X)</span>
                                <div className="flex bg-white dark:bg-zinc-900 rounded p-0.5 text-[10px] border border-zinc-200 dark:border-zinc-700 normal-case">
                                  <button onClick={() => toggleProfileUnit('profileX', 'mm')} className={`px-1.5 py-0.5 rounded ${units.profileX === 'mm' ? 'bg-zinc-100 dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>mm</button>
                                  <button onClick={() => toggleProfileUnit('profileX', 'in')} className={`px-1.5 py-0.5 rounded ${units.profileX === 'in' ? 'bg-zinc-100 dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>in</button>
                                </div>
                              </div>
                            </th>
                            <th className="px-6 py-3 font-medium">
                              <div className="flex items-center justify-between">
                                <span>Depth (d)</span>
                                <div className="flex bg-white dark:bg-zinc-900 rounded p-0.5 text-[10px] border border-zinc-200 dark:border-zinc-700 normal-case">
                                  <button onClick={() => toggleProfileUnit('profileD', 'mm')} className={`px-1.5 py-0.5 rounded ${units.profileD === 'mm' ? 'bg-zinc-100 dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>mm</button>
                                  <button onClick={() => toggleProfileUnit('profileD', 'in')} className={`px-1.5 py-0.5 rounded ${units.profileD === 'in' ? 'bg-zinc-100 dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>in</button>
                                </div>
                              </div>
                            </th>
                            <th className="px-6 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {profile.sort((a,b) => a.x - b.x).map((point, index) => {
                            const metricT = toMetricLength(pipeline.t, units.t);
                            const metricPointD = toMetricLength(point.d, units.profileD);
                            const isDeep = metricPointD > metricT;
                            return (
                            <tr key={point.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors bg-white dark:bg-zinc-900">
                              <td className="px-6 py-2.5">
                                <input 
                                  type="number" 
                                  value={Number.isNaN(point.x) ? '' : point.x} 
                                  onChange={(e) => updateProfilePoint(point.id, 'x', parseFloat(e.target.value))}
                                  className="w-full bg-transparent border-b border-transparent focus:border-zinc-300 dark:focus:border-zinc-600 focus:outline-none py-1 dark:text-zinc-100"
                                />
                              </td>
                              <td className="px-6 py-2.5">
                                <input 
                                  type="number" 
                                  value={Number.isNaN(point.d) ? '' : point.d} 
                                  step="0.1"
                                  onChange={(e) => updateProfilePoint(point.id, 'd', parseFloat(e.target.value))}
                                  className={`w-full bg-transparent border-b border-transparent focus:border-zinc-300 dark:focus:border-zinc-600 focus:outline-none py-1 dark:text-zinc-100 ${isDeep ? 'text-rose-600 dark:text-rose-400 font-medium' : ''}`}
                                />
                              </td>
                              <td className="px-6 py-2.5 text-right">
                                <button 
                                  onClick={() => removeProfilePoint(point.id)}
                                  disabled={profile.length <= 2}
                                  className="text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 disabled:opacity-30 disabled:hover:text-zinc-400 p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          )})}
                        </tbody>
                      </table>
                    </div>

                    {/* SVG Visualization */}
                    <div className="p-6 bg-white dark:bg-zinc-900 flex flex-col">
                      <h4 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4">Cross-Section View</h4>
                      <div className="relative w-full h-48 sm:h-64 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-100 dark:border-zinc-800 overflow-hidden flex items-end">
                        
                        {(() => {
                          if(profile.length < 2) return null;
                          
                          // To draw safely, we convert everything to metric first to avoid unit mismatch visual bugs
                          const drawT = toMetricLength(pipeline.t, units.t);
                          const metricProfile = profile.map(p => ({
                             x: toMetricLength(p.x, units.profileX),
                             d: toMetricLength(p.d, units.profileD)
                          })).sort((a,b) => a.x - b.x);

                          const minX = metricProfile[0].x;
                          const maxX = metricProfile[metricProfile.length-1].x;
                          const rangeX = maxX - minX || 1;
                          
                          const defectPointsStr = metricProfile.map(p => {
                             const px = ((p.x - minX) / rangeX) * 100;
                             const py = (Math.min(p.d, drawT) / drawT) * 100; 
                             return `${px},${py}`;
                          }).join(' ');
                          
                          const lostMetalPolygon = `0,0 ${defectPointsStr} 100,0`;
                          
                          let critHighlight = null;
                          // Use calculated results if available to draw highlight
                          if(calculatedResults?.critPair && calculatedResults.critPair[0] !== calculatedResults.critPair[1]) {
                             // critPair is in outSys. We need it in Metric to map to our metric drawing scale
                             const cX1 = toMetricLength(calculatedResults.critPair[0], outputSystem === 'imperial' ? 'in' : 'mm');
                             const cX2 = toMetricLength(calculatedResults.critPair[1], outputSystem === 'imperial' ? 'in' : 'mm');
                             
                             const px1 = ((cX1 - minX) / rangeX) * 100;
                             const px2 = ((cX2 - minX) / rangeX) * 100;
                             critHighlight = (
                               <rect 
                                  x={`${px1}%`} 
                                  y="0" 
                                  width={`${px2 - px1}%`} 
                                  height="100%" 
                                  fill={isDark ? "rgba(244, 63, 94, 0.2)" : "rgba(239, 68, 68, 0.1)"} 
                                  stroke={isDark ? "rgba(244, 63, 94, 0.4)" : "rgba(239, 68, 68, 0.3)"}
                                  strokeWidth="2"
                                  strokeDasharray="4 4"
                               />
                             );
                          }

                          return (
                            <>
                              <div className="absolute top-2 left-2 text-[10px] text-zinc-400 dark:text-zinc-500 font-mono z-10">OD Surface</div>
                              <div className="absolute bottom-2 left-2 text-[10px] text-zinc-400 dark:text-zinc-500 font-mono z-10">
                                ID Surface (t={fromMetricLength(drawT, outputSystem).toFixed(2)}{getOutLenUnit()})
                              </div>
                              <svg width="100%" height="100%" preserveAspectRatio="none" className="absolute inset-0">
                                <rect width="100%" height="100%" fill={isDark ? "#27272a" : "#e4e4e7"} /> 
                                <polygon points={lostMetalPolygon.split(' ').map(pt => pt.replace(',', ' ')).join(', ')} fill={isDark ? "#09090b" : "#ffffff"} />
                                <polyline points={defectPointsStr.split(' ').map(pt => pt.replace(',', ' ')).join(', ')} fill="none" stroke={isDark ? "#a1a1aa" : "#52525b"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                
                                {critHighlight}
                                
                                {metricProfile.map((p, i) => {
                                   const px = ((p.x - minX) / rangeX) * 100;
                                   const py = (Math.min(p.d, drawT) / drawT) * 100;
                                   return (
                                     <circle key={i} cx={`${px}%`} cy={`${py}%`} r="3" fill={isDark ? "#e4e4e7" : "#18181b"} vectorEffect="non-scaling-stroke" />
                                   )
                                })}
                              </svg>
                            </>
                          );
                        })()}
                      </div>
                      {calculatedResults?.critPair && calculatedResults.critPair[0] !== calculatedResults.critPair[1] && (
                         <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 flex items-center">
                           <div className="w-3 h-3 bg-rose-100 dark:bg-rose-900/30 border border-rose-300 dark:border-rose-700 mr-2 rounded-sm"></div>
                           Critical Area: X = {calculatedResults.critPair[0].toFixed(1)} to {calculatedResults.critPair[1].toFixed(1)} {getOutLenUnit()}
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Informational Note */}
              <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 flex items-start space-x-3 text-sm text-blue-800 dark:text-blue-300 transition-colors">
                <Info className="text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" size={18} />
                <p>
                  <strong>Note:</strong> This tool provides a simplified numerical estimation based on ASME B31G equations. It assumes purely longitudinal orientation of corrosion and internal pressure loading only. For actual engineering fitness-for-service (FFS) evaluation, refer strictly to the official ASME standard documentation and an authorized engineering professional. 
                </p>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}