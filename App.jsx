import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  serverTimestamp,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  Cell, LabelList 
} from 'recharts';
import { 
  ClipboardList, 
  BarChart2 as BarChartIcon, 
  Table as TableIcon, 
  Save, 
  FileSpreadsheet, 
  Trash2, 
  Activity, 
  ShieldCheck,
  Filter,
  Database,
  DownloadCloud,
  UploadCloud,
  RefreshCw,
  X,
  Printer,
  Percent,
  Eye,
  EyeOff
} from 'lucide-react';

// --- 1. 설정 입력 (이 부분을 본인 정보로 채워주세요) ---
const firebaseConfig = {
  // Firebase 콘솔 -> 프로젝트 설정 -> 일반 -> 내 앱 -> SDK 설정 및 구성 에서 복사
  apiKey: "여기에_FIREBASE_API_KEY_입력",
  authDomain: "여기에_AUTH_DOMAIN_입력",
  projectId: "여기에_PROJECT_ID_입력",
  storageBucket: "여기에_STORAGE_BUCKET_입력",
  messagingSenderId: "여기에_SENDER_ID_입력",
  appId: "여기에_APP_ID_입력"
};

const GEMINI_API_KEY = "여기에_GEMINI_API_KEY_입력"; // Google AI Studio 키
const APP_ID = 'uhp-pt-qms-final-v68'; // 데이터 저장 경로 구분용 ID

// --- Firebase 초기화 ---
// 설정값이 비어있으면 에러 방지를 위해 가짜 객체 생성
const app = initializeApp(firebaseConfig.apiKey ? firebaseConfig : {});
const auth = getAuth(app);
const db = getFirestore(app);

const CHART_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6', '#06b6d4', '#4b5563'];

// --- Gemini API 호출 함수 ---
const callGemini = async (prompt) => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("입력")) {
    return "API 키가 설정되지 않았습니다.";
  }
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "분석 결과를 가져올 수 없습니다.";
  } catch (error) {
    return "AI 서비스 연결 중 오류가 발생했습니다.";
  }
};

// --- 설정 데이터 (Configuration Data) ---
const CONFIG = {
  'PT/UPT': {
    models: ['PT850', 'PT851', 'PT852', 'PT853', 'PT863', 'UPT852', 'UPT853', 'UPT860', 'UPT861', 'UPT862', 'UPT863', 'UPT313'],
    processes: ['1.코팅외관', '2.센서링 용접', '3.와이어본딩', '4.VCR 용접', '5.1차 헬륨', '6.레이저 용접', '7.절연(초기전류값)검사', '8.온도보상', '9.조정', '10.PLC 검사', '11.2차 헬륨', '12.에이징검사', '13.외관검사', '14.최종검사'],
    options: {
      sensorThicknesses: ['0.25T', '0.3T', '0.45T', '0.55T', '0.65T', '0.75T', '0.9T'],
      connectionTypes: ['Straight female', 'Straight male', 'Flow through female', 'Flow through male', 'Other'],
      ranges: ['-15~30psi', '-15~60psi', '-15~100psi', '-15~160psi', '-15~200psi', '-15~250psi', '-15~300psi', '-15~350psi', '-15~500psi', '-15~1000psi', '-15~2000psi', '-15~3000psi', '-0.1~0.5MPa', '-0.1~1MPa', '0~0.5MPa', '0~1MPa', '-0.1~1.6MPa'],
      versions: ['1.5Ver', '2.0Ver'],
      tempEquipments: ['UPT#1', 'UPT#2', 'UPT#3', 'UPT#4', 'PT#1', 'PT#2'],
      agingEquipments: ['NT-189', 'NT-190', 'NT-192', 'NT-193', 'WISE-1216']
    },
    defects: {
      '1.코팅외관': ['각도불량', '글라스코팅두께불량', '센서다이불량', '칩긁힘', '칩미부착', '칩오염', '칩파손', '코팅깨짐', '코팅오염'],
      '8.온도보상': ['DAC 센서 불량', '증폭 불량', '통신 불량', '전류출력 불량', '값 고정', '메인보드 불량'],
      '12.에이징검사': ['0점불량', '기울기', '장기가압', '전류값이상', '초기값', '헌팅']
    }
  },
  'IGS': {
    models: ['UPT900'],
    processes: ['1.코팅외관', '2.블록 및 센서링 용접', '3.1차 헬륨', '4.2차 헬륨', '5.와이어본딩', '6.조립 및 절연검사', '7.온도보상', '8.조정', '9.자체 성능검사', '10.전원 on/off 검사', '11.자체 외관검사', '12.스위치 검사', '13.에이징검사', '14.QC 성능검사', '15.QC 외관검사'],
    options: {
      sensorThicknesses: ['0.2T'],
      connectionTypes: ['C-Seal', 'W-Seal', 'Other'],
      ranges: ['0~0.5MPa', '-0.1~0.5MPa'],
      versions: ['1.5Ver', '2.0Ver'],
      tempEquipments: ['IGS#1', 'IGS#2'],
      agingEquipments: ['에이징#1']
    },
    defects: {
      '1.코팅외관': ['코팅불량', '이물질', '스크래치'],
      '10.전원 on/off 검사': ['led 불량', '영점 불량']
    }
  }
};

