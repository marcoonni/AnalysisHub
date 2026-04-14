import React, { useState, useRef, useMemo, useEffect, Component } from 'react';
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
  Undo2,
  Clock,
  FileSpreadsheet,
  Save,
  List,
  LogOut,
  LogIn,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Shield,
  Share2,
  Palette,
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

import { Shot, BodyPart, AssistType, DEFAULT_PITCH } from './types';
import { calculateXG, generateXGGrid, DEFAULT_XG_COEFFICIENTS, XGCoefficients } from './lib/xgModel';
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
  teamName: string;
  teamColor?: string;
  awayTeam?: string;
  awayColor?: string;
  date: string;
  createdAt: any;
  totalXG: number;
  totalGoals: number;
  ipoEvents?: any;
  ipoEventsAway?: any;
  goals?: number;
  goalsAway?: number;
  possessionSeconds?: number;
  possessionAwaySeconds?: number;
  matchEvents?: MatchEvent[];
}

interface MatchEvent {
  id: string;
  minute: number;
  type: 'shot' | 'goal' | 'ipo_event' | 'possession_change' | 'match_start' | 'match_pause' | 'match_reset';
  description: string;
  timestamp: number;
  value?: number;
}

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PREDEFINED_PLAYERS = [
  "ANASTASIO", "AURELI", "BRIGUGLIO", "BUIKUS", "DATTILO", "DE PACE", 
  "DELLA ROCCA", "IGBINIGUN", "ITALIANO", "KUJRAKOVIC", "LIBRA", 
  "LO MONACO", "MIOLI", "OSTI", "PANTALEONI", "ROMAGNOLI", "ROSSITTO", 
  "SOBOLEWSKI", "STRAFORINI", "TOMBA", "TUPEC", "UGOLOTTI", "ZUCCHINI", 
  "CAPECE", "ZONTA", "MAZZETTI"
];

// Custom hook to track previous value
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

