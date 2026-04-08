import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Minus,
  Trash2, 
  Download, 
  Upload, 
  Info, 
  Target, 
  Activity, 
  Settings, 
  Flame, 
  Trophy, 
  Zap, 
  Hash, 
  Footprints, 
  User as UserIcon, 
  X, 
  MousePointer2,
  BarChart3,
  RefreshCw,
  FileDown,
  Play,
  Pause,
  RotateCcw,
  Clock,
  FileSpreadsheet,
  Save,
  List,
  LogOut,
  LogIn,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

import { Shot, BodyPart, AssistType, DEFAULT_PITCH } from './types';
import { calculateXG, generateXGGrid } from './lib/xgModel';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut,
  handleFirestoreError,
  OperationType
} from './firebase';
import { 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Types
interface Match {
  id: string;
  userId: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  createdAt: any;
  totalXG: number;
  totalGoals: number;
  dangerEventsHome?: any;
  dangerEventsAway?: any;
  goalsHome?: number;
  goalsAway?: number;
  possessionHomeSeconds?: number;
  possessionAwaySeconds?: number;
  matchEvents?: MatchEvent[];
}

interface MatchEvent {
  id: string;
  minute: number;
  type: 'shot' | 'goal' | 'danger_event' | 'possession_change' | 'match_start' | 'match_pause' | 'match_reset';
  team: 'home' | 'away' | 'none';
  description: string;
  timestamp: number;
  value?: number;
}

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showGridValues, setShowGridValues] = useState(false);
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  
  // Auth & Database States
  const [user, setUser] = useState<User | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [showMatchList, setShowMatchList] = useState(false);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [homeTeam, setHomeTeam] = useState('Bologna U18');
  const [awayTeam, setAwayTeam] = useState('Avversario');
  const [isSaving, setIsSaving] = useState(false);

  // UI States
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null);
  const [showToast, setShowToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'xg' | 'dangerzone'>('xg');

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [possessionState, setPossessionState] = useState<'home' | 'away' | 'none'>('none');
  const [possessionHomeSeconds, setPossessionHomeSeconds] = useState(0);
  const [possessionAwaySeconds, setPossessionAwaySeconds] = useState(0);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);

  const addMatchEvent = (event: Omit<MatchEvent, 'id' | 'timestamp' | 'minute'>) => {
    const newEvent: MatchEvent = {
      id: Math.random().toString(36).substr(2, 9),
      minute: Math.floor(timerSeconds / 60),
      timestamp: Date.now(),
      ...event
    };
    setMatchEvents(prev => [newEvent, ...prev]);
  };

  // Dangerzone State
  const [dangerEventsHome, setDangerEventsHome] = useState({
    shotsIn: 0,
    shotsOut: 0,
    penalties: 0,
    freeKicks: 0,
    corners: 0,
    crosses: 0
  });

  const [dangerEventsAway, setDangerEventsAway] = useState({
    shotsIn: 0,
    shotsOut: 0,
    penalties: 0,
    freeKicks: 0,
    corners: 0,
    crosses: 0
  });

  const [goalsHome, setGoalsHome] = useState(0);
  const [goalsAway, setGoalsAway] = useState(0);

  const weights = {
    shotsIn: 1.3,
    shotsOut: 0.7,
    penalties: 15,
    freeKicks: 1.2,
    corners: 0.5,
    crosses: 0.2
  };

  const calculateIPO = (events: typeof dangerEventsHome) => {
    return Object.entries(events).reduce((sum: number, [key, count]) => {
      return sum + (Number(count) * weights[key as keyof typeof weights]);
    }, 0);
  };

  const ipoHome = useMemo(() => calculateIPO(dangerEventsHome), [dangerEventsHome]);
  const ipoAway = useMemo(() => calculateIPO(dangerEventsAway), [dangerEventsAway]);

  const [newShotConfig, setNewShotConfig] = useState<{
    bodyPart: BodyPart;
    assistType: AssistType;
    isGoal: boolean;
    playerName: string;
    minute: number;
  }>({
    bodyPart: 'foot',
    assistType: 'none',
    isGoal: false,
    playerName: '',
    minute: 0,
  });

  const pitchRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const xgGrid = useMemo(() => generateXGGrid(), []);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
        
        // Track possession
        if (possessionState === 'home') {
          setPossessionHomeSeconds(prev => prev + 1);
        } else if (possessionState === 'away') {
          setPossessionAwaySeconds(prev => prev + 1);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, possessionState]);

  // Record possession changes
  const prevPossessionState = useRef(possessionState);
  useEffect(() => {
    if (prevPossessionState.current !== possessionState) {
      if (possessionState !== 'none') {
        addMatchEvent({
          type: 'possession_change',
          team: possessionState,
          description: `Inizio possesso ${possessionState === 'home' ? homeTeam : awayTeam}`
        });
      }
      prevPossessionState.current = possessionState;
    }
  }, [possessionState]);

  // Record timer start/stop
  const prevIsTimerRunning = useRef(isTimerRunning);
  useEffect(() => {
    if (prevIsTimerRunning.current !== isTimerRunning) {
      addMatchEvent({
        type: isTimerRunning ? 'match_start' : 'match_pause',
        team: 'none',
        description: isTimerRunning ? 'Timer Avviato' : 'Timer Pausato'
      });
      prevIsTimerRunning.current = isTimerRunning;
    }
  }, [isTimerRunning]);

  const currentMinute = Math.floor(timerSeconds / 60);

  // Stats
  const totalXG = useMemo(() => shots.reduce((sum, s) => sum + s.xg, 0), [shots]);
  const totalGoals = useMemo(() => shots.filter(s => s.isGoal).length, [shots]);
  const xgPerShot = useMemo(() => shots.length > 0 ? totalXG / shots.length : 0, [shots, totalXG]);

  // Chart Data
  const chartData = useMemo(() => [
    { name: 'Expected Goals (xG)', value: totalXG, color: '#10b981' },
    { name: 'Gol Reali', value: totalGoals, color: '#eab308' },
  ], [totalXG, totalGoals]);

  const handlePitchClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pitchRef.current) return;

    const rect = pitchRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const mY = (clickX / rect.width) * DEFAULT_PITCH.width;
    const mX = (clickY / rect.height) * DEFAULT_PITCH.height;

    const xg = calculateXG(mX, mY, newShotConfig.bodyPart, newShotConfig.assistType);

    const newShot: Shot = {
      id: Math.random().toString(36).substr(2, 9),
      x: mX,
      y: mY,
      isGoal: newShotConfig.isGoal,
      bodyPart: newShotConfig.bodyPart,
      assistType: newShotConfig.assistType,
      xg,
      timestamp: Date.now(),
      minute: currentMinute,
      playerName: newShotConfig.playerName || 'Giocatore',
    };

    setShots(prev => [...prev, newShot]);
    setSelectedShot(newShot);

    // Record match event
    addMatchEvent({
      type: newShot.isGoal ? 'goal' : 'shot',
      team: 'home', // Assuming home team for now, or we can add team selection to shot config
      description: `${newShot.isGoal ? 'GOL!' : 'Tiro'} - xG: ${newShot.xg.toFixed(2)} (${newShot.playerName})`,
      value: newShot.xg
    });
  };

  const updateShot = (id: string, updates: Partial<Shot>) => {
    setShots(prev => prev.map(s => {
      if (s.id === id) {
        const updatedShot = { ...s, ...updates };
        // Recalculate xG if position or factors change
        if (updates.x !== undefined || updates.y !== undefined || updates.bodyPart !== undefined || updates.assistType !== undefined) {
          updatedShot.xg = calculateXG(updatedShot.x, updatedShot.y, updatedShot.bodyPart, updatedShot.assistType);
        }
        return updatedShot;
      }
      return s;
    }));
    
    if (selectedShot?.id === id) {
      setSelectedShot(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const removeShot = (id: string) => {
    setShots(prev => prev.filter(s => s.id !== id));
    if (selectedShot?.id === id) setSelectedShot(null);
  };

  const exportToPDF = async () => {
    if (!dashboardRef.current) {
      setShowToast({ message: 'Dashboard non trovata', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      // Scroll to top to ensure html2canvas captures correctly
      window.scrollTo(0, 0);

      const element = dashboardRef.current;
      
      // Wait a bit for any pending animations
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(element, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#0a0a0a',
        logging: false,
        allowTaint: true,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.7);
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      pdf.save(`MatchReport_${homeTeam}_vs_${awayTeam}_${new Date().toISOString().split('T')[0]}.pdf`);
      
      setShowToast({ message: 'Report PDF generato con successo!', type: 'success' });
    } catch (error) {
      console.error('Errore PDF:', error);
      setShowToast({ message: 'Errore durante la generazione del PDF. Assicurati che non ci siano blocchi nel browser.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Load matches for the user
        const q = query(
          collection(db, 'matches'), 
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc')
        );
        
        const unsubMatches = onSnapshot(q, (snapshot) => {
          const matchesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Match[];
          setMatches(matchesData);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'matches');
        });

        return () => unsubMatches();
      } else {
        setMatches([]);
        setShowMatchList(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Errore login:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      clearAll();
      setCurrentMatchId(null);
    } catch (error) {
      console.error("Errore logout:", error);
    }
  };

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const saveMatch = async () => {
    if (!user) {
      setShowToast({ message: "Devi effettuare l'accesso per salvare la partita.", type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const matchData = {
        userId: user.uid,
        homeTeam,
        awayTeam,
        date: new Date().toISOString(),
        createdAt: serverTimestamp(),
        totalXG: totalXG,
        totalGoals: totalGoals,
        dangerEventsHome,
        dangerEventsAway,
        goalsHome,
        goalsAway,
        possessionHomeSeconds,
        possessionAwaySeconds
      };

      let matchId = currentMatchId;
      if (matchId) {
        await setDoc(doc(db, 'matches', matchId), matchData, { merge: true });
      } else {
        const docRef = await addDoc(collection(db, 'matches'), matchData);
        matchId = docRef.id;
        setCurrentMatchId(matchId);
      }

      // Save shots
      if (matchId) {
        const shotsSnapshot = await getDocs(collection(db, 'matches', matchId, 'shots'));
        for (const shotDoc of shotsSnapshot.docs) {
          await deleteDoc(doc(db, 'matches', matchId, 'shots', shotDoc.id));
        }
      }

      for (const shot of shots) {
        await addDoc(collection(db, 'matches', matchId, 'shots'), {
          ...shot,
          matchId,
          timestamp: new Date().toISOString()
        });
      }

      setShowToast({ message: "Partita salvata con successo!", type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'matches');
      setShowToast({ message: "Errore durante il salvataggio", type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const loadMatch = async (match: Match) => {
    try {
      setCurrentMatchId(match.id);
      setHomeTeam(match.homeTeam);
      setAwayTeam(match.awayTeam);
      setDangerEventsHome(match.dangerEventsHome || { shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
      setDangerEventsAway(match.dangerEventsAway || { shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
      setGoalsHome(match.goalsHome || 0);
      setGoalsAway(match.goalsAway || 0);
      setPossessionHomeSeconds(match.possessionHomeSeconds || 0);
      setPossessionAwaySeconds(match.possessionAwaySeconds || 0);
      setPossessionState('none');
      
      const shotsSnapshot = await getDocs(collection(db, 'matches', match.id, 'shots'));
      const shotsData = shotsSnapshot.docs.map(doc => doc.data() as Shot);
      setShots(shotsData);
      setShowMatchList(false);
      setSelectedShot(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `matches/${match.id}/shots`);
    }
  };

  const deleteMatch = async (matchId: string) => {
    if (!user) return;
    
    try {
      // Delete shots subcollection first
      const shotsSnapshot = await getDocs(collection(db, 'matches', matchId, 'shots'));
      const deletePromises = shotsSnapshot.docs.map(shotDoc => 
        deleteDoc(doc(db, 'matches', matchId, 'shots', shotDoc.id))
      );
      await Promise.all(deletePromises);
      
      // Delete the match document
      await deleteDoc(doc(db, 'matches', matchId));
      
      if (currentMatchId === matchId) {
        clearAll();
        setCurrentMatchId(null);
      }
      setMatchToDelete(null);
      setShowToast({ message: "Partita eliminata con successo!", type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `matches/${matchId}`);
      setShowToast({ message: "Errore durante l'eliminazione", type: 'error' });
    }
  };

  const clearAll = () => {
    setShots([]);
    setSelectedShot(null);
    setShowResetConfirm(false);
    setCurrentMatchId(null);
    setTimerSeconds(0);
    setIsTimerRunning(false);
    setDangerEventsHome({ shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
    setDangerEventsAway({ shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
    setGoalsHome(0);
    setGoalsAway(0);
    setPossessionHomeSeconds(0);
    setPossessionAwaySeconds(0);
    setPossessionState('none');
    setMatchEvents([]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedShots: Shot[] = results.data.map((row: any) => {
          const x = parseFloat(row.x);
          const y = parseFloat(row.y);
          const bodyPart = (row.bodyPart as BodyPart) || 'foot';
          const assistType = (row.assistType as AssistType) || 'none';
          const minute = parseInt(row.minute) || 0;
          return {
            id: Math.random().toString(36).substr(2, 9),
            x,
            y,
            isGoal: row.isGoal === 'true' || row.isGoal === '1',
            bodyPart,
            assistType,
            xg: calculateXG(x, y, bodyPart, assistType),
            timestamp: Date.now(),
            minute,
            playerName: row.playerName || 'Giocatore',
          };
        });
        setShots(prev => [...prev, ...parsedShots]);
      },
    });
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(shots);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Match Analysis");
    XLSX.writeFile(workbook, `xg_analysis_${Date.now()}.xlsx`);
  };

  const downloadTemplate = () => {
    const template = [
      { playerName: 'Esempio', x: 10, y: 34, isGoal: 'true', bodyPart: 'foot', assistType: 'pass', minute: 15 },
      { playerName: 'Esempio 2', x: 25, y: 20, isGoal: 'false', bodyPart: 'head', assistType: 'cross', minute: 42 },
    ];
    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `xg_template.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getXGColor = (val: number) => {
    if (val < 0.1) return 'rgba(16, 185, 129, 0.4)'; // Emerald/Green
    if (val < 0.3) return 'rgba(234, 179, 8, 0.4)'; // Yellow
    if (val < 0.6) return 'rgba(249, 115, 22, 0.4)'; // Orange
    return 'rgba(220, 38, 38, 0.4)'; // Red
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="bg-black/40 border-b border-white/10 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-auto min-h-[80px] py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl group hover:border-blue-500/50 transition-all duration-500">
                <Activity className="w-6 h-6 text-blue-500 group-hover:scale-110 transition-transform duration-500" />
              </div>
              <div>
                <h1 className="font-black text-xl sm:text-2xl tracking-tighter text-white leading-none uppercase">Analysis <span className="text-blue-500">Hub</span></h1>
              </div>
            </div>

            {/* Mobile Auth/Save Actions */}
            <div className="flex md:hidden items-center gap-2">
              {user ? (
                <button 
                  onClick={saveMatch}
                  disabled={isSaving}
                  className="p-2 rounded-lg bg-blue-600 text-white shadow-lg"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </button>
              ) : (
                <button 
                  onClick={login}
                  className="p-2 rounded-lg bg-blue-600 text-white"
                >
                  <LogIn className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-nowrap items-center justify-end gap-2 sm:gap-3 w-full md:w-auto overflow-x-auto no-scrollbar">
            {/* Possession UI */}
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-2 sm:px-3 py-1.5 shrink-0">
              <div className="flex flex-col gap-1">
                <div className="h-1.5 w-24 sm:w-32 bg-white/10 rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-yellow-500 transition-all duration-500" 
                    style={{ width: `${possessionHomeSeconds + possessionAwaySeconds > 0 ? (possessionHomeSeconds / (possessionHomeSeconds + possessionAwaySeconds)) * 100 : 50}%` }}
                  />
                  <div 
                    className="h-full bg-blue-500 transition-all duration-500" 
                    style={{ width: `${possessionHomeSeconds + possessionAwaySeconds > 0 ? (possessionAwaySeconds / (possessionHomeSeconds + possessionAwaySeconds)) * 100 : 50}%` }}
                  />
                </div>
                <div className="flex justify-between items-center w-24 sm:w-32">
                  <span className="text-[9px] font-black text-white">
                    {possessionHomeSeconds + possessionAwaySeconds > 0 ? Math.round((possessionHomeSeconds / (possessionHomeSeconds + possessionAwaySeconds)) * 100) : 50}%
                  </span>
                  <span className="text-[9px] font-black text-white">
                    {possessionHomeSeconds + possessionAwaySeconds > 0 ? Math.round((possessionAwaySeconds / (possessionHomeSeconds + possessionAwaySeconds)) * 100) : 50}%
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => setPossessionState(possessionState === 'home' ? 'none' : 'home')}
                  className={cn(
                    "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all border",
                    possessionState === 'home' ? "bg-yellow-500 border-yellow-400 text-black shadow-lg shadow-yellow-500/20" : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                  )}
                >
                  <div className="font-black text-[9px]">H</div>
                </button>
                <button 
                  onClick={() => setPossessionState('none')}
                  className={cn(
                    "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all border",
                    possessionState === 'none' ? "bg-white/20 border-white/30 text-white" : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                  )}
                >
                  <X className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => setPossessionState(possessionState === 'away' ? 'none' : 'away')}
                  className={cn(
                    "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all border",
                    possessionState === 'away' ? "bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/20" : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                  )}
                >
                  <div className="font-black text-[9px]">A</div>
                </button>
              </div>
            </div>

            <div className="h-8 w-px bg-white/10 shrink-0" />

            {/* Timer UI */}
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-2 sm:px-3 py-1.5 shrink-0">
              <span className="text-xs sm:text-sm font-black font-mono tabular-nums text-white">
                {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:{String(timerSeconds % 60).padStart(2, '0')}
              </span>
              <div className="flex gap-1">
                <button 
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className={cn(
                    "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all",
                    isTimerRunning ? "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20" : "bg-blue-600/10 text-blue-500 hover:bg-blue-600/20"
                  )}
                >
                  {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button 
                  onClick={() => {
                    setTimerSeconds(0);
                    setIsTimerRunning(false);
                    setPossessionHomeSeconds(0);
                    setPossessionAwaySeconds(0);
                    setPossessionState('none');
                  }}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="h-8 w-px bg-white/10 shrink-0" />

            <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10 shrink-0">
              <button 
                onClick={() => setActiveTab('xg')}
                className={cn(
                  "px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1.5",
                  activeTab === 'xg' ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white"
                )}
              >
                <Target className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Match</span>
              </button>
              <button 
                onClick={() => setActiveTab('dangerzone')}
                className={cn(
                  "px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1.5",
                  activeTab === 'dangerzone' ? "bg-yellow-500 text-black shadow-lg" : "text-gray-400 hover:text-white"
                )}
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Danger</span>
              </button>
            </div>

            <div className="hidden sm:block h-8 w-px bg-white/10" />

            {activeTab === 'xg' && (
              <div className="flex items-center bg-white/5 rounded-lg p-1 border border-white/10">
                <button 
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className={cn(
                    "px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-medium transition-all flex items-center gap-1.5 sm:gap-2",
                    showHeatmap ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white"
                  )}
                >
                  <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span className="hidden xs:inline">Heat Map</span>
                </button>
                <button 
                  onClick={() => setShowGridValues(!showGridValues)}
                  className={cn(
                    "px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-medium transition-all flex items-center gap-1.5 sm:gap-2",
                    showGridValues ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white"
                  )}
                >
                  <Hash className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span className="hidden xs:inline">Grid</span>
                </button>
              </div>
            )}

            <div className="hidden md:flex items-center gap-2">
              <button 
                onClick={exportToExcel}
                className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
                title="Esporta Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden xl:inline text-xs font-bold">Excel</span>
              </button>
            </div>

            <div className="hidden md:block h-8 w-px bg-white/10" />

            <div className="hidden md:flex items-center gap-2">
              {user ? (
                <>
                  <button 
                    onClick={() => setShowMatchList(true)}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/10 flex items-center gap-2"
                    title="Le mie partite"
                  >
                    <List className="w-4 h-4" />
                    <span className="hidden xl:inline text-xs font-bold">Partite</span>
                  </button>
                  <button 
                    onClick={exportToPDF}
                    disabled={isSaving}
                    className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50"
                    title="Esporta PDF"
                  >
                    <FileDown className="w-4 h-4" />
                    <span className="hidden xl:inline text-xs font-bold">Report PDF</span>
                  </button>
                  <button 
                    onClick={saveMatch}
                    disabled={isSaving}
                    className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50"
                    title="Salva Partita"
                  >
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span className="hidden xl:inline text-xs font-bold">Salva</span>
                  </button>
                  <button 
                    onClick={logout}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-500 transition-all border border-white/10"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button 
                  onClick={login}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <LogIn className="w-4 h-4" />
                  Accedi
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main ref={dashboardRef} className="max-w-[1600px] mx-auto p-4 sm:p-6">
        {activeTab === 'xg' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Pitch & Controls */}
            <div className="lg:col-span-8 space-y-6">
              {/* Team Names Input */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Casa</label>
              <input 
                type="text" 
                value={homeTeam}
                onChange={(e) => setHomeTeam(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div className="text-gray-600 font-black italic px-2 hidden sm:block text-xl">VS</div>
            <div className="flex-1 w-full">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Trasferta</label>
              <input 
                type="text" 
                value={awayTeam}
                onChange={(e) => setAwayTeam(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>
          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 border border-white/10 p-4 sm:p-5 rounded-2xl backdrop-blur-sm group relative"
            >
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
                <div className="bg-black/80 backdrop-blur-md border border-white/10 p-3 rounded-xl text-[10px] w-48 shadow-2xl z-50">
                  <p className="font-bold text-emerald-500 mb-1 uppercase tracking-widest">Formula xG</p>
                  <p className="text-gray-400 leading-relaxed">
                    P(gol) = 1 / (1 + e^-(β0 + β1·dist + β2·angolo + β3·piede + β4·assist))
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest">Total xG</span>
                <Activity className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-white">{totalXG.toFixed(2)}</span>
                <span className="text-[10px] sm:text-xs text-emerald-500 font-bold">+{((totalXG / (totalGoals || 1)) * 10).toFixed(1)}%</span>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/5 border border-white/10 p-4 sm:p-5 rounded-2xl backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest">Gol Reali</span>
                <Trophy className="w-4 h-4 text-yellow-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-white">{totalGoals}</span>
                <span className="text-[10px] sm:text-xs text-gray-400 font-medium">vs {totalXG.toFixed(1)} xG</span>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/5 border border-white/10 p-4 sm:p-5 rounded-2xl backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest">xG per Tiro</span>
                <Zap className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-white">{xgPerShot.toFixed(2)}</span>
                <span className="text-[10px] sm:text-xs text-emerald-500 font-bold">{shots.length} tiri tot.</span>
              </div>
            </motion.div>
          </div>

          {/* Pitch Container */}
          <div className="relative bg-black/40 border border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl">
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 flex gap-2">
              <div className="bg-black/60 backdrop-blur-md border border-white/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full flex items-center gap-1.5 sm:gap-2 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-600 animate-pulse" />
                Live Analysis
              </div>
            </div>

            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex gap-2">
              <AnimatePresence>
                {showResetConfirm ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: 20 }}
                    className="bg-black/80 backdrop-blur-md border border-white/10 p-1.5 sm:p-2 rounded-xl flex items-center gap-2 sm:gap-3 shadow-2xl"
                  >
                    <span className="text-[8px] sm:text-[10px] font-bold text-white px-1 sm:px-2">Reset?</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={clearAll}
                        className="bg-red-500 hover:bg-red-400 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[8px] sm:text-[10px] font-black uppercase transition-all"
                      >
                        Sì
                      </button>
                      <button 
                        onClick={() => setShowResetConfirm(false)}
                        className="bg-white/10 hover:bg-white/20 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[8px] sm:text-[10px] font-black uppercase transition-all"
                      >
                        No
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <button 
                    onClick={() => setShowResetConfirm(true)}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[8px] sm:text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 sm:gap-2"
                  >
                    <RefreshCw className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    Resetta
                  </button>
                )}
              </AnimatePresence>
            </div>

            <div 
              ref={pitchRef}
              onClick={handlePitchClick}
              className="relative aspect-[2/1] w-full cursor-crosshair group"
              style={{
                backgroundImage: 'radial-gradient(circle at center, #1a1a1a 0%, #0a0a0a 100%)'
              }}
            >
              {/* Pitch Markings */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" viewBox="0 0 68 34">
                <rect x="0" y="0" width="68" height="34" fill="none" stroke="white" strokeWidth="0.2" />
                <rect x="13.84" y="0" width="40.32" height="16.5" fill="none" stroke="white" strokeWidth="0.2" />
                <rect x="24.84" y="0" width="18.32" height="5.5" fill="none" stroke="white" strokeWidth="0.2" />
                <circle cx="34" cy="11" r="0.3" fill="white" />
                <path d="M 27.5 16.5 A 9.15 9.15 0 0 0 40.5 16.5" fill="none" stroke="white" strokeWidth="0.2" />
                <rect x="30.34" y="-1" width="7.32" height="1" fill="none" stroke="white" strokeWidth="0.4" />
              </svg>

              {/* Heatmap Overlay */}
              <AnimatePresence>
                {showHeatmap && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 grid grid-cols-[repeat(34,1fr)] grid-rows-[repeat(17,1fr)] pointer-events-none"
                  >
                    {xgGrid.map((row, r) => 
                      row.map((val, c) => (
                        <div 
                          key={`${r}-${c}`}
                          className="flex items-center justify-center border-[0.5px] border-white/5 transition-colors duration-500"
                          style={{ backgroundColor: getXGColor(val) }}
                        >
                          {showGridValues && (
                            <span className="text-[6px] font-bold text-white/40">{val.toFixed(2)}</span>
                          )}
                        </div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Shots */}
              {shots.map((shot) => (
                <motion.button
                  key={shot.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedShot(shot);
                  }}
                  className={cn(
                    "absolute w-3 h-3 sm:w-4 sm:h-4 -ml-1.5 -mt-1.5 sm:-ml-2 sm:-mt-2 rounded-full border-[1.5px] sm:border-2 flex items-center justify-center transition-all hover:scale-150 z-20",
                    shot.isGoal 
                      ? "bg-yellow-500 border-white shadow-[0_0_15px_rgba(234,179,8,0.5)]" 
                      : "bg-emerald-500 border-black shadow-[0_0_10px_rgba(16,185,129,0.3)]",
                    selectedShot?.id === shot.id && "ring-2 sm:ring-4 ring-white scale-150"
                  )}
                  style={{
                    left: `${(shot.y / DEFAULT_PITCH.width) * 100}%`,
                    top: `${(shot.x / DEFAULT_PITCH.height) * 100}%`,
                  }}
                />
              ))}

              {shots.length === 0 && !showHeatmap && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
                      <MousePointer2 className="w-8 h-8 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium">Clicca sulla mappa per aggiungere un tiro</p>
                      <p className="text-gray-600 text-sm">Configura i parametri nel pannello a destra</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chart Section */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              <h2 className="font-bold text-sm uppercase tracking-widest text-gray-400">Performance: xG vs Gol</h2>
            </div>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 40 }}>
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }}
                    width={120}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          {/* Configuration Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4 sm:mb-6">
              <Settings className="w-4 h-4 text-red-500" />
              <h2 className="font-bold text-xs sm:text-sm uppercase tracking-widest text-gray-400">
                {selectedShot ? 'Modifica Tiro' : 'Nuovo Tiro'}
              </h2>
            </div>

            <div className="space-y-4 sm:space-y-6">
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase mb-2 sm:mb-3 block">Nome Giocatore</label>
                <input 
                  type="text"
                  value={selectedShot ? selectedShot.playerName : newShotConfig.playerName}
                  onChange={(e) => {
                    if (selectedShot) {
                      updateShot(selectedShot.id, { playerName: e.target.value });
                    } else {
                      setNewShotConfig(prev => ({ ...prev, playerName: e.target.value }));
                    }
                  }}
                  placeholder="Es. Lautaro Martinez"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase mb-2 sm:mb-3 block">Parte Corpo</label>
                  <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                    <button 
                      onClick={() => {
                        if (selectedShot) {
                          updateShot(selectedShot.id, { bodyPart: 'foot' });
                        } else {
                          setNewShotConfig(prev => ({ ...prev, bodyPart: 'foot' }));
                        }
                      }}
                      className={cn(
                        "flex-1 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2",
                        (selectedShot ? selectedShot.bodyPart : newShotConfig.bodyPart) === 'foot' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                      )}
                    >
                      <Footprints className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      Piede
                    </button>
                    <button 
                      onClick={() => {
                        if (selectedShot) {
                          updateShot(selectedShot.id, { bodyPart: 'head' });
                        } else {
                          setNewShotConfig(prev => ({ ...prev, bodyPart: 'head' }));
                        }
                      }}
                      className={cn(
                        "flex-1 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2",
                        (selectedShot ? selectedShot.bodyPart : newShotConfig.bodyPart) === 'head' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                      )}
                    >
                      <UserIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      Testa
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase mb-2 sm:mb-3 block">Risultato</label>
                  <button 
                    onClick={() => {
                      if (selectedShot) {
                        updateShot(selectedShot.id, { isGoal: !selectedShot.isGoal });
                      } else {
                        setNewShotConfig(prev => ({ ...prev, isGoal: !prev.isGoal }));
                      }
                    }}
                    className={cn(
                      "w-full py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all border flex items-center justify-center gap-1.5 sm:gap-2",
                      (selectedShot ? selectedShot.isGoal : newShotConfig.isGoal) 
                        ? "bg-yellow-500 border-yellow-400 text-black" 
                        : "bg-white/5 border-white/10 text-gray-400"
                    )}
                  >
                    {(selectedShot ? selectedShot.isGoal : newShotConfig.isGoal) ? 'GOL' : 'NO GOL'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase mb-2 sm:mb-3 block">Minuto</label>
                  <div className="flex items-center bg-black/40 border border-white/10 rounded-xl px-2 sm:px-3 py-2">
                    <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-500 mr-2" />
                    <input 
                      type="number"
                      min="0"
                      max="120"
                      value={selectedShot ? selectedShot.minute : currentMinute}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        if (selectedShot) {
                          updateShot(selectedShot.id, { minute: val });
                        }
                      }}
                      readOnly={!selectedShot}
                      className={cn(
                        "w-full bg-transparent text-xs sm:text-sm font-bold focus:outline-none",
                        !selectedShot && "text-gray-500"
                      )}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase mb-2 sm:mb-3 block">Distanza</label>
                  <div className="flex items-center bg-black/5 border border-white/5 rounded-xl px-2 sm:px-3 py-2 text-gray-400">
                    <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-2" />
                    <span className="text-xs sm:text-sm font-bold">
                      {selectedShot 
                        ? Math.sqrt(selectedShot.x**2 + (selectedShot.y-34)**2).toFixed(1) 
                        : '---'}m
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase mb-2 sm:mb-3 block">Tipo Assist</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['none', 'pass', 'cross', 'rebound'] as AssistType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        if (selectedShot) {
                          updateShot(selectedShot.id, { assistType: type });
                        } else {
                          setNewShotConfig(prev => ({ ...prev, assistType: type }));
                        }
                      }}
                      className={cn(
                        "py-2 sm:py-2.5 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all border",
                        (selectedShot ? selectedShot.assistType : newShotConfig.assistType) === type 
                          ? "bg-blue-600 border-blue-400 text-white" 
                          : "bg-black/40 border-white/10 text-gray-400 hover:border-white/30"
                      )}
                    >
                      {type === 'none' ? 'Nessuno' : type === 'pass' ? 'Passaggio' : type === 'cross' ? 'Cross' : 'Rimpallo'}
                    </button>
                  ))}
                </div>
              </div>
              
              {selectedShot && (
                <div className="pt-2 flex flex-col gap-2">
                  <button 
                    onClick={() => removeShot(selectedShot.id)}
                    className="w-full py-2.5 sm:py-3 rounded-xl text-[10px] sm:text-xs font-bold bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Elimina Tiro
                  </button>
                  <button 
                    onClick={() => setSelectedShot(null)}
                    className="w-full py-2.5 sm:py-3 rounded-xl text-[10px] sm:text-xs font-bold bg-white/5 text-gray-400 hover:text-white border border-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Nuovo Tiro
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Selected Shot Info Summary (Simplified since we have edit controls) */}
          {/* Selected Shot Info Summary */}
          <AnimatePresence mode="wait">
            {selectedShot && (
              <motion.div 
                key="selected-stats"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-emerald-500 text-black rounded-2xl p-4 sm:p-6 shadow-xl shadow-emerald-500/20 relative overflow-hidden"
              >
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-lg flex items-center justify-center">
                      <Zap className="text-emerald-500 w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div>
                      <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest opacity-60">Probabilità xG</p>
                      <p className="text-xl sm:text-2xl font-black">{(selectedShot.xg * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeShot(selectedShot.id)}
                    className="w-8 h-8 sm:w-10 sm:h-10 bg-black/10 hover:bg-black/20 rounded-lg flex items-center justify-center transition-all"
                  >
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-6">
            {/* Shot List Summary */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-3 sm:p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-400">Ultimi Tiri</h3>
                <span className="bg-emerald-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full">{shots.length}</span>
              </div>
              <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                {shots.length === 0 ? (
                  <div className="p-6 text-center text-gray-600 text-[10px] italic">Nessun tiro registrato</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {shots.slice().reverse().map((shot) => (
                      <button 
                        key={shot.id}
                        onClick={() => setSelectedShot(shot)}
                        className={cn(
                          "w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors text-left",
                          selectedShot?.id === shot.id && "bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center",
                            shot.isGoal ? "bg-yellow-500 text-black" : "bg-emerald-500/20 text-emerald-500"
                          )}>
                            {shot.isGoal ? <div className="w-1.5 h-1.5 rounded-full bg-black" /> : <Target className="w-3.5 h-3.5" />}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-[10px] font-bold text-white truncate max-w-[100px]">{shot.playerName}</p>
                            <p className="text-[8px] text-gray-500">{shot.minute}' • {shot.bodyPart}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] font-black text-emerald-500">{shot.xg.toFixed(2)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Match Log Summary */}
            <div className="h-[300px]">
              <MatchLog events={matchEvents} homeTeam={homeTeam} awayTeam={awayTeam} />
            </div>
          </div>
        </div>
      </div>
    ) : (
          <DangerzoneView 
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            dangerEventsHome={dangerEventsHome}
            setDangerEventsHome={setDangerEventsHome}
            dangerEventsAway={dangerEventsAway}
            setDangerEventsAway={setDangerEventsAway}
            goalsHome={goalsHome}
            setGoalsHome={setGoalsHome}
            goalsAway={goalsAway}
            setGoalsAway={setGoalsAway}
            ipoHome={ipoHome}
            ipoAway={ipoAway}
            possessionHomeSeconds={possessionHomeSeconds}
            possessionAwaySeconds={possessionAwaySeconds}
            weights={weights}
            addMatchEvent={addMatchEvent}
          />
        )}
      </main>

      {/* Match List Modal */}
      <AnimatePresence>
        {showMatchList && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMatchList(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[#121212] border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600/10 rounded-lg sm:rounded-xl flex items-center justify-center">
                    <List className="text-blue-500 w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-white">Le Mie Partite</h2>
                    <p className="text-[10px] sm:text-xs text-gray-500 font-medium">Seleziona una partita da caricare</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowMatchList(false)}
                  className="w-8 h-8 sm:w-10 sm:h-10 bg-white/5 hover:bg-white/10 rounded-lg sm:rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3 custom-scrollbar">
                {matches.length === 0 ? (
                  <div className="py-12 sm:py-20 text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileSpreadsheet className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600" />
                    </div>
                    <p className="text-gray-500 text-xs sm:text-sm font-medium">Nessuna partita salvata</p>
                  </div>
                ) : (
                  matches.map((match) => (
                    <div 
                      key={match.id}
                      className="group bg-white/5 border border-white/10 hover:border-blue-500/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between transition-all"
                    >
                      <div className="flex-1 cursor-pointer overflow-hidden" onClick={() => loadMatch(match)}>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-1">
                          <span className="text-xs sm:text-sm font-black text-white truncate">{match.homeTeam} vs {match.awayTeam}</span>
                          <span className="text-[8px] sm:text-[10px] font-bold bg-blue-600/10 text-blue-500 px-2 py-0.5 rounded-full w-fit">
                            {match.totalGoals} Gol • {match.totalXG.toFixed(2)} xG
                          </span>
                        </div>
                        <p className="text-[8px] sm:text-[10px] text-gray-500 font-medium uppercase tracking-widest">
                          {new Date(match.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 ml-2">
                        <button 
                          onClick={() => loadMatch(match)}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] sm:text-xs font-black rounded-lg transition-all"
                        >
                          Carica
                        </button>
                        <button 
                          onClick={() => setMatchToDelete(match.id)}
                          className="p-1.5 sm:p-2 bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-500 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {matchToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMatchToDelete(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-[#121212] border border-white/10 rounded-3xl p-8 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="text-red-500 w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Elimina Partita?</h2>
              <p className="text-gray-400 text-sm mb-8 font-medium">
                Questa azione è irreversibile. Tutti i dati della partita verranno persi per sempre.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => deleteMatch(matchToDelete)}
                  className="w-full py-4 bg-red-500 hover:bg-red-400 text-black font-black rounded-2xl transition-all shadow-lg shadow-red-500/20"
                >
                  Sì, Elimina Definitivamente
                </button>
                <button 
                  onClick={() => setMatchToDelete(null)}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10"
                >
                  Annulla
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className={cn(
              "fixed bottom-8 left-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md",
              showToast.type === 'success' ? "bg-blue-600/90 border-blue-400 text-white" : "bg-red-500/90 border-red-400 text-white"
            )}
          >
            {showToast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-bold text-sm">{showToast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}} />
    </div>
  );
}

function DangerzoneView({ 
  homeTeam, 
  awayTeam, 
  dangerEventsHome, 
  setDangerEventsHome, 
  dangerEventsAway, 
  setDangerEventsAway,
  goalsHome,
  setGoalsHome,
  goalsAway,
  setGoalsAway,
  ipoHome,
  ipoAway,
  possessionHomeSeconds,
  possessionAwaySeconds,
  weights,
  addMatchEvent
}: any) {
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('home');

  const efficiencyHome = ipoHome > 0 ? goalsHome / ipoHome : 0;
  const efficiencyAway = ipoAway > 0 ? goalsAway / ipoAway : 0;

  const renderEventRow = (team: 'home' | 'away', key: string, label: string, weight: number, icon: any) => {
    const events = team === 'home' ? dangerEventsHome : dangerEventsAway;
    const setEvents = team === 'home' ? setDangerEventsHome : setDangerEventsAway;
    const count = events[key as keyof typeof events];
    const teamColor = team === 'home' ? 'group-hover:text-yellow-500' : 'group-hover:text-blue-500';

    return (
      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 transition-colors",
            teamColor
          )}>
            {icon}
          </div>
          <div>
            <div className="text-xs font-black text-white uppercase tracking-tight">{label}</div>
            <div className="text-[10px] font-bold text-gray-500 uppercase">x{weight}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-black/40 rounded-lg p-1 border border-white/5">
            <button 
              onClick={() => {
                if (count > 0) {
                  setEvents((prev: any) => ({ ...prev, [key]: prev[key] - 1 }));
                  addMatchEvent({
                    type: 'danger_event',
                    team,
                    description: `Rimosso ${label} per ${team === 'home' ? homeTeam : awayTeam}`
                  });
                }
              }}
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="w-10 text-center font-black text-white text-lg">{count}</div>
            <button 
              onClick={() => {
                setEvents((prev: any) => ({ ...prev, [key]: prev[key] + 1 }));
                addMatchEvent({
                  type: 'danger_event',
                  team,
                  description: `Aggiunto ${label} per ${team === 'home' ? homeTeam : awayTeam}`
                });
              }}
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className={cn(
            "w-12 text-right font-black text-gray-400 transition-colors",
            teamColor
          )}>
            {(count * weight).toFixed(1)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column */}
      <div className="lg:col-span-5 space-y-6">
        {/* Home Team Card */}
        <button 
          onClick={() => setSelectedTeam('home')}
          className={cn(
            "w-full text-left relative overflow-hidden bg-[#121212] border-l-4 rounded-2xl p-6 shadow-2xl transition-all",
            selectedTeam === 'home' ? "border-yellow-500 ring-2 ring-yellow-500/20" : "border-transparent opacity-60 hover:opacity-100"
          )}
        >
          <div className="flex justify-between items-start mb-8">
            <div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Squadra Casa</span>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mt-1">{homeTeam}</h2>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">IPO</span>
              <div className="text-4xl font-black text-yellow-500 tracking-tighter">{ipoHome.toFixed(1)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <span className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Gol</span>
              <div className="flex items-center justify-between">
                <div 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (goalsHome > 0) {
                      setGoalsHome(goalsHome - 1);
                      addMatchEvent({ type: 'danger_event', team: 'home', description: `Annullato GOL per ${homeTeam}` });
                    }
                  }}
                  className="text-gray-500 hover:text-white cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </div>
                <span className="text-2xl font-black text-white">{goalsHome}</span>
                <div 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setGoalsHome(goalsHome + 1);
                    addMatchEvent({ type: 'goal', team: 'home', description: `GOL segnato da ${homeTeam}` });
                  }}
                  className="text-gray-500 hover:text-white cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </div>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <span className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Efficienza</span>
              <div className="text-2xl font-black text-white">{efficiencyHome.toFixed(2)}</div>
            </div>
          </div>
        </button>

        {/* Away Team Card */}
        <button 
          onClick={() => setSelectedTeam('away')}
          className={cn(
            "w-full text-left relative overflow-hidden bg-[#121212] border-l-4 rounded-2xl p-6 shadow-2xl transition-all",
            selectedTeam === 'away' ? "border-blue-500 ring-2 ring-blue-500/20" : "border-transparent opacity-60 hover:opacity-100"
          )}
        >
          <div className="flex justify-between items-start mb-8">
            <div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Squadra Ospite</span>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mt-1">{awayTeam}</h2>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">IPO</span>
              <div className="text-4xl font-black text-blue-500 tracking-tighter">{ipoAway.toFixed(1)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <span className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Gol</span>
              <div className="flex items-center justify-between">
                <div 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (goalsAway > 0) {
                      setGoalsAway(goalsAway - 1);
                      addMatchEvent({ type: 'danger_event', team: 'away', description: `Annullato GOL per ${awayTeam}` });
                    }
                  }}
                  className="text-gray-500 hover:text-white cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </div>
                <span className="text-2xl font-black text-white">{goalsAway}</span>
                <div 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setGoalsAway(goalsAway + 1);
                    addMatchEvent({ type: 'goal', team: 'away', description: `GOL segnato da ${awayTeam}` });
                  }}
                  className="text-gray-500 hover:text-white cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </div>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <span className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Efficienza</span>
              <div className="text-2xl font-black text-white">{efficiencyAway.toFixed(2)}</div>
            </div>
          </div>
        </button>

        {/* Comparison Card */}
        <div className="bg-[#121212] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-4 h-4 text-gray-500" />
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Confronto Pericolosità</span>
          </div>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-[10px] font-bold uppercase mb-2">
                <span className="text-white">{homeTeam}</span>
                <span className="text-yellow-500">{ipoHome.toFixed(1)}</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 transition-all duration-500" 
                  style={{ width: `${Math.min(100, (ipoHome / (ipoHome + ipoAway || 1)) * 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-bold uppercase mb-2">
                <span className="text-white">{awayTeam}</span>
                <span className="text-blue-500">{ipoAway.toFixed(1)}</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-500" 
                  style={{ width: `${Math.min(100, (ipoAway / (ipoHome + ipoAway || 1)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Gap</span>
            <div className="text-2xl font-black text-yellow-500">
              {Math.abs(ipoHome - ipoAway).toFixed(1)} <span className="text-[10px] text-gray-500">PTS</span>
            </div>
          </div>
        </div>

        {/* Possession Comparison Card */}
        <div className="bg-[#121212] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Possesso Palla</span>
          </div>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-[10px] font-bold uppercase mb-2">
                <span className="text-white">{homeTeam}</span>
                <span className="text-yellow-500">
                  {possessionHomeSeconds + possessionAwaySeconds > 0 ? Math.round((possessionHomeSeconds / (possessionHomeSeconds + possessionAwaySeconds)) * 100) : 50}%
                </span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 transition-all duration-500" 
                  style={{ width: `${possessionHomeSeconds + possessionAwaySeconds > 0 ? (possessionHomeSeconds / (possessionHomeSeconds + possessionAwaySeconds)) * 100 : 50}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-bold uppercase mb-2">
                <span className="text-white">{awayTeam}</span>
                <span className="text-blue-500">
                  {possessionHomeSeconds + possessionAwaySeconds > 0 ? Math.round((possessionAwaySeconds / (possessionHomeSeconds + possessionAwaySeconds)) * 100) : 50}%
                </span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-500" 
                  style={{ width: `${possessionHomeSeconds + possessionAwaySeconds > 0 ? (possessionAwaySeconds / (possessionHomeSeconds + possessionAwaySeconds)) * 100 : 50}%` }}
                />
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Tempo Effettivo</span>
            <div className="text-xl font-black text-white">
              {Math.floor((possessionHomeSeconds + possessionAwaySeconds) / 60)}' {String((possessionHomeSeconds + possessionAwaySeconds) % 60).padStart(2, '0')}"
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Events */}
      <div className="lg:col-span-7 bg-[#121212] border border-white/5 rounded-3xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
              selectedTeam === 'home' ? "bg-yellow-500/10 text-yellow-500" : "bg-blue-500/10 text-blue-500"
            )}>
              <Target className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight">
              Eventi <span className={selectedTeam === 'home' ? "text-yellow-500" : "text-blue-500"}>
                {selectedTeam === 'home' ? homeTeam : awayTeam}
              </span>
            </h3>
          </div>
          <button 
            onClick={() => {
              if (selectedTeam === 'home') {
                setDangerEventsHome({ shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
                addMatchEvent({ type: 'match_reset', team: 'home', description: `Reset eventi ${homeTeam}` });
              } else {
                setDangerEventsAway({ shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
                addMatchEvent({ type: 'match_reset', team: 'away', description: `Reset eventi ${awayTeam}` });
              }
            }}
            className="p-2 text-gray-500 hover:text-white transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-3 overflow-y-auto custom-scrollbar">
          {renderEventRow(selectedTeam, 'shotsIn', 'Tiro in area', weights.shotsIn, <Target className="w-5 h-5" />)}
          {renderEventRow(selectedTeam, 'shotsOut', 'Tiro fuori', weights.shotsOut, <Zap className="w-5 h-5" />)}
          {renderEventRow(selectedTeam, 'penalties', 'Rigore', weights.penalties, <CheckCircle2 className="w-5 h-5" />)}
          {renderEventRow(selectedTeam, 'freeKicks', 'Punizione', weights.freeKicks, <MousePointer2 className="w-4 h-4 rotate-45" />)}
          {renderEventRow(selectedTeam, 'corners', 'Corner', weights.corners, <Trophy className="w-5 h-5" />)}
          {renderEventRow(selectedTeam, 'crosses', 'Cross/Traversone', weights.crosses, <Activity className="w-5 h-5" />)}
        </div>

        <div className="p-6 bg-black/40 border-t border-white/5 flex justify-between items-center">
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Totale IPO Team</span>
          <div className={cn(
            "text-3xl font-black",
            selectedTeam === 'home' ? "text-yellow-500" : "text-blue-500"
          )}>
            {(selectedTeam === 'home' ? ipoHome : ipoAway).toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchLog({ events, homeTeam, awayTeam }: { events: MatchEvent[], homeTeam: string, awayTeam: string }) {
  return (
    <div className="bg-[#121212] border border-white/5 rounded-2xl overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-2">
          <List className="w-4 h-4 text-emerald-500" />
          <h3 className="text-xs font-black text-white uppercase tracking-widest">Cronologia Eventi</h3>
        </div>
        <span className="text-[10px] font-bold text-gray-500 uppercase">{events.length} Eventi</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 py-12">
            <Clock className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-[10px] font-bold uppercase tracking-widest">Nessun evento registrato</p>
          </div>
        ) : (
          events.map((event) => (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              key={event.id} 
              className="flex gap-3 group"
            >
              <div className="flex flex-col items-center gap-1">
                <div className="text-[10px] font-black text-emerald-500 w-8 text-right">{event.minute}'</div>
                <div className="w-px flex-1 bg-white/5 group-last:hidden" />
              </div>
              <div className="flex-1 pb-4">
                <div className={cn(
                  "p-3 rounded-xl border transition-all",
                  event.type === 'goal' ? "bg-emerald-500/10 border-emerald-500/20" : 
                  event.type === 'shot' ? "bg-blue-500/10 border-blue-500/20" :
                  "bg-white/5 border-white/5"
                )}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest",
                      event.team === 'home' ? "text-yellow-500" : event.team === 'away' ? "text-blue-500" : "text-gray-500"
                    )}>
                      {event.team === 'home' ? homeTeam : event.team === 'away' ? awayTeam : 'Match'}
                    </span>
                    <span className="text-[8px] font-bold text-gray-600">
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-white leading-tight">{event.description}</p>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