// --- 컴포넌트: 입력 화면 ---
const InputScreen = ({ onSubmit }) => {
  const [model, setModel] = useState(CONFIG['PT/UPT'].models[0]);
  const [modelGroup, setModelGroup] = useState('PT/UPT');
  const [process, setProcess] = useState('');
  const [range, setRange] = useState(''); 
  const [connectionType, setConnectionType] = useState(''); 
  const [sensorThickness, setSensorThickness] = useState(''); 
  const [version, setVersion] = useState('1.5Ver');
  const [tempEquip, setTempEquip] = useState('');
  const [agingEquip, setAgingEquip] = useState('');
  const [remark, setRemark] = useState(''); 
  const [operator, setOperator] = useState('');
  const [inspectionQty, setInspectionQty] = useState(0);
  const [defectList, setDefectList] = useState([]); 
  const [currentQty, setCurrentQty] = useState(1);
  const [selectedDefectType, setSelectedDefectType] = useState(null);
  const [customDefectType, setCustomDefectType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
   
  const getToday = () => new Date().toISOString().split('T')[0];
  const [workDateStart, setWorkDateStart] = useState(getToday());
  const [workDateEnd, setWorkDateEnd] = useState(getToday());

  useEffect(() => {
    const group = CONFIG['IGS'].models.includes(model) ? 'IGS' : 'PT/UPT';
    setModelGroup(group);
    const opts = CONFIG[group].options;
    setProcess(CONFIG[group].processes[0]);
    setRange(opts.ranges[0]);
    setConnectionType(opts.connectionTypes[0]);
    setSensorThickness(opts.sensorThicknesses[0]);
    setVersion(opts.versions?.[0] || '');
    setTempEquip(opts.tempEquipments?.[0] || '');
    setAgingEquip(opts.agingEquipments?.[0] || '');
    setDefectList([]);
  }, [model]);

  const handleNoDefect = () => {
    const qtyNum = parseInt(inspectionQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      alert("총 검사 수량을 먼저 입력하세요.");
      return;
    }
    setDefectList([{ id: Date.now(), defectType: '불량없음', quantity: 0 }]);
  };

  const handleAddToList = () => {
    const finalType = selectedDefectType || customDefectType.trim();
    if (!finalType) return;
    if (defectList.some(i => i.defectType === '불량없음')) setDefectList([]);
    setDefectList([...defectList, { id: Date.now(), defectType: finalType, quantity: parseInt(currentQty || 1, 10) }]);
    setSelectedDefectType(null); setCustomDefectType(''); setCurrentQty(1);
  };

  const handleFinalSubmit = async () => {
    const qtyNum = parseInt(inspectionQty);
    if (!operator.trim() || defectList.length === 0 || isNaN(qtyNum) || qtyNum <= 0) {
        alert("작업자, 수량, 불량 내역을 확인하세요.");
        return;
    }
    setIsSubmitting(true);
    const batchId = crypto.randomUUID();
    try {
      const promises = defectList.map(item => onSubmit({
        batchId, model, process, range, connectionType, sensorThickness,
        version: process.includes('와이어본딩') ? version : '',
        tempEquip: process.includes('온도보상') ? tempEquip : '',
        agingEquip: process.includes('에이징') ? agingEquip : '',
        operator, remark, defectType: item.defectType, quantity: item.quantity,
        batchInspectionQty: qtyNum,
        workDateStart, workDateEnd, group: modelGroup
      }));
      await Promise.all(promises);
      setDefectList([]); setInspectionQty(0); setRemark(''); setOperator('');
      alert("저장 성공!");
    } catch (e) { alert("저장 실패: " + e.message); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in font-medium pb-40">
      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
        <h2 className="text-2xl font-black italic mb-6 flex items-center text-slate-800 tracking-tighter uppercase font-sans">
          <Activity className="mr-2 text-blue-600" /> 불량 데이터 입력
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 p-4 bg-slate-50 rounded-2xl border shadow-inner">
            <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">작업 기간 설정</label>
            <div className="flex items-center gap-2">
              <input type="date" value={workDateStart} onChange={e => setWorkDateStart(e.target.value)} className="w-full p-2 bg-white rounded-xl text-xs font-bold border-none" />
              <span className="text-slate-300">~</span>
              <input type="date" value={workDateEnd} onChange={e => setWorkDateEnd(e.target.value)} className="w-full p-2 bg-white rounded-xl text-xs font-bold border-none" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-400 font-bold tracking-widest uppercase">총 검사 수량 (EA)</label>
            <input type="number" value={inspectionQty || ''} onChange={e => setInspectionQty(e.target.value)} className="w-full p-4 bg-blue-50/50 rounded-2xl text-3xl font-black text-blue-700 outline-none border-none" placeholder="0" />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1"><label className="text-[10px] text-slate-400 font-bold uppercase">모델명</label><select value={model} onChange={e => setModel(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl border-none font-bold shadow-sm"><optgroup label="PT/UPT">{CONFIG['PT/UPT'].models.map(m => <option key={m} value={m}>{m}</option>)}</optgroup><optgroup label="IGS">{CONFIG['IGS'].models.map(m => <option key={m} value={m}>{m}</option>)}</optgroup></select></div>
          <div className="space-y-1 font-bold"><label className="text-[10px] text-slate-400 font-bold uppercase">공정</label><select value={process} onChange={e => setProcess(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none font-bold shadow-sm">{CONFIG[modelGroup].processes.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-3 gap-2 font-bold">
          <div><label className="text-[10px] text-slate-400 font-bold uppercase">Range</label><select value={range} onChange={e => setRange(e.target.value)} className="w-full p-2 bg-slate-50 rounded-lg border-none text-[11px] font-bold shadow-sm">{CONFIG[modelGroup].options.ranges.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
          <div><label className="text-[10px] text-slate-400 font-bold uppercase">Conn.</label><select value={connectionType} onChange={e => setConnectionType(e.target.value)} className="w-full p-2 bg-slate-50 rounded-lg border-none text-[11px] font-bold shadow-sm">{CONFIG[modelGroup].options.connectionTypes.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
          <div><label className="text-[10px] text-slate-400 font-bold uppercase">Thick</label><select value={sensorThickness} onChange={e => setSensorThickness(e.target.value)} className="w-full p-2 bg-slate-50 rounded-lg border-none text-[11px] font-bold shadow-sm">{CONFIG[modelGroup].options.sensorThicknesses.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(process.includes('와이어본딩') || process.includes('5.')) && CONFIG[modelGroup].options.versions?.length > 0 && (
              <div><label className="text-[10px] text-indigo-500 uppercase font-bold">Version</label><select value={version} onChange={e => setVersion(e.target.value)} className="w-full p-3 bg-indigo-50 border-none rounded-xl text-sm font-bold shadow-sm">{CONFIG[modelGroup].options.versions.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
          )}
          {(process.includes('온도보상') || process.includes('7.')) && CONFIG[modelGroup].options.tempEquipments?.length > 0 && (
              <div><label className="text-[10px] text-orange-500 uppercase font-bold">설비명(온도)</label><select value={tempEquip} onChange={e => setTempEquip(e.target.value)} className="w-full p-3 bg-orange-50 border-none rounded-xl text-sm font-bold shadow-sm">{CONFIG[modelGroup].options.tempEquipments.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
          )}
          {modelGroup === 'PT/UPT' && process.includes('에이징') && (
              <div><label className="text-[10px] text-purple-500 uppercase font-bold">설비명(에이징)</label><select value={agingEquip} onChange={e => setAgingEquip(e.target.value)} className="w-full p-3 bg-purple-50 border-none rounded-xl text-sm font-bold shadow-sm">{CONFIG['PT/UPT'].options.agingEquipments.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
          )}
        </div>
        <div className="space-y-1 font-bold"><label className="text-[10px] text-slate-400 font-bold uppercase">비고 (특이사항)</label><input type="text" value={remark} onChange={e => setRemark(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none text-sm font-bold shadow-sm" placeholder="내용 입력" /></div>
      </div>

      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 font-sans font-bold">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-slate-800 uppercase tracking-widest text-sm">불량 정보 입력</h3>
          <button onClick={handleNoDefect} className="text-[10px] font-bold bg-green-50 text-green-600 px-4 py-2 rounded-full border shadow-sm active:scale-95 transition-all"><ShieldCheck className="w-4 h-4 inline mr-1"/> 불량없음 (정상)</button>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {(CONFIG[modelGroup].defects[process] || ['기타']).map(d => (<button key={d} onClick={() => {setSelectedDefectType(d); setCustomDefectType('');}} className={`px-3 py-2 border rounded-xl text-[11px] font-bold ${selectedDefectType === d ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white'}`}>{d}</button>))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={customDefectType} onChange={e => {setCustomDefectType(e.target.value); if(e.target.value) setSelectedDefectType(null);}} placeholder="직접 입력" className="flex-1 p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none shadow-inner" />
          <input type="number" value={currentQty} onChange={e => setCurrentQty(e.target.value)} className="w-24 p-4 bg-slate-50 border-none rounded-2xl text-center font-bold outline-none shadow-inner" />
          <button onClick={handleAddToList} className="px-8 py-4 bg-slate-800 text-white font-bold rounded-2xl text-sm active:scale-95">추가</button>
        </div>
        {defectList.length > 0 && (<div className="space-y-2 border-t pt-4 mt-4">{defectList.map(item => (<div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border font-bold"><span>{item.defectType}</span><div className="flex items-center gap-4"><span className="text-red-500 font-bold text-xs">{item.quantity} EA</span><button onClick={() => setDefectList(defectList.filter(i => i.id !== item.id))}><X size={18}/></button></div></div>))}</div>)}
      </div>

      <div className="bg-slate-900 p-8 rounded-[40px] shadow-2xl text-white space-y-8 font-bold text-center">
        <input type="text" value={operator} onChange={e => setOperator(e.target.value)} className="w-full p-4 bg-white/10 rounded-2xl font-bold placeholder:text-slate-700 outline-none" placeholder="작업자 성함 *" />
        <button onClick={handleFinalSubmit} disabled={isSubmitting} className="w-full py-5 bg-blue-600 hover:bg-blue-500 rounded-3xl font-black shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
            {isSubmitting ? <RefreshCw className="animate-spin" /> : <Save />} ✨ 데이터 클라우드 전송
        </button>
      </div>
    </div>
  );
};

// --- 컴포넌트: 통계 대시보드 ---
const Dashboard = ({ data }) => {
  const [period, setPeriod] = useState('week');
  const [filterGroup, setFilterGroup] = useState('all');
  const [filterModel, setFilterModel] = useState('all');
  const [filterProcess, setFilterProcess] = useState('all');
  const [filterRange, setFilterRange] = useState('all');
  const [filterVer, setFilterVer] = useState('all');
  const [filterEqT, setFilterEqT] = useState('all');
  const dashboardRef = useRef(null);

  const availableOptions = useMemo(() => {
    const getUnique = (key) => [...new Set(data.map(item => item[key]).filter(v => v !== undefined && v !== null && v !== ''))].sort();
    return {
        models: getUnique('model'),
        processes: getUnique('process'),
        ranges: getUnique('range'),
        vers: getUnique('version'),
        eqsT: getUnique('tempEquip'),
        eqsA: getUnique('agingEquip')
    };
  }, [data]);

  const filteredData = useMemo(() => {
    const now = new Date();
    let start = new Date();
    start.setHours(0,0,0,0);
    const checkDate = (d) => {
        const target = new Date(d.workDateStart || d.timestamp?.toDate?.() || d.timestamp);
        if (period === 'day') return target >= start;
        if (period === 'week') { const wa = new Date(); wa.setDate(now.getDate() - 7); return target >= wa; }
        if (period === 'month') return target >= new Date(now.getFullYear(), now.getMonth(), 1);
        if (period === 'quarter') { const qa = new Date(); qa.setMonth(Math.floor(now.getMonth() / 3) * 3, 1); return target >= qa; }
        if (period === 'year') return target >= new Date(now.getFullYear(), 0, 1);
        return true;
    };

    return data.filter(d => {
      const derivedGroup = d.group || (['UPT900'].includes(d.model) ? 'IGS' : 'PT/UPT');
      if (filterGroup !== 'all' && derivedGroup !== filterGroup) return false;
      if (filterModel !== 'all' && d.model !== filterModel) return false;
      if (filterProcess !== 'all' && d.process !== filterProcess) return false;
      if (filterRange !== 'all' && d.range !== filterRange) return false;
      if (filterVer !== 'all' && d.version !== filterVer) return false;
      if (filterEqT !== 'all' && d.tempEquip !== filterEqT) return false;
      return checkDate(d);
    });
  }, [data, period, filterGroup, filterModel, filterProcess, filterRange, filterVer, filterEqT]);

  const stats = useMemo(() => {
    const procMap = {};
    const seenBatches = new Set();
    let totalFaults = 0;
    let totalInspected = 0;

    filteredData.forEach(d => {
      const p = d.process;
      const bKey = `${d.process}_${d.batchId}`;
      if (!procMap[p]) procMap[p] = { faults: 0, inspected: 0, breakdown: {} };
      
      if (d.defectType !== '불량없음') {
        const qty = parseInt(d.quantity) || 0;
        procMap[p].faults += qty;
        totalFaults += qty;
        procMap[p].breakdown[d.defectType] = (procMap[p].breakdown[d.defectType] || 0) + qty;
      }
      if (!seenBatches.has(bKey)) {
        seenBatches.add(bKey);
        const bQty = parseInt(d.batchInspectionQty) || 0;
        procMap[p].inspected += bQty;
        totalInspected += bQty;
      }
    });

    const procData = Object.keys(procMap).map(k => ({
      name: k,
      rate: procMap[k].inspected > 0 ? parseFloat(((procMap[k].faults / procMap[k].inspected) * 100).toFixed(2)) : 0,
      breakdownData: Object.keys(procMap[k].breakdown).map(typeKey => ({
        type: String(typeKey),
        value: Number(procMap[k].breakdown[typeKey]),
        rate: procMap[k].inspected > 0 ? parseFloat(((procMap[k].breakdown[typeKey] / procMap[k].inspected) * 100).toFixed(2)) : 0
      }))
    }));

    return { procData, totalFaults, totalInspected, defectRate: totalInspected > 0 ? ((totalFaults / totalInspected) * 100).toFixed(2) : "0.00" };
  }, [filteredData]);

  const downloadPdf = async () => {
    if (!window.html2canvas || !window.jspdf) {
        // html2canvas와 jspdf 라이브러리가 index.html에 포함되어 있어야 합니다.
        // 혹은 npm으로 설치해야 합니다.
        alert("PDF 저장 기능은 추가 라이브러리 설정이 필요합니다.");
        return;
    }
    const canvas = await window.html2canvas(dashboardRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = (canvas.height * pageWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
    pdf.save(`REPORT_${new Date().getTime()}.pdf`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-56 animate-fade-in font-sans font-bold">
      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 space-y-4 no-print">
        <div className="flex justify-between items-center border-b pb-4">
            <h3 className="font-black text-slate-800 flex items-center italic uppercase"><Filter className="w-5 h-5 mr-2 text-blue-500"/> Statistics Filter</h3>
            <button onClick={downloadPdf} className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 active:scale-95 transition-all"><Printer size={16}/> PDF 저장</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div><label className="text-[10px] text-slate-400 uppercase">모델/그룹</label><div className="flex gap-2 mt-1"><select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} className="w-1/2 p-2 bg-slate-50 border rounded-lg text-xs"><option value="all">그룹 전체</option><option value="PT/UPT">PT/UPT</option><option value="IGS">IGS</option></select><select value={filterModel} onChange={e => setFilterModel(e.target.value)} className="w-1/2 p-2 bg-slate-50 border rounded-lg text-xs"><option value="all">모델 전체</option>{availableOptions.models.map(m => <option key={m}>{m}</option>)}</select></div></div>
            <div><label className="text-[10px] text-slate-400 uppercase">공정/사양</label><div className="flex gap-2 mt-1"><select value={filterProcess} onChange={e => setFilterProcess(e.target.value)} className="w-1/2 p-2 bg-slate-50 border rounded-lg text-xs"><option value="all">공정 전체</option>{availableOptions.processes.map(v => <option key={v}>{v}</option>)}</select><select value={filterRange} onChange={e => setFilterRange(e.target.value)} className="w-1/2 p-2 bg-slate-50 border rounded-lg text-xs"><option value="all">Range 전체</option>{availableOptions.ranges.map(v => <option key={v}>{v}</option>)}</select></div></div>
            <div><label className="text-[10px] text-slate-400 uppercase">버전/설비</label><div className="flex gap-2 mt-1"><select value={filterVer} onChange={e => setFilterVer(e.target.value)} className="w-1/2 p-2 bg-indigo-50 border rounded-lg text-xs"><option value="all">버전 전체</option>{availableOptions.vers.map(v => <option key={v}>{v}</option>)}</select><select value={filterEqT} onChange={e => setFilterEqT(e.target.value)} className="w-1/2 p-2 bg-orange-50 border rounded-lg text-xs"><option value="all">설비 전체</option>{availableOptions.eqsT.map(v => <option key={v}>{v}</option>)}</select></div></div>
            <div><label className="text-[10px] text-slate-400 uppercase">조회 기간</label><select value={period} onChange={e => setPeriod(e.target.value)} className="w-full mt-1 p-2 bg-blue-50 border rounded-lg text-xs font-bold"><option value="day">오늘</option><option value="week">지난 7일</option><option value="month">이번 달</option><option value="quarter">이번 분기</option><option value="year">올해</option><option value="all">전체 기록</option></select></div>
        </div>
      </div>

      <div ref={dashboardRef} className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm"><div className="text-[10px] text-slate-400 uppercase mb-1">총 검사</div><div className="text-2xl font-black text-slate-800">{String(stats.totalInspected)}</div></div>
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm"><div className="text-[10px] text-red-400 uppercase mb-1">총 불량</div><div className="text-2xl font-black text-red-500">{String(stats.totalFaults)}</div></div>
            <div className="bg-indigo-600 p-6 rounded-[32px] shadow-xl text-white font-sans font-bold"><div className="text-[10px] opacity-70 mb-1 uppercase font-bold"><Percent className="w-3 h-3 inline mr-1"/> 불량률</div><div className="text-3xl font-black">{String(stats.defectRate)}%</div></div>
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm"><div className="text-[10px] text-green-500 mb-1 uppercase font-bold">합격률</div><div className="text-2xl font-black text-green-500">{stats.totalInspected > 0 ? (100 - Number(stats.defectRate)).toFixed(1) : "0"}%</div></div>
        </div>

        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 font-sans font-bold h-[400px]">
            <h3 className="text-xs text-slate-400 flex items-center uppercase mb-8 border-b pb-4 italic font-bold"><BarChartIcon className="w-4 h-4 mr-2 text-indigo-500"/> 전체 공정별 불량률 (%)</h3>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.procData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" fontSize={10} angle={-35} textAnchor="end" interval={0} stroke="#94a3b8" />
                    <YAxis fontSize={10} stroke="#cbd5e1" domain={[0, 'auto']} />
                    <RechartsTooltip cursor={{fill: '#f8fafc'}} />
                    <Bar name="불량률" dataKey="rate" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={25}>
                        <LabelList dataKey="rate" position="top" formatter={(v) => `${v}%`} style={{ fontSize: '10px', fontWeight: 'bold' }} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 font-sans font-bold">
            {stats.procData.filter(p => p.rate > 0).map((p, idx) => (
                <div key={idx} className="p-6 bg-white rounded-[32px] border border-slate-100 shadow-sm h-[320px]">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-sm font-bold text-slate-800">{String(p.name)} 상세 비율</span>
                        <span className="text-lg font-black text-indigo-600">{String(p.rate)}%</span>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={p.breakdownData} layout="vertical" margin={{ left: 10, right: 40 }}>
                            <XAxis type="number" hide domain={[0, 'auto']} />
                            <YAxis dataKey="type" type="category" width={110} fontSize={10} stroke="#64748b" tick={{fontWeight: 'bold'}} />
                            <RechartsTooltip formatter={(val, name, props) => [`${props.payload.value}건 (${val}%)`, '현황']} />
                            <Bar dataKey="rate" fill={CHART_COLORS[idx % CHART_COLORS.length]} radius={[0, 6, 6, 0]} barSize={12}>
                                <LabelList dataKey="rate" position="right" formatter={(val) => `${val}%`} style={{ fontSize: '9px', fontWeight: 'bold' }} />
                                {p.breakdownData.map((entry, index) => (<Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

// --- 컴포넌트: 데이터 리스트 ---
const DataList = ({ data, onDelete, onRestore }) => {
  const [hideNormal, setHideNormal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const fileInputRef = useRef(null);

  const displayedData = useMemo(() => {
    return data.filter(d => {
      if (hideNormal && d.defectType === '불량없음') return false;
      if (startDate && d.workDateStart < startDate) return false;
      if (endDate && d.workDateEnd > endDate) return false;
      return true;
    });
  }, [data, hideNormal, startDate, endDate]);

  const exportCSV = () => {
    const headers = ['작업시작', '작업종료', '모델', '공정', 'Range', 'Conn', 'Sensor', 'Ver', '설비(온도)', '설비(에이징)', '불량유형', '수량', '검사수량', '작업자', '비고'];
    const rows = displayedData.map(d => [String(d.workDateStart), String(d.workDateEnd), String(d.model), String(d.process), `"${String(d.range)}"`, `"${String(d.connectionType)}"`, `"${String(d.sensorThickness)}"`, `"${String(d.version || '')}"`, `"${String(d.tempEquip || '')}"`, `"${String(d.agingEquip || '')}"`, String(d.defectType), String(d.quantity), String(d.batchInspectionQty), String(d.operator), `"${String(d.remark || '').replace(/"/g, '""')}"`]);
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'QMS_LOG_MASTER.csv'; link.click();
  };

  const backupJSON = () => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'QMS_BACKUP.json'; link.click();
  };

  const handleRestore = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const arr = JSON.parse(ev.target.result);
            if (window.confirm(`${arr.length}건의 데이터를 복구하시겠습니까?`)) {
                await onRestore(arr);
                alert("데이터 복구가 완료되었습니다.");
            }
        } catch (err) { alert("잘못된 파일입니다."); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-[90rem] mx-auto space-y-6 pb-60 animate-fade-in no-print font-sans font-bold">
      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 space-y-6 font-bold">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3 font-sans font-bold"><Database size={24} className="text-blue-600"/><h3 className="font-black text-slate-800 uppercase tracking-tight">통합 품질 마스터 로그</h3></div>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportCSV} className="px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-green-700 active:scale-95 shadow-lg"><FileSpreadsheet size={16}/> 엑셀(CSV)</button>
            <button onClick={backupJSON} className="px-4 py-2 bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800 active:scale-95 shadow-lg"><DownloadCloud size={16}/> 백업</button>
            <button onClick={() => fileInputRef.current.click()} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-blue-700 active:scale-95 shadow-lg"><UploadCloud size={16}/> 복원</button>
            <input type="file" ref={fileInputRef} onChange={handleRestore} className="hidden" accept=".json" />
          </div>
        </div>
        <div className="p-4 bg-slate-50 rounded-2xl flex flex-wrap items-center gap-6 font-sans font-bold"><div className="flex items-center gap-2 font-sans font-bold"><span className="text-[11px] text-slate-400 font-black italic">기간 검색:</span><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold shadow-sm font-sans" /><span className="text-slate-300">~</span><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold shadow-sm font-sans" /></div><button onClick={() => setHideNormal(!hideNormal)} className={`px-4 py-2 rounded-xl text-xs flex items-center gap-2 border font-bold transition-all ${hideNormal ? 'bg-red-50 text-red-600 border-red-100' : 'bg-white text-slate-500 border-slate-200 shadow-sm'}`}>{hideNormal ? <EyeOff size={14}/> : <Eye size={14}/>} {hideNormal ? "숨김 해제" : "정상 데이터 숨김"}</button></div>
      </div>

      <div className="bg-white rounded-[40px] shadow-sm border overflow-hidden overflow-x-auto font-sans font-bold">
        <table className="w-full text-left text-[11px] whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-400 font-bold uppercase border-b">
            <tr><th className="p-6">작업 기간</th><th className="p-6">모델/공정</th><th className="p-6">사양/Ver/설비</th><th className="p-6">불량 유형</th><th className="p-6">수량(불/검)</th><th className="p-6">작업자</th><th className="p-6"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {displayedData.map(d => (
              <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="p-6 text-slate-400 font-mono text-[10px] leading-relaxed">{String(d.workDateStart)} <br/> ~ <br/> {String(d.workDateEnd)}</td>
                <td className="p-6 font-bold"><div className="text-slate-800">{String(d.model)}</div><div className="text-[9px] text-blue-500 uppercase font-bold">{String(d.process)}</div></td>
                <td className="p-6 font-bold text-slate-500">
                    <div className="text-slate-600">{String(d.range)}</div>
                    <div className="text-[9px] opacity-30 uppercase">{String(d.connectionType)} | {String(d.sensorThickness)} {d.version ? `| V:${d.version}` : ''} {d.tempEquip ? `| Te:${d.tempEquip}` : ''} {d.agingEquip ? `| Ag:${d.agingEquip}` : ''}</div>
                </td>
                <td className="p-6 font-bold text-center"><span className={`px-2 py-0.5 rounded-lg border font-bold text-[10px] uppercase ${d.defectType === '불량없음' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{String(d.defectType)}</span></td>
                <td className="p-6 text-center font-mono font-bold"><span className="text-red-500">{String(d.quantity)}</span> / <span className="text-slate-400">{String(d.batchInspectionQty)}</span></td>
                <td className="p-6 font-bold">{String(d.operator)}</td>
                <td className="p-6 text-right"><button onClick={() => {if(window.confirm('삭제?')) onDelete(d.id)}} className="p-2 text-slate-200 hover:text-red-500 active:scale-75"><Trash2 size={16}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Main Root Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('input');
  const [defects, setDefects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // 기존 샌드박스 토큰 로직 제거하고 익명 로그인만 활성화
        await signInAnonymously(auth);
      } catch (e) { console.error("Auth Failure", e); }
      finally { setLoading(false); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', APP_ID, 'public', 'data', 'defects');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), sortDate: doc.data().timestamp?.toDate?.() || new Date() }));
      docs.sort((a, b) => b.sortDate - a.sortDate);
      setDefects(docs);
    });
    return () => unsubscribe();
  }, [user]);

  const addDefect = async (data) => {
    if (!user) return;
    await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'defects'), {
      ...data,
      timestamp: serverTimestamp(),
      userId: user.uid
    });
  };

  const handleRestore = async (arr) => {
    if (!user) return;
    for (const item of arr) {
        const { id, timestamp, sortDate, ...rest } = item;
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'defects'), {
            ...rest,
            timestamp: serverTimestamp(),
            userId: user.uid
        });
    }
  };

  const executeDelete = async (id) => {
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'defects', id));
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-bold font-sans">QMS 시스템 로딩 중...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 antialiased font-bold">
      <header className="bg-white border-b px-8 py-6 sticky top-0 z-50 shadow-sm bg-white/90 backdrop-blur-md flex justify-between items-center no-print font-bold">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-600 p-3 rounded-[16px] shadow-2xl transition-all hover:scale-110 font-bold">
              <Activity className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter uppercase italic">UHP PT <span className="text-blue-600 not-italic font-bold">QMS</span></h1>
          </div>
          <div className="flex items-center text-[10px] font-bold text-slate-400 bg-slate-50 px-4 py-2 rounded-full border">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            SYSTEM ONLINE
          </div>
      </header>

      <main className="p-4 pt-10 max-w-7xl mx-auto font-medium font-sans font-bold">
        {activeTab === 'input' && <InputScreen onSubmit={addDefect} />}
        {activeTab === 'dashboard' && <Dashboard data={defects} />}
        {activeTab === 'list' && <DataList data={defects} onDelete={executeDelete} onRestore={handleRestore} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-3xl border-t flex justify-around p-3 pb-12 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] px-4 no-print font-bold">
        {[
          { id: 'input', label: '현장 입력', icon: <ClipboardList className="w-6 h-6 font-bold" /> },
          { id: 'dashboard', label: '실시간 통계', icon: <BarChartIcon className="w-6 h-6 font-bold" /> },
          { id: 'list', label: '전체 목록', icon: <TableIcon className="w-6 h-6 font-bold" /> }
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex flex-col items-center p-3 rounded-2xl transition-all duration-300 w-28 group ${activeTab === t.id ? 'text-blue-600 scale-110 font-bold' : 'text-slate-400 opacity-60'}`}>
            <div className={`p-2 rounded-xl mb-1 ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-lg shadow-blue-200' : 'bg-transparent'}`}>{t.icon}</div>
            <span className="text-[10px] font-bold uppercase tracking-widest">{t.label}</span>
          </button>
        ))}
      </nav>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;700;900&display=swap');
        body { font-family: 'Pretendard', sans-serif; }
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        @media print { .no-print { display: none !important; } main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; } }
      `}</style>
    </div>
  );
}