// Animated Counter Component
function AnimatedCounter({ value, decimals = 1 }: { value: number, decimals?: number }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {value.toFixed(decimals)}
    </motion.span>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Error Boundary Component
const AppLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 512 512" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="logoGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#00ffff" stopOpacity="1" />
        <stop offset="70%" stopColor="#0066ff" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#0066ff" stopOpacity="0" />
      </radialGradient>
      <filter id="logoNeon">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    
    {/* Outer Rings */}
    <circle cx="256" cy="256" r="200" stroke="#00d4ff" strokeWidth="4" opacity="0.2"/>
    <circle cx="256" cy="256" r="150" stroke="#00d4ff" strokeWidth="6" opacity="0.4"/>
    <circle cx="256" cy="256" r="100" stroke="#00d4ff" strokeWidth="10" opacity="0.6"/>
    
    {/* Crosshair */}
    <path d="M256 20 V492 M20 256 H492" stroke="#00d4ff" strokeWidth="12" opacity="0.8" strokeLinecap="round" filter="url(#logoNeon)"/>
    
    {/* The "Hit" */}
    <g transform="translate(100, -100)">
      <circle cx="256" cy="256" r="80" fill="url(#logoGlow)" opacity="0.8" />
      <circle cx="256" cy="256" r="35" fill="#00ffff" filter="url(#logoNeon)" />
      <circle cx="256" cy="256" r="15" fill="white" filter="url(#logoNeon)" />
      <path d="M226 226 L240 240 M286 286 L272 272 M226 286 L240 272 M286 226 L272 240" stroke="white" strokeWidth="10" strokeLinecap="round" />
    </g>
    
    <circle cx="256" cy="256" r="15" fill="white" filter="url(#logoNeon)"/>
  </svg>
);

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Si è verificato un errore imprevisto.";
      try {
        const parsedError = JSON.parse(this.state.error?.message || "");
        if (parsedError.error) {
          errorMessage = `Errore Firestore (${parsedError.operationType}): ${parsedError.error}`;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
          <div className="bg-white/5 border border-white/10 p-8 rounded-3xl max-w-md w-full text-center backdrop-blur-xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-black text-white mb-4">Ops! Qualcosa è andato storto</h2>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed">
              {errorMessage}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/20"
            >
              Ricarica Applicazione
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export default function App() {
  const isOnline = useOnlineStatus();
  const [shots, setShots] = useState<Shot[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showGridValues, setShowGridValues] = useState(false);
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [playerList, setPlayerList] = useState<string[]>([]);
  const [isAddingNewPlayer, setIsAddingNewPlayer] = useState(false);

  // Update player list whenever shots change
  useEffect(() => {
    const players = Array.from(new Set(shots.map(s => s.playerName))).filter(Boolean).sort();
    setPlayerList(players);
  }, [shots]);
  
  // Auth & Database States
  const [user, setUser] = useState<User | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [showMatchList, setShowMatchList] = useState(false);
  const [showMatchSettings, setShowMatchSettings] = useState(false);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('Bologna U18');
  const [teamColor, setTeamColor] = useState('#eab308'); // Yellow-500
  const [awayTeam, setAwayTeam] = useState('Avversario');
  const [awayColor, setAwayColor] = useState('#3b82f6'); // Blue-500
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loadingMatchId, setLoadingMatchId] = useState<string | null>(null);

  // UI States
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null);
  const [showToast, setShowToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'xg' | 'ipo'>('xg');
  const [isPWAReady, setIsPWAReady] = useState(false);
  const [ipoActiveTeam, setIpoActiveTeam] = useState<'home' | 'away'>('home');
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [xgCoeffs, setXgCoeffs] = useState<XGCoefficients>(DEFAULT_XG_COEFFICIENTS);
  const [showXGTuning, setShowXGTuning] = useState(false);

  // Check for Service Worker readiness
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        setIsPWAReady(true);
      });
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedMatchId = params.get('matchId');
    if (sharedMatchId) {
      loadSharedMatch(sharedMatchId);
    }
  }, []);

  const loadSharedMatch = async (matchId: string) => {
    setLoadingMatchId(matchId);
    setIsReadOnly(true);
    try {
      const matchDoc = await getDoc(doc(db, 'matches', matchId));
      if (!matchDoc.exists()) {
        setShowToast({ message: "Partita non trovata.", type: 'error' });
        setIsReadOnly(false);
        return;
      }
      const matchData = { ...matchDoc.data(), id: matchDoc.id } as Match;
      
      setCurrentMatchId(matchData.id);
      setTeamName(matchData.teamName || 'Bologna U18');
      setTeamColor(matchData.teamColor || '#eab308');
      setAwayTeam(matchData.awayTeam || 'Avversario');
      setAwayColor(matchData.awayColor || '#3b82f6');
      setIpoEvents(matchData.ipoEvents || { shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
      setIpoEventsAway(matchData.ipoEventsAway || { shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
      setGoals(matchData.goals || 0);
      setGoalsAway(matchData.goalsAway || 0);
      setPossessionSeconds(matchData.possessionSeconds || 0);
      setPossessionAwaySeconds(matchData.possessionAwaySeconds || 0);
      
      const shotsSnapshot = await getDocs(collection(db, 'matches', matchData.id, 'shots'));
      const shotsData = shotsSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }) as Shot);
      
      setShots(shotsData);
      setSelectedShot(null);
      setShowToast({ message: "Partita condivisa caricata!", type: 'success' });
    } catch (error) {
      console.error("Load Shared Match Error:", error);
      setShowToast({ message: "Errore durante il caricamento della partita condivisa.", type: 'error' });
      setIsReadOnly(false);
    } finally {
      setLoadingMatchId(null);
    }
  };

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        setIsPWAReady(true);
      });
    }
  }, []);

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState(0);
  const lastTickRef = useRef<number>(Date.now());
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [possessionState, setPossessionState] = useState<'none' | 'home' | 'away'>('none');
  const [possessionSeconds, setPossessionSeconds] = useState(0);
  const [possessionAwaySeconds, setPossessionAwaySeconds] = useState(0);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [ripples, setRipples] = useState<{ id: string, x: number, y: number }[]>([]);
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.4);
  const [heatmapSaturation, setHeatmapSaturation] = useState(100);
  const [heatmapScale, setHeatmapScale] = useState<'default' | 'viridis' | 'plasma' | 'hot'>('default');
  const [hoveredCell, setHoveredCell] = useState<{ r: number, c: number, xg: number } | null>(null);

  const addMatchEvent = (event: Omit<MatchEvent, 'id' | 'timestamp' | 'minute'>) => {
    const newEvent: MatchEvent = {
      id: Math.random().toString(36).substr(2, 9),
      minute: Math.floor(timerSeconds / 60),
      timestamp: Date.now(),
      ...event
    };
    setMatchEvents(prev => [newEvent, ...prev]);
  };

  // IPO State
  const [ipoEvents, setIpoEvents] = useState({
    shotsIn: 0,
    shotsOut: 0,
    penalties: 0,
    freeKicks: 0,
    corners: 0,
    crosses: 0
  });

  const [ipoEventsAway, setIpoEventsAway] = useState({
    shotsIn: 0,
    shotsOut: 0,
    penalties: 0,
    freeKicks: 0,
    corners: 0,
    crosses: 0
  });

  const [goals, setGoals] = useState(0);
  const [goalsAway, setGoalsAway] = useState(0);
  const prevGoals = usePrevious(goals);
  const prevGoalsAway = usePrevious(goalsAway);

  // Dynamic Theme Logic
  const matchDominance = Math.max(-1, Math.min(1, (goals * 0.4) + ((possessionSeconds / 60) * 0.05)));
  
  const weights = {
    shotsIn: 1.3,
    shotsOut: 0.7,
    penalties: 15,
    freeKicks: 1.2,
    corners: 0.5,
    crosses: 0.2
  };

  const calculateIPO = (events: any) => {
    return Object.entries(events).reduce((sum: number, [key, count]) => {
      return sum + (Number(count) * weights[key as keyof typeof weights]);
    }, 0);
  };

  const ipo = useMemo(() => calculateIPO(ipoEvents), [ipoEvents]);
  const ipoAway = useMemo(() => calculateIPO(ipoEventsAway), [ipoEventsAway]);
  const prevIpo = usePrevious(ipo);
  const prevIpoAway = usePrevious(ipoAway);

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
  const xgGrid = useMemo(() => generateXGGrid(17, 34, xgCoeffs), [xgCoeffs]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      lastTickRef.current = Date.now();
      interval = setInterval(() => {
        const now = Date.now();
        const deltaMs = now - lastTickRef.current;
        const deltaSec = Math.floor(deltaMs / 1000);
        
        if (deltaSec >= 1) {
          setTimerSeconds(prev => prev + deltaSec);
          
          // Track possession
          if (possessionState === 'home') {
            setPossessionSeconds(prev => prev + deltaSec);
          } else if (possessionState === 'away') {
            setPossessionAwaySeconds(prev => prev + deltaSec);
          }
          
          lastTickRef.current = now - (deltaMs % 1000);
        }
      }, 500); // Check more frequently to be responsive
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, possessionState]);

  // Record possession changes
  const prevPossessionState = useRef(possessionState);
  useEffect(() => {
    if (prevPossessionState.current !== possessionState) {
      if (possessionState !== 'none') {
        const activeTeam = possessionState === 'home' ? teamName : awayTeam;
        addMatchEvent({
          type: 'possession_change',
          description: `Inizio possesso ${activeTeam}`
        });
      }
      prevPossessionState.current = possessionState;
    }
  }, [possessionState, teamName, awayTeam]);

  // Record timer start/stop
  const prevIsTimerRunning = useRef(isTimerRunning);
  useEffect(() => {
    if (prevIsTimerRunning.current !== isTimerRunning) {
      addMatchEvent({
        type: isTimerRunning ? 'match_start' : 'match_pause',
        description: isTimerRunning ? 'Timer Avviato' : 'Timer Pausato'
      });
      prevIsTimerRunning.current = isTimerRunning;
    }
  }, [isTimerRunning]);

  const currentMinute = Math.floor(timerSeconds / 60);

  // Stats
  const displayShots = useMemo(() => shots, [shots]);
  const displayXG = useMemo(() => displayShots.reduce((sum, s) => sum + s.xg, 0), [displayShots]);
  const displayGoals = useMemo(() => displayShots.filter(s => s.isGoal).length, [displayShots]);
  const displayXGPerShot = useMemo(() => displayShots.length > 0 ? displayXG / displayShots.length : 0, [displayShots, displayXG]);

  const totalXG = displayXG;
  const totalGoals = displayGoals;

  // Chart Data
  const chartData = useMemo(() => [
    { name: 'Expected Goals (xG)', value: displayXG, color: '#10b981' },
    { name: 'Gol Reali', value: displayGoals, color: '#eab308' },
  ], [displayXG, displayGoals]);

  const filteredMatchEvents = useMemo(() => matchEvents, [matchEvents]);

  const handlePitchClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isReadOnly) return;
    if (!pitchRef.current) return;

    const rect = pitchRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const mY = (clickX / rect.width) * DEFAULT_PITCH.width;
    const mX = (clickY / rect.height) * DEFAULT_PITCH.height;

    const xg = calculateXG(mX, mY, newShotConfig.bodyPart, newShotConfig.assistType, xgCoeffs);

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

    // Add ripple effect
    const rippleId = Math.random().toString(36).substr(2, 9);
    setRipples(prev => [...prev, { id: rippleId, x: (clickX / rect.width) * 100, y: (clickY / rect.height) * 100 }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== rippleId));
    }, 1000);

    // Record match event
    addMatchEvent({
      type: newShot.isGoal ? 'goal' : 'shot',
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
          updatedShot.xg = calculateXG(updatedShot.x, updatedShot.y, updatedShot.bodyPart, updatedShot.assistType, xgCoeffs);
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

  const exportToExcel = () => {
    try {
      if (shots.length === 0 && matchEvents.length === 0) {
        setShowToast({ message: "Nessun dato da esportare.", type: 'error' });
        return;
      }

      // 1. Shots Data
      const shotsData = shots.map(s => ({
        Giocatore: s.playerName,
        Minuto: s.minute,
        xG: s.xg.toFixed(3),
        Risultato: s.isGoal ? 'Gol' : 'No Gol',
        ParteCorpo: s.bodyPart,
        TipoAssist: s.assistType,
        CoordinataX: s.x.toFixed(2),
        CoordinataY: s.y.toFixed(2)
      }));

      // 2. IPO Stats
      const ipoStats = [
        { Team: teamName, ...ipoEvents, Goals: goals, Possession: `${Math.floor(possessionSeconds / 60)}:${(possessionSeconds % 60).toString().padStart(2, '0')}` }
      ];

      // 3. Match Events Log
      const eventsLog = matchEvents.map(e => ({
        Minuto: e.minute,
        Squadra: teamName,
        Evento: e.type,
        Descrizione: e.description
      }));

      const workbook = XLSX.utils.book_new();
      
      const shotsSheet = XLSX.utils.json_to_sheet(shotsData);
      XLSX.utils.book_append_sheet(workbook, shotsSheet, "Analisi Tiri");

      const statsSheet = XLSX.utils.json_to_sheet(ipoStats);
      XLSX.utils.book_append_sheet(workbook, statsSheet, "Statistiche IPO");

      const logSheet = XLSX.utils.json_to_sheet(eventsLog);
      XLSX.utils.book_append_sheet(workbook, logSheet, "Log Partita");

      XLSX.writeFile(workbook, `MatchReport_${teamName}_${new Date().toISOString().split('T')[0]}.xlsx`);
      setShowToast({ message: 'File Excel generato con successo!', type: 'success' });
    } catch (error) {
      console.error("Excel Export Error:", error);
      setShowToast({ message: "Errore durante la generazione del file Excel.", type: 'error' });
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
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    console.log("Attempting login...");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log("Login successful:", result.user.email);
      setShowToast({ message: `Benvenuto, ${result.user.displayName}!`, type: 'success' });
    } catch (error: any) {
      console.error("Errore login:", error);
      let errorMessage = "Errore durante l'accesso.";
      if (error.code === 'auth/popup-blocked') {
        errorMessage = "Il popup di accesso è stato bloccato dal browser. Per favore, abilita i popup per questo sito.";
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = "Accesso annullato.";
      } else if (error.message) {
        errorMessage = `Errore: ${error.message}`;
      }
      setShowToast({ message: errorMessage, type: 'error' });
    } finally {
      setIsLoggingIn(false);
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
        teamName,
        teamColor,
        awayTeam,
        awayColor,
        date: new Date().toISOString(),
        createdAt: serverTimestamp(),
        totalXG: totalXG,
        totalGoals: goals,
        ipoEvents,
        ipoEventsAway,
        goals,
        goalsAway,
        possessionSeconds,
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

      // Save shots - Delete existing shots first to avoid duplicates/stale data
      if (matchId) {
        try {
          const shotsSnapshot = await getDocs(collection(db, 'matches', matchId, 'shots'));
          const deletePromises = shotsSnapshot.docs.map(shotDoc => 
            deleteDoc(doc(db, 'matches', matchId, 'shots', shotDoc.id))
          );
          await Promise.all(deletePromises);
        } catch (err) {
          console.warn("Could not clear existing shots, continuing anyway:", err);
        }
      }

      // Add current shots in batches or chunks if needed, but here we just use Promise.all
      if (shots.length > 0) {
        const shotPromises = shots.map(shot => 
          addDoc(collection(db, 'matches', matchId!, 'shots'), {
            ...shot,
            matchId,
            timestamp: new Date().toISOString()
          })
        );
        await Promise.all(shotPromises);
      }

      setShowToast({ 
        message: isOnline ? "Partita salvata con successo!" : "Salvato localmente (sincronizzazione appena torni online)", 
        type: 'success' 
      });
    } catch (error) {
      console.error("Save Match Error:", error);
      handleFirestoreError(error, OperationType.WRITE, 'matches');
      setShowToast({ message: "Errore durante il salvataggio della partita.", type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const loadMatch = async (match: Match) => {
    setLoadingMatchId(match.id);
    setIsReadOnly(false);
    try {
      setCurrentMatchId(match.id);
      setTeamName(match.teamName || 'Bologna U18');
      setTeamColor(match.teamColor || '#eab308');
      setAwayTeam(match.awayTeam || 'Avversario');
      setAwayColor(match.awayColor || '#3b82f6');
      setIpoEvents(match.ipoEvents || { shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
      setIpoEventsAway(match.ipoEventsAway || { shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
      setGoals(match.goals || 0);
      setGoalsAway(match.goalsAway || 0);
      setPossessionSeconds(match.possessionSeconds || 0);
      setPossessionAwaySeconds(match.possessionAwaySeconds || 0);
      
      const shotsSnapshot = await getDocs(collection(db, 'matches', match.id, 'shots'));
      const shotsData = shotsSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }) as Shot);
      
      setShots(shotsData);
      setShowMatchList(false);
      setSelectedShot(null);
      setShowToast({ message: "Partita caricata con successo!", type: 'success' });
    } catch (error) {
      console.error("Load Match Error:", error);
      handleFirestoreError(error, OperationType.GET, `matches/${match.id}/shots`);
      setShowToast({ message: "Errore durante il caricamento della partita.", type: 'error' });
    } finally {
      setLoadingMatchId(null);
    }
  };

  const undoLastShot = () => {
    if (shots.length === 0) return;
    
    const lastShot = shots[shots.length - 1];
    setShots(prev => prev.slice(0, -1));
    setSelectedShot(null);
    
    // Remove the corresponding match event
    setMatchEvents(prev => {
      // Find the most recent event that matches this shot
      const index = prev.findIndex(e => 
        (e.type === 'shot' || e.type === 'goal') && 
        e.description.includes(lastShot.playerName) &&
        Math.abs(e.timestamp - lastShot.timestamp) < 5000 // Within 5 seconds
      );
      
      if (index !== -1) {
        const newEvents = [...prev];
        newEvents.splice(index, 1);
        return newEvents;
      }
      return prev;
    });
    
    setShowToast({ message: 'Ultimo tiro annullato', type: 'success' });
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
    setIpoEvents({ shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
    setIpoEventsAway({ shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
    setGoals(0);
    setGoalsAway(0);
    setPossessionSeconds(0);
    setPossessionAwaySeconds(0);
    setPossessionState('none');
    setMatchEvents([]);
    setIsReadOnly(false);
    // Clear URL params if any
    if (window.location.search.includes('matchId')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const getXGColor = (val: number) => {
    if (heatmapScale === 'default') {
      let h = 0;
      if (val < 0.1) h = 158; // Green
      else if (val < 0.3) h = 45; // Yellow
      else if (val < 0.6) h = 25; // Orange
      else h = 0; // Red
      return `hsla(${h}, ${heatmapSaturation}%, 50%, ${heatmapOpacity})`;
    }

    if (heatmapScale === 'viridis') {
      // Viridis: Purple (0) -> Blue (0.3) -> Green (0.7) -> Yellow (1)
      if (val < 0.25) return `rgba(68, 1, 84, ${heatmapOpacity})`;
      if (val < 0.5) return `rgba(59, 81, 139, ${heatmapOpacity})`;
      if (val < 0.75) return `rgba(33, 144, 141, ${heatmapOpacity})`;
      return `rgba(253, 231, 37, ${heatmapOpacity})`;
    }

    if (heatmapScale === 'plasma') {
      // Plasma: Purple (0) -> Pink (0.4) -> Orange (0.7) -> Yellow (1)
      if (val < 0.25) return `rgba(13, 8, 135, ${heatmapOpacity})`;
      if (val < 0.5) return `rgba(156, 23, 158, ${heatmapOpacity})`;
      if (val < 0.75) return `rgba(237, 121, 83, ${heatmapOpacity})`;
      return `rgba(240, 249, 33, ${heatmapOpacity})`;
    }

    if (heatmapScale === 'hot') {
      // Hot: Black/Dark Red (0) -> Red (0.3) -> Orange (0.6) -> Yellow (0.9) -> White (1)
      if (val < 0.2) return `rgba(128, 0, 0, ${heatmapOpacity})`;
      if (val < 0.4) return `rgba(255, 0, 0, ${heatmapOpacity})`;
      if (val < 0.7) return `rgba(255, 165, 0, ${heatmapOpacity})`;
      return `rgba(255, 255, 0, ${heatmapOpacity})`;
    }

    return `hsla(0, 0%, 0%, ${heatmapOpacity})`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="bg-black/40 border-b border-white/10 backdrop-blur-md sticky top-0 z-50">
        {isReadOnly && (
          <div className="bg-blue-600/20 border-b border-blue-500/30 py-2 px-4 flex items-center justify-center gap-2">
            <Info className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Modalità Visualizzazione (Sola Lettura)</span>
            <button 
              onClick={clearAll}
              className="ml-4 text-[10px] font-black text-white bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-full transition-all"
            >
              Esci
            </button>
          </div>
        )}
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-auto min-h-[80px] py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl group hover:border-blue-500/50 transition-all duration-500">
                <AppLogo className="w-7 h-7 text-blue-500 group-hover:scale-110 transition-transform duration-500" />
              </div>
              <div>
                <h1 className="font-black text-xl sm:text-2xl tracking-tighter text-white leading-none uppercase">Analysis <span className="text-blue-500">Hub</span></h1>
                {!isOnline && (
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[8px] font-bold text-red-500 uppercase tracking-widest">Offline Mode</span>
                  </div>
                )}
                {isOnline && isPWAReady && (
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest">Ready Offline</span>
                  </div>
                )}
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
                  disabled={isLoggingIn}
                  className="p-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
                >
                  {isLoggingIn ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-nowrap items-center justify-end gap-2 sm:gap-3 w-full md:w-auto overflow-x-auto no-scrollbar">
            {/* Possession UI */}
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-2 sm:px-3 py-1.5 shrink-0">
                  <div className="flex flex-col gap-1">
                    <div className="h-1.5 w-24 sm:w-32 bg-white/10 rounded-full overflow-hidden flex">
                      <motion.div 
                        className="h-full"
                        initial={{ width: '50%' }}
                        animate={{ width: `${(possessionSeconds + possessionAwaySeconds) > 0 ? (possessionSeconds / (possessionSeconds + possessionAwaySeconds)) * 100 : 50}%` }}
                        style={{ backgroundColor: teamColor }}
                      />
                      <motion.div 
                        className="h-full"
                        initial={{ width: '50%' }}
                        animate={{ width: `${(possessionSeconds + possessionAwaySeconds) > 0 ? (possessionAwaySeconds / (possessionSeconds + possessionAwaySeconds)) * 100 : 50}%` }}
                        style={{ backgroundColor: awayColor }}
                      />
                    </div>
                    <div className="flex justify-between items-center w-24 sm:w-32">
                      <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest">
                        {Math.round((possessionSeconds / (possessionSeconds + possessionAwaySeconds || 1)) * 100)}%
                      </span>
                      <span className="text-[9px] font-black text-white uppercase tracking-widest mx-1">Possesso</span>
                      <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest">
                        {Math.round((possessionAwaySeconds / (possessionSeconds + possessionAwaySeconds || 1)) * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => setPossessionState('home')}
                      disabled={isReadOnly}
                      className={cn(
                        "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all border text-[10px] font-black disabled:opacity-50 disabled:cursor-not-allowed",
                        possessionState === 'home' ? "text-white shadow-lg" : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                      )}
                      style={possessionState === 'home' ? { backgroundColor: teamColor, borderColor: teamColor } : {}}
                    >
                      {teamName.substring(0, 1)}
                    </button>
                    <button 
                      onClick={() => setPossessionState('none')}
                      disabled={isReadOnly}
                      className={cn(
                        "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all border disabled:opacity-50 disabled:cursor-not-allowed",
                        possessionState === 'none' ? "bg-white/20 border-white/30 text-white" : "bg-white/5 border-white/10 text-gray-500 hover:text-white"
                      )}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-current" />
                    </button>
                    <button 
                      onClick={() => setPossessionState('away')}
                      disabled={isReadOnly}
                      className={cn(
                        "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all border text-[10px] font-black disabled:opacity-50 disabled:cursor-not-allowed",
                        possessionState === 'away' ? "text-white shadow-lg" : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                      )}
                      style={possessionState === 'away' ? { backgroundColor: awayColor, borderColor: awayColor } : {}}
                    >
                      {awayTeam.substring(0, 1)}
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
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  disabled={isReadOnly}
                  className={cn(
                    "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                    isTimerRunning ? "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20" : "bg-blue-600/10 text-blue-500 hover:bg-blue-600/20"
                  )}
                >
                  {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setTimerSeconds(0);
                    setIsTimerRunning(false);
                    setPossessionSeconds(0);
                    setPossessionAwaySeconds(0);
                    setPossessionState('none');
                  }}
                  disabled={isReadOnly}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </div>

            <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10 shrink-0">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTab('xg')}
                className={cn(
                  "px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1.5",
                  activeTab === 'xg' ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white"
                )}
              >
                <Target className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Match</span>
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTab('ipo')}
                className={cn(
                  "px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1.5",
                  activeTab === 'ipo' ? "bg-yellow-500 text-black shadow-lg" : "text-gray-400 hover:text-white"
                )}
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">IPO</span>
              </motion.button>
            </div>

            <div className="hidden sm:block h-8 w-px bg-white/10" />

            {activeTab === 'xg' && (
              <div className="flex items-center gap-3">
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

                <div className="hidden xl:flex items-center gap-2 mr-2">
                </div>


                {showHeatmap && (
                  <div className="hidden lg:flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[8px] font-black text-gray-500 uppercase">Opacità</span>
                        <span className="text-[8px] font-bold text-blue-500">{Math.round(heatmapOpacity * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.1" 
                        value={heatmapOpacity}
                        onChange={(e) => setHeatmapOpacity(parseFloat(e.target.value))}
                        className="w-20 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                    <div className="w-px h-6 bg-white/10" />
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[8px] font-black text-gray-500 uppercase">Scala Colore</span>
                        <span className="text-[8px] font-bold text-blue-500 uppercase">{heatmapScale}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {(['default', 'viridis', 'plasma', 'hot'] as const).map((scale) => (
                          <button
                            key={scale}
                            onClick={() => setHeatmapScale(scale)}
                            className={cn(
                              "w-4 h-4 rounded-full border border-white/10 transition-all",
                              heatmapScale === scale ? "ring-2 ring-blue-500 scale-110" : "opacity-50 hover:opacity-100",
                              scale === 'default' && "bg-gradient-to-r from-green-500 via-yellow-500 to-red-500",
                              scale === 'viridis' && "bg-gradient-to-r from-[#440154] via-[#21908d] to-[#fde725]",
                              scale === 'plasma' && "bg-gradient-to-r from-[#0d0887] via-[#9c179e] to-[#f0f921]",
                              scale === 'hot' && "bg-gradient-to-r from-[#800000] via-[#ff0000] to-[#ffff00]"
                            )}
                            title={scale.charAt(0).toUpperCase() + scale.slice(1)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

              <div className="hidden md:flex items-center gap-2">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={exportToExcel}
                  disabled={isSaving}
                  className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50"
                  title="Esporta Excel"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="hidden xl:inline text-xs font-bold">Report Excel</span>
                </motion.button>

              <div className="h-8 w-px bg-white/10 mx-1" />

              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowXGTuning(true)}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/10 flex items-center gap-2"
                title="Personalizza xG"
              >
                <Activity className="w-4 h-4" />
                <span className="hidden xl:inline text-xs font-bold">Modello xG</span>
              </motion.button>

              {currentMatchId && !isReadOnly && (
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    const url = `${window.location.origin}${window.location.pathname}?matchId=${currentMatchId}`;
                    navigator.clipboard.writeText(url);
                    setShowToast({ message: "Link di invito copiato! Invialo ai tuoi amici per collaborare (sola lettura).", type: 'success' });
                  }}
                  className="p-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 flex items-center gap-2 transition-all"
                  title="Invita Collaboratori"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden xl:inline text-xs font-bold">Invita</span>
                </motion.button>
              )}

              {user ? (
                <>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowMatchSettings(true)}
                    disabled={isReadOnly}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/10 flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Impostazioni Partita"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="hidden xl:inline text-xs font-bold">Impostazioni</span>
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowMatchList(true)}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/10 flex items-center gap-2"
                    title="Le mie partite"
                  >
                    <List className="w-4 h-4" />
                    <span className="hidden xl:inline text-xs font-bold">Partite</span>
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={saveMatch}
                    disabled={isSaving || isReadOnly}
                    className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Salva Partita"
                  >
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span className="hidden xl:inline text-xs font-bold">Salva</span>
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={logout}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-500 transition-all border border-white/10"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </motion.button>
                </>
              ) : (
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={login}
                  disabled={isLoggingIn}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  {isLoggingIn ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  {isLoggingIn ? 'Accesso...' : 'Accedi'}
                </motion.button>
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
                <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest">xG</span>
                <Activity className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-white">
                  <AnimatedCounter value={displayXG} decimals={2} />
                </span>
                <span className="text-[10px] sm:text-xs text-emerald-500 font-bold">+{((displayXG / (displayGoals || 1)) * 10).toFixed(1)}%</span>
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
                <span className="text-2xl sm:text-3xl font-black text-white">
                  <AnimatedCounter value={displayGoals} decimals={0} />
                </span>
                <span className="text-[10px] sm:text-xs text-gray-400 font-medium">vs {displayXG.toFixed(1)} xG</span>
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
                <span className="text-2xl sm:text-3xl font-black text-white">
                  <AnimatedCounter value={displayXGPerShot} decimals={2} />
                </span>
                <span className="text-[10px] sm:text-xs text-emerald-500 font-bold">{displayShots.length} tiri</span>
              </div>
            </motion.div>
          </div>

          {/* Pitch Container */}
          <motion.div 
            animate={{ 
              borderColor: possessionState !== 'none' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.1)',
              boxShadow: possessionState !== 'none' ? '0 0 30px rgba(59, 130, 246, 0.15)' : '0 0 0px rgba(0,0,0,0)'
            }}
            className="relative bg-black/40 border rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl transition-all duration-700"
          >
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 flex gap-2">
              <div className="bg-black/60 backdrop-blur-md border border-white/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full flex items-center gap-1.5 sm:gap-2 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-600 animate-pulse" />
                Live Analysis
              </div>
            </div>

            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex gap-2">
              <button 
                onClick={undoLastShot}
                disabled={shots.length === 0 || isReadOnly}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[8px] sm:text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 sm:gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Annulla ultimo tiro"
              >
                <Undo2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                Undo
              </button>

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
                    disabled={isReadOnly}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[8px] sm:text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 sm:gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
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

              {/* Ripples */}
              <AnimatePresence>
                {ripples.map(ripple => (
                  <motion.div
                    key={ripple.id}
                    initial={{ scale: 0, opacity: 0.8 }}
                    animate={{ scale: 4, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-blue-500 pointer-events-none z-30"
                    style={{ left: `${ripple.x}%`, top: `${ripple.y}%` }}
                  />
                ))}
              </AnimatePresence>

              {/* Heatmap Overlay */}
              <AnimatePresence>
                {showHeatmap && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 grid grid-cols-[repeat(34,1fr)] grid-rows-[repeat(17,1fr)]"
                  >
                    {xgGrid.map((row, r) => 
                      row.map((val, c) => (
                        <div 
                          key={`${r}-${c}`}
                          onMouseEnter={() => setHoveredCell({ r, c, xg: val })}
                          onMouseLeave={() => setHoveredCell(null)}
                          className="flex items-center justify-center border-[0.5px] border-white/5 transition-colors duration-500 relative group/cell"
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

              {/* Hover Tooltip */}
              <AnimatePresence>
                {hoveredCell && showHeatmap && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute pointer-events-none z-50 bg-black/90 backdrop-blur-md border border-white/20 p-2 rounded-lg shadow-2xl flex flex-col gap-1 min-w-[80px]"
                    style={{
                      left: `${(hoveredCell.c / 34) * 100}%`,
                      top: `${(hoveredCell.r / 17) * 100}%`,
                      transform: 'translate(-50%, -120%)'
                    }}
                  >
                    <div className="flex justify-between items-center gap-4">
                      <span className="text-[8px] font-black text-gray-500 uppercase">xG Value</span>
                      <span className="text-[10px] font-black text-emerald-500">{hoveredCell.xg.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4">
                      <span className="text-[8px] font-black text-gray-500 uppercase">Posizione</span>
                      <span className="text-[8px] font-bold text-white">{hoveredCell.r}, {hoveredCell.c}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Shots */}
              {shots.map((shot) => (
                <motion.button
                  key={shot.id}
                  initial={{ scale: 0, opacity: 0, rotate: -45 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  whileHover={{ scale: 1.4, zIndex: 30 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedShot(shot);
                  }}
                  className={cn(
                    "absolute w-3 h-3 sm:w-4 sm:h-4 -ml-1.5 -mt-1.5 sm:-ml-2 sm:-mt-2 rounded-full border-[1.5px] sm:border-2 flex items-center justify-center transition-all z-20",
                    shot.isGoal 
                      ? "bg-yellow-500 border-white shadow-[0_0_15px_rgba(234,179,8,0.5)]" 
                      : "bg-emerald-500 border-black shadow-[0_0_10px_rgba(16,185,129,0.3)]",
                    selectedShot?.id === shot.id ? "ring-2 sm:ring-4 ring-white scale-150" : 
                    matchDominance > 0.2 ? "ring-1 sm:ring-2 ring-blue-500/50" :
                    matchDominance < -0.2 ? "ring-1 sm:ring-2 ring-red-500/50" : ""
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
          </motion.div>
        </div>

        {/* Right Column: Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          {/* Opponent Input */}
          {/* Configuration Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4 sm:mb-6">
              <Settings className="w-4 h-4 text-blue-500" />
              <h2 className="font-bold text-xs sm:text-sm uppercase tracking-widest text-gray-400">
                {selectedShot ? 'Modifica Tiro' : 'Nuovo Tiro'}
              </h2>
            </div>

            <div className="space-y-4 sm:space-y-6">
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase mb-2 sm:mb-3 block">Squadra</label>
                <div className="bg-black/40 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-white/10 text-sm font-bold text-white">
                  {teamName}
                </div>
              </div>
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase mb-2 sm:mb-3 block">Nome Giocatore</label>
                {!isAddingNewPlayer ? (
                  <div className="relative">
                    <select 
                      value={selectedShot ? selectedShot.playerName : newShotConfig.playerName}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "ADD_NEW") {
                          setIsAddingNewPlayer(true);
                        } else {
                          if (selectedShot) {
                            updateShot(selectedShot.id, { playerName: val });
                          } else {
                            setNewShotConfig(prev => ({ ...prev, playerName: val }));
                          }
                        }
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none text-white"
                    >
                      <option value="">Seleziona giocatore...</option>
                      {playerList.length > 0 && (
                        <optgroup label="In questa partita">
                          {playerList.map(p => <option key={p} value={p}>{p}</option>)}
                        </optgroup>
                      )}
                      <optgroup label="Squadra / Suggeriti">
                        {PREDEFINED_PLAYERS.map(p => <option key={p} value={p}>{p}</option>)}
                      </optgroup>
                      <option value="ADD_NEW">+ Aggiungi nuovo...</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input 
                      autoFocus
                      type="text"
                      placeholder="Nome nuovo giocatore"
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value;
                          if (val) {
                            if (selectedShot) {
                              updateShot(selectedShot.id, { playerName: val });
                            } else {
                              setNewShotConfig(prev => ({ ...prev, playerName: val }));
                            }
                            setIsAddingNewPlayer(false);
                          }
                        }
                        if (e.key === 'Escape') setIsAddingNewPlayer(false);
                      }}
                    />
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setIsAddingNewPlayer(false)}
                      className="p-3 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all"
                      title="Annulla"
                    >
                      <X className="w-4 h-4" />
                    </motion.button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase mb-2 sm:mb-3 block">Parte Corpo</label>
                  <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
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
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
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
                    </motion.button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase mb-2 sm:mb-3 block">Risultato</label>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
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
                  </motion.button>
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
                    <motion.button
                      key={type}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
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
                    </motion.button>
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
        </div>
      </div>
    ) : (
          <IPOView 
            teamName={teamName}
            teamColor={teamColor}
            awayTeam={awayTeam}
            awayColor={awayColor}
            ipoEvents={ipoEvents}
            setIpoEvents={setIpoEvents}
            ipoEventsAway={ipoEventsAway}
            setIpoEventsAway={setIpoEventsAway}
            goals={goals}
            setGoals={setGoals}
            goalsAway={goalsAway}
            setGoalsAway={setGoalsAway}
            ipo={ipo}
            ipoAway={ipoAway}
            prevIpo={prevIpo}
            prevIpoAway={prevIpoAway}
            possessionSeconds={possessionSeconds}
            setPossessionSeconds={setPossessionSeconds}
            possessionAwaySeconds={possessionAwaySeconds}
            setPossessionAwaySeconds={setPossessionAwaySeconds}
            possessionState={possessionState}
            setPossessionState={setPossessionState}
            weights={weights}
            addMatchEvent={addMatchEvent}
            isReadOnly={isReadOnly}
          />
        )}
      </main>

      {/* Match Settings Modal */}
      <AnimatePresence>
        {showMatchSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMatchSettings(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#121212] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center">
                    <Settings className="text-blue-500 w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">Impostazioni Partita</h2>
                    <p className="text-xs text-gray-500 font-medium">Configura le squadre</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowMatchSettings(false)}
                  className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Home Team */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Squadra Casa</h3>
                  <div className="space-y-3">
                    <input 
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Nome Squadra Casa"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-white"
                    />
                    <div className="flex items-center gap-3">
                      <input 
                        type="color"
                        value={teamColor}
                        onChange={(e) => setTeamColor(e.target.value)}
                        className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer"
                      />
                      <span className="text-xs font-bold text-gray-400 uppercase">Colore Principale</span>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* Away Team */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Squadra Ospite</h3>
                  <div className="space-y-3">
                    <input 
                      type="text"
                      value={awayTeam}
                      onChange={(e) => setAwayTeam(e.target.value)}
                      placeholder="Nome Squadra Ospite"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-white"
                    />
                    <div className="flex items-center gap-3">
                      <input 
                        type="color"
                        value={awayColor}
                        onChange={(e) => setAwayColor(e.target.value)}
                        className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer"
                      />
                      <span className="text-xs font-bold text-gray-400 uppercase">Colore Principale</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowMatchSettings(false)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all shadow-lg shadow-blue-500/20 uppercase tracking-widest text-xs"
                >
                  Salva Impostazioni
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* xG Tuning Modal */}
      <AnimatePresence>
        {showXGTuning && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowXGTuning(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#121212] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600/10 rounded-xl flex items-center justify-center">
                    <Activity className="text-emerald-500 w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">Modello xG</h2>
                    <p className="text-xs text-gray-500 font-medium">Personalizza i coefficienti del calcolo</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowXGTuning(false)}
                  className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-gray-400 uppercase">Intercetta (Base)</label>
                    <span className="text-xs font-bold text-emerald-500">{xgCoeffs.beta0.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" min="-5" max="0" step="0.1"
                    value={xgCoeffs.beta0}
                    onChange={(e) => setXgCoeffs(prev => ({ ...prev, beta0: parseFloat(e.target.value) }))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-gray-400 uppercase">Penalità Distanza</label>
                    <span className="text-xs font-bold text-emerald-500">{xgCoeffs.beta1.toFixed(3)}</span>
                  </div>
                  <input 
                    type="range" min="-0.5" max="0" step="0.01"
                    value={xgCoeffs.beta1}
                    onChange={(e) => setXgCoeffs(prev => ({ ...prev, beta1: parseFloat(e.target.value) }))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-gray-400 uppercase">Bonus Angolo</label>
                    <span className="text-xs font-bold text-emerald-500">{xgCoeffs.beta2.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="5" step="0.1"
                    value={xgCoeffs.beta2}
                    onChange={(e) => setXgCoeffs(prev => ({ ...prev, beta2: parseFloat(e.target.value) }))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                <div className="h-px bg-white/5" />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase">Bonus Piede</label>
                    <input 
                      type="number" step="0.1"
                      value={xgCoeffs.beta3Foot}
                      onChange={(e) => setXgCoeffs(prev => ({ ...prev, beta3Foot: parseFloat(e.target.value) }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-1 focus:ring-emerald-500/50 outline-none"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase">Bonus Passaggio</label>
                    <input 
                      type="number" step="0.1"
                      value={xgCoeffs.beta4Pass}
                      onChange={(e) => setXgCoeffs(prev => ({ ...prev, beta4Pass: parseFloat(e.target.value) }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-1 focus:ring-emerald-500/50 outline-none"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase">Bonus Cross</label>
                    <input 
                      type="number" step="0.1"
                      value={xgCoeffs.beta4Cross}
                      onChange={(e) => setXgCoeffs(prev => ({ ...prev, beta4Cross: parseFloat(e.target.value) }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-1 focus:ring-emerald-500/50 outline-none"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase">Bonus Ribattuta</label>
                    <input 
                      type="number" step="0.1"
                      value={xgCoeffs.beta4Rebound}
                      onChange={(e) => setXgCoeffs(prev => ({ ...prev, beta4Rebound: parseFloat(e.target.value) }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-1 focus:ring-emerald-500/50 outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setXgCoeffs(DEFAULT_XG_COEFFICIENTS)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-400 font-black rounded-xl transition-all uppercase tracking-widest text-[10px]"
                  >
                    Reset Default
                  </button>
                  <button 
                    onClick={() => setShowXGTuning(false)}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-all shadow-lg shadow-emerald-500/20 uppercase tracking-widest text-[10px]"
                  >
                    Applica
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                      <div 
                        className={cn(
                          "flex-1 overflow-hidden",
                          loadingMatchId ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                        )} 
                        onClick={() => !loadingMatchId && loadMatch(match)}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: match.teamColor || '#eab308' }} />
                            <span className="text-xs sm:text-sm font-black text-white truncate">{match.teamName}</span>
                          </div>
                          <span className="text-[8px] sm:text-[10px] font-bold bg-blue-600/10 text-blue-500 px-2 py-0.5 rounded-full w-fit">
                            {match.goals} Gol • {match.totalXG.toFixed(2)} xG
                          </span>
                        </div>
                        <p className="text-[8px] sm:text-[10px] text-gray-500 font-medium uppercase tracking-widest">
                          {new Date(match.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 ml-2">
                        <button 
                          onClick={() => {
                            const url = `${window.location.origin}${window.location.pathname}?matchId=${match.id}`;
                            navigator.clipboard.writeText(url);
                            setShowToast({ message: "Link copiato negli appunti!", type: 'success' });
                          }}
                          className="p-1.5 sm:p-2 bg-white/5 hover:bg-blue-500/20 text-gray-500 hover:text-blue-500 rounded-lg transition-all"
                          title="Condividi"
                        >
                          <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button 
                          onClick={() => loadMatch(match)}
                          disabled={loadingMatchId !== null}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] sm:text-xs font-black rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                          {loadingMatchId === match.id ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Caricamento...</span>
                            </>
                          ) : (
                            'Carica'
                          )}
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

function IPOView({ 
  teamName, 
  teamColor,
  awayTeam,
  awayColor,
  ipoEvents, 
  setIpoEvents, 
  ipoEventsAway,
  setIpoEventsAway,
  goals,
  setGoals,
  goalsAway,
  setGoalsAway,
  ipo,
  ipoAway,
  prevIpo,
  prevIpoAway,
  possessionSeconds,
  setPossessionSeconds,
  possessionAwaySeconds,
  setPossessionAwaySeconds,
  possessionState,
  setPossessionState,
  weights,
  addMatchEvent,
  isReadOnly
}: any) {
  const [ipoActiveTeam, setIpoActiveTeam] = useState<'home' | 'away'>('home');
  const efficiency = ipoActiveTeam === 'home' 
    ? (ipo > 0 ? goals / ipo : 0)
    : (ipoAway > 0 ? goalsAway / ipoAway : 0);

  const renderEventRow = (key: string, label: string, weight: number, icon: any, activeTeam: 'home' | 'away') => {
    const currentIpoEvents = activeTeam === 'home' ? ipoEvents : ipoEventsAway;
    const setIpoEventsFn = activeTeam === 'home' ? setIpoEvents : setIpoEventsAway;
    const currentTeamName = activeTeam === 'home' ? teamName : awayTeam;
    const currentTeamColor = activeTeam === 'home' ? teamColor : awayColor;
    
    const count = currentIpoEvents[key as keyof typeof ipoEvents];
    const teamColorStyle = { color: currentTeamColor };

    return (
      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 transition-colors"
            style={teamColorStyle}
          >
            {icon}
          </div>
          <div>
            <div className="text-xs font-black text-white uppercase tracking-tight">{label}</div>
            <div className="text-[10px] font-bold text-gray-500 uppercase">x{weight}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-black/40 rounded-lg p-1 border border-white/5">
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (isReadOnly) return;
                if (count > 0) {
                  setIpoEventsFn((prev: any) => ({ ...prev, [key]: prev[key] - 1 }));
                  addMatchEvent({
                    type: 'ipo_event',
                    description: `Rimosso ${label} per ${currentTeamName}`
                  });
                }
              }}
              disabled={isReadOnly}
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Minus className="w-4 h-4" />
            </motion.button>
            <div className="w-10 text-center font-black text-white text-lg">
              <AnimatedCounter value={count} decimals={0} />
            </div>
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (isReadOnly) return;
                setIpoEventsFn((prev: any) => ({ ...prev, [key]: prev[key] + 1 }));
                addMatchEvent({
                  type: 'ipo_event',
                  description: `Aggiunto ${label} per ${currentTeamName}`
                });
              }}
              disabled={isReadOnly}
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
            </motion.button>
          </div>
          <div 
            className="w-12 text-right font-black text-gray-400 transition-colors"
            style={teamColorStyle}
          >
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
        {/* Team Card */}
        <motion.div 
          className={cn(
            "w-full text-left relative overflow-hidden bg-[#121212] border-l-4 rounded-2xl p-6 shadow-2xl transition-all",
            "ring-2 ring-white/10"
          )}
          animate={{ 
            boxShadow: (ipoActiveTeam === 'home' ? (prevIpo !== undefined && ipo > prevIpo) : (prevIpoAway !== undefined && ipoAway > prevIpoAway))
              ? [`0px 0px 0px ${ipoActiveTeam === 'home' ? teamColor : awayColor}00`, `0px 0px 30px ${ipoActiveTeam === 'home' ? teamColor : awayColor}66`, `0px 0px 0px ${ipoActiveTeam === 'home' ? teamColor : awayColor}00`] 
              : "0px 0px 0px rgba(0,0,0,0)"
          }}
          style={{ 
            borderLeftColor: ipoActiveTeam === 'home' ? teamColor : awayColor,
          }}
        >
          <div className="flex justify-between items-start mb-8">
            <div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Squadra</span>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mt-1">
                {ipoActiveTeam === 'home' ? teamName : awayTeam}
              </h2>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">IPO</span>
              <div className="text-4xl font-black tracking-tighter" style={{ color: ipoActiveTeam === 'home' ? teamColor : awayColor }}>
                <AnimatedCounter value={ipoActiveTeam === 'home' ? ipo : ipoAway} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <span className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Gol</span>
              <div className="flex items-center justify-between">
                <motion.button 
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.8 }}
                  onClick={() => { 
                  if (isReadOnly) return;
                  if (ipoActiveTeam === 'home') {
                    if (goals > 0) {
                      setGoals(goals - 1);
                      addMatchEvent({ type: 'ipo_event', description: `Annullato GOL per ${teamName}` });
                    }
                  } else {
                    if (goalsAway > 0) {
                      setGoalsAway(goalsAway - 1);
                      addMatchEvent({ type: 'ipo_event', description: `Annullato GOL per ${awayTeam}` });
                    }
                  }
                }}
                disabled={isReadOnly}
                className="text-gray-500 hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Minus className="w-4 h-4" />
                </motion.button>
                <span className="text-2xl font-black text-white">
                  <AnimatedCounter value={ipoActiveTeam === 'home' ? goals : goalsAway} decimals={0} />
                </span>
                <motion.button 
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.8 }}
                  onClick={() => { 
                  if (isReadOnly) return;
                  if (ipoActiveTeam === 'home') {
                    setGoals(goals + 1);
                    addMatchEvent({ type: 'goal', description: `GOL segnato da ${teamName}` });
                  } else {
                    setGoalsAway(goalsAway + 1);
                    addMatchEvent({ type: 'goal', description: `GOL segnato da ${awayTeam}` });
                  }
                }}
                disabled={isReadOnly}
                className="text-gray-500 hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <span className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Efficienza</span>
              <div className="text-2xl font-black text-white">
                <AnimatedCounter value={efficiency} decimals={2} />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Possession Card */}
        <div className="bg-[#121212] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Possesso Palla</span>
            </div>
            <div className="flex p-1 bg-black/40 rounded-xl border border-white/5">
              <button 
                onClick={() => {
                  if (isReadOnly) return;
                  setPossessionState(possessionState === 'home' ? 'none' : 'home');
                }}
                disabled={isReadOnly}
                className={cn(
                  "px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed",
                  possessionState === 'home' ? "text-white shadow-lg" : "text-gray-500"
                )}
                style={possessionState === 'home' ? { backgroundColor: teamColor } : {}}
              >
                {teamName}
              </button>
              <button 
                onClick={() => {
                  if (isReadOnly) return;
                  setPossessionState('none');
                }}
                disabled={isReadOnly}
                className={cn(
                  "px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all mx-1 disabled:opacity-30 disabled:cursor-not-allowed",
                  possessionState === 'none' ? "bg-white/20 text-white" : "text-gray-600"
                )}
              >
                OFF
              </button>
              <button 
                onClick={() => {
                  if (isReadOnly) return;
                  setPossessionState(possessionState === 'away' ? 'none' : 'away');
                }}
                disabled={isReadOnly}
                className={cn(
                  "px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed",
                  possessionState === 'away' ? "text-white shadow-lg" : "text-gray-500"
                )}
                style={possessionState === 'away' ? { backgroundColor: awayColor } : {}}
              >
                {awayTeam}
              </button>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-gray-500 uppercase">{teamName}</span>
                  <span className="text-[10px] font-black text-white">
                    {Math.round((possessionSeconds / (possessionSeconds + possessionAwaySeconds || 1)) * 100)}%
                  </span>
                </div>
                <div className="text-xl font-black text-white">
                  {Math.floor(possessionSeconds / 60)}' {String(possessionSeconds % 60).padStart(2, '0')}"
                </div>
              </div>
              <div className="space-y-1 text-right">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-white">
                    {Math.round((possessionAwaySeconds / (possessionSeconds + possessionAwaySeconds || 1)) * 100)}%
                  </span>
                  <span className="text-[10px] font-black text-gray-500 uppercase">{awayTeam}</span>
                </div>
                <div className="text-xl font-black text-white">
                  {Math.floor(possessionAwaySeconds / 60)}' {String(possessionAwaySeconds % 60).padStart(2, '0')}"
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="h-3 bg-white/5 rounded-full overflow-hidden flex border border-white/5">
                <motion.div 
                  className="h-full"
                  initial={{ width: '50%' }}
                  animate={{ width: `${(possessionSeconds + possessionAwaySeconds) > 0 ? (possessionSeconds / (possessionSeconds + possessionAwaySeconds)) * 100 : 50}%` }}
                  style={{ backgroundColor: teamColor }}
                />
                <motion.div 
                  className="h-full"
                  initial={{ width: '50%' }}
                  animate={{ width: `${(possessionSeconds + possessionAwaySeconds) > 0 ? (possessionAwaySeconds / (possessionSeconds + possessionAwaySeconds)) * 100 : 50}%` }}
                  style={{ backgroundColor: awayColor }}
                />
              </div>
              <div className="flex justify-center">
                <button 
                  onClick={() => {
                    setPossessionSeconds(0);
                    setPossessionAwaySeconds(0);
                  }}
                  className="text-[9px] font-black text-gray-600 hover:text-red-500 transition-colors uppercase tracking-widest"
                >
                  Reset Tempi Possesso
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Events */}
      <div className="lg:col-span-7 bg-[#121212] border border-white/5 rounded-3xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-white/5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-500"
              >
                <Target className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">
                Eventi IPO
              </h3>
            </div>
            <button 
              onClick={() => {
                if (ipoActiveTeam === 'home') {
                  setIpoEvents({ shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
                  setGoals(0);
                  setPossessionSeconds(0);
                } else {
                  setIpoEventsAway({ shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
                  setGoalsAway(0);
                  setPossessionAwaySeconds(0);
                }
                addMatchEvent({ type: 'match_reset', description: `Reset totale ${ipoActiveTeam === 'home' ? teamName : awayTeam}` });
              }}
              className="p-2 text-gray-500 hover:text-white transition-colors"
              title="Resetta statistiche"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>

          {/* Team Selector Tabs */}
          <div className="flex p-1 bg-black/40 rounded-xl border border-white/5">
            <button
              onClick={() => setIpoActiveTeam('home')}
              className={cn(
                "flex-1 py-2 px-4 rounded-lg text-xs font-black uppercase transition-all",
                ipoActiveTeam === 'home' 
                  ? "bg-white/10 text-white shadow-lg" 
                  : "text-gray-500 hover:text-gray-300"
              )}
              style={ipoActiveTeam === 'home' ? { borderBottom: `2px solid ${teamColor}` } : {}}
            >
              {teamName}
            </button>
            <button
              onClick={() => setIpoActiveTeam('away')}
              className={cn(
                "flex-1 py-2 px-4 rounded-lg text-xs font-black uppercase transition-all",
                ipoActiveTeam === 'away' 
                  ? "bg-white/10 text-white shadow-lg" 
                  : "text-gray-500 hover:text-gray-300"
              )}
              style={ipoActiveTeam === 'away' ? { borderBottom: `2px solid ${awayColor}` } : {}}
            >
              {awayTeam}
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 space-y-3 overflow-y-auto custom-scrollbar">
          {renderEventRow('shotsIn', 'Tiro in area', weights.shotsIn, <Target className="w-5 h-5" />, ipoActiveTeam)}
          {renderEventRow('shotsOut', 'Tiro fuori', weights.shotsOut, <Zap className="w-5 h-5" />, ipoActiveTeam)}
          {renderEventRow('penalties', 'Rigore', weights.penalties, <CheckCircle2 className="w-5 h-5" />, ipoActiveTeam)}
          {renderEventRow('freeKicks', 'Punizione', weights.freeKicks, <MousePointer2 className="w-4 h-4 rotate-45" />, ipoActiveTeam)}
          {renderEventRow('corners', 'Corner', weights.corners, <Trophy className="w-5 h-5" />, ipoActiveTeam)}
          {renderEventRow('crosses', 'Cross/Traversone', weights.crosses, <Activity className="w-5 h-5" />, ipoActiveTeam)}
        </div>

        <div className="p-6 bg-black/40 border-t border-white/5 flex justify-between items-center">
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Totale IPO {ipoActiveTeam === 'home' ? teamName : awayTeam}</span>
          <div className="text-3xl font-black text-blue-500">
            {(ipoActiveTeam === 'home' ? ipo : ipoAway).toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
}

