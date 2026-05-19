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
  UserPlus,
  RotateCw,
  ChevronUp
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
  matchEvents?: MatchEvent[];
}

interface MatchEvent {
  id: string;
  minute: number;
  type: 'shot' | 'goal' | 'ipo_event' | 'match_start' | 'match_pause' | 'match_reset';
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
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#3b82f6" />
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Minimalist Hexagonal Shield / Data Node */}
    <path 
      d="M50 5 L89 27.5 V72.5 L50 95 L11 72.5 V27.5 L50 5Z" 
      fill="url(#logo-gradient)" 
      filter="url(#glow)"
    />
    <path 
      d="M50 20 L76 35 V65 L50 80 L24 65 V35 L50 20Z" 
      fill="white" 
      fillOpacity="0.15"
    />
    <path 
      d="M50 30 L67 40 V60 L50 70 L33 60 V40 L50 30Z" 
      fill="white" 
      fillOpacity="0.9"
    />
    <circle cx="50" cy="50" r="5" fill="#2563eb" />
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

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Check for Service Worker readiness and Install Prompt
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        setIsPWAReady(true);
      });
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Handle Shared Match Loading via URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedMatchId = params.get('matchId');
    if (sharedMatchId && sharedMatchId !== currentMatchId) {
      loadSharedMatch(sharedMatchId);
    }
  }, [user, currentMatchId]);

  useEffect(() => {
    const checkUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const sharedMatchId = params.get('matchId');
      if (sharedMatchId && sharedMatchId !== currentMatchId) {
        loadSharedMatch(sharedMatchId);
      }
    };

    window.addEventListener('popstate', checkUrl);
    return () => window.removeEventListener('popstate', checkUrl);
  }, [currentMatchId]); // Re-register if currentMatchId changes so checkUrl uses the right one

  const installPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const loadSharedMatch = async (matchId: string) => {
    if (loadingMatchId === matchId) return;
    setLoadingMatchId(matchId);
    setIsReadOnly(true);
    
    try {
      const matchDoc = await getDoc(doc(db, 'matches', matchId));
      if (!matchDoc.exists()) {
        setShowToast({ message: "Partita non trovata o link scaduto.", type: 'error' });
        setIsReadOnly(false);
        setLoadingMatchId(null);
        return;
      }
      
      const matchData = { ...matchDoc.data(), id: matchDoc.id } as Match;
      
      // If user is the owner, allow editing
      if (user && matchData.userId === user.uid) {
        setIsReadOnly(false);
      }
      
      setCurrentMatchId(matchData.id);
      setTeamName(matchData.teamName || 'Bologna U18');
      setTeamColor(matchData.teamColor || '#eab308');
      setAwayTeam(matchData.awayTeam || 'Avversario');
      setAwayColor(matchData.awayColor || '#3b82f6');
      setIpoEvents(matchData.ipoEvents || { shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
      setIpoEventsAway(matchData.ipoEventsAway || { shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
      setGoals(matchData.goals || 0);
      setGoalsAway(matchData.goalsAway || 0);
      
      const shotsSnapshot = await getDocs(collection(db, 'matches', matchData.id, 'shots'));
      const shotsData = shotsSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }) as Shot);
      
      setShots(shotsData);
      setSelectedShot(null);
      setShowToast({ 
        message: user && matchData.userId === user.uid ? "La tua partita è stata caricata!" : "Partita condivisa caricata (sola lettura)", 
        type: 'success' 
      });
    } catch (error) {
      console.error("Load Shared Match Error:", error);
      setShowToast({ message: "Errore nel caricamento della partita. Controlla la connessione.", type: 'error' });
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
  const matchDominance = Math.max(-1, Math.min(1, goals * 0.4));
  
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
          lastTickRef.current = now - (deltaMs % 1000);
        }
      }, 100); // Check more frequently to be responsive
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

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
        { Team: teamName, ...ipoEvents, Goals: goals }
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

        // Store this in a way we can clean up if needed, but for now we'll just handle it
        // Note: multiple logins without refresh might leak listeners if not handled correctly
      } else {
        setMatches([]);
        setShowMatchList(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Re-check ownership when user logs in
  useEffect(() => {
    if (currentMatchId && user && isReadOnly) {
      // We check if the current match belongs to the newly logged in user
      const checkOwnership = async () => {
        try {
          const matchDoc = await getDoc(doc(db, 'matches', currentMatchId));
          if (matchDoc.exists() && matchDoc.data().userId === user.uid) {
            setIsReadOnly(false);
            setShowToast({ message: "Bentornato! Ora puoi modificare questa partita.", type: 'success' });
          }
        } catch (e) {
          console.error("Error checking ownership:", e);
        }
      };
      checkOwnership();
    }
  }, [user, currentMatchId]);

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
        goalsAway
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
    <div className="relative min-h-screen bg-[#070708] text-gray-100 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      {/* Global Loading Overlay */}
      <AnimatePresence>
        {loadingMatchId && !showMatchList && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#070708]/95 backdrop-blur-2xl flex flex-col items-center justify-center gap-8"
          >
            <div className="relative">
              <div className="w-16 h-16 border-2 border-blue-500/10 rounded-full" />
              <div className="absolute inset-0 w-16 h-16 border-2 border-t-blue-500 rounded-full animate-spin" />
              <AppLogo className="absolute inset-0 m-auto w-6 h-6 animate-pulse" />
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center">
              <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-white">Sincronizzazione</h3>
              <p className="text-gray-500 text-[10px] font-medium tracking-widest uppercase opacity-50">Preparazione campo Analitico...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-[#070708]/50 border-b border-white/[0.03] backdrop-blur-3xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between gap-8">
          <div className="flex items-center gap-5">
            <div className="w-11 h-11 flex items-center justify-center bg-white/[0.03] border border-white/5 rounded-2xl shadow-xl relative group overflow-hidden transition-all duration-500 hover:border-blue-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-blue-400/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <AppLogo className="w-7 h-7 relative z-10 group-hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2.5">
                <h1 className="font-black text-lg tracking-tight text-white leading-none uppercase">
                  Analytic <span className="text-blue-500">Hub</span>
                </h1>
                <div className="flex gap-1 items-center">
                  <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                  <span className="w-1 h-1 rounded-full bg-white/10" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button 
                  onClick={() => setShowMatchSettings(true)}
                  className="flex items-center gap-2 hover:text-blue-400 transition-all group/match whitespace-nowrap"
                >
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.1em] group-hover/match:text-blue-400/80 transition-colors">
                    {teamName} <span className="text-gray-700 italic lowercase mx-0.5 opacity-50">vs</span> {awayTeam || 'Avversario'}
                  </span>
                  <Settings className="w-2.5 h-2.5 text-gray-700 group-hover/match:text-blue-400 opacity-50 transition-all" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="hidden lg:flex items-center bg-white/[0.02] border border-white/5 rounded-2xl px-5 py-2 gap-6">
              <div className="flex items-center gap-2.5">
                <div className={cn("w-1.5 h-1.5 rounded-full transition-colors", isOnline ? "bg-emerald-500" : "bg-red-500 animate-pulse")} />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">{isOnline ? 'Online' : 'Offline'}</span>
              </div>
              <div className="w-px h-3.5 bg-white/10" />
              <div className="flex items-center gap-2.5 text-[10px] font-black font-mono tabular-nums text-white/90 leading-none tracking-widest">
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:{String(timerSeconds % 60).padStart(2, '0')}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className={cn(
                  "px-4 py-2.5 rounded-2xl transition-all border outline-none",
                  isTimerRunning 
                    ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/20" 
                    : "bg-blue-600/10 border-blue-500/20 text-blue-500 hover:bg-blue-600/20"
                )}
              >
                <div className="flex items-center gap-2">
                  {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span className="text-[10px] font-bold uppercase tracking-widest hidden xs:inline">{isTimerRunning ? 'Pausa' : 'Avvia'}</span>
                </div>
              </button>
              
              <div className="h-8 w-px bg-white/5 mx-1" />

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowMatchList(true)}
                  className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-gray-500 hover:text-white hover:border-white/10 transition-all outline-none"
                  title="Le mie partite"
                >
                  <List className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => user ? logout() : login()}
                  className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-gray-500 hover:text-white hover:border-white/10 transition-all outline-none"
                  title={user ? "Logout" : "Accedi"}
                >
                  {user ? <LogOut className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                </button>
              </div>
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

              <div className="flex items-center gap-2">
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

              {deferredPrompt && (
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={installPWA}
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs font-black uppercase tracking-widest">Installa</span>
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

      <main ref={dashboardRef} className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'xg' ? (
          <div className="flex flex-col gap-8">
            {/* Bento Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 group hover:border-blue-500/20 transition-all duration-500"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <Target className="w-4 h-4" />
                  </div>
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Expected Goals</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white tabular-nums tracking-tight">
                      <AnimatedCounter value={displayXG} />
                    </span>
                    <span className="text-xs font-bold text-blue-500/60 uppercase">xG</span>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 group hover:border-yellow-500/20 transition-all duration-500"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-8 h-8 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                    <Trophy className="w-4 h-4" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Gol Reali</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white tabular-nums tracking-tight">{displayGoals}</span>
                    <span className="text-xs font-bold text-yellow-500/60 uppercase">GOL</span>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 group hover:border-emerald-500/20 transition-all duration-500"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">xG/Tiro</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white tabular-nums tracking-tight">
                      <AnimatedCounter value={displayXGPerShot} decimals={2} />
                    </span>
                    <span className="text-xs font-bold text-emerald-500/60 uppercase">Qualità</span>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 group hover:border-purple-500/20 transition-all duration-500"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                    <Zap className="w-4 h-4" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Indice IPO</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white tabular-nums tracking-tight">
                      <AnimatedCounter value={ipo} decimals={1} />
                    </span>
                    <div className={cn(
                      "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                      ipo > ipoAway ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                    )}>
                      {ipo > ipoAway ? 'Dominio' : 'In Difesa'}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Pitch Area */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                <div className="relative bg-white/[0.01] border border-white/[0.03] rounded-[3rem] p-4 sm:p-6 lg:p-8 overflow-hidden group/field">
                  {/* Field Tools */}
                  <div className="absolute top-8 left-8 flex items-center gap-3 z-10 pointer-events-none">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-950/80 backdrop-blur-xl border border-white/5 rounded-full ring-1 ring-white/5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">Analisi Campo</span>
                    </div>
                  </div>

                  <div className="absolute top-8 right-8 flex items-center gap-2 z-20">
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => undoLastShot()}
                      disabled={shots.length === 0 || isReadOnly}
                      className="p-2.5 rounded-xl bg-gray-950/80 backdrop-blur-xl border border-white/5 text-gray-400 hover:text-white disabled:opacity-20 transition-all outline-none"
                    >
                      <Undo2 className="w-4 h-4" />
                    </motion.button>
                  </div>

                  {/* Pitch Canvas Styled */}
                  <div 
                    ref={pitchRef}
                    onClick={handlePitchClick}
                    className={cn(
                      "relative aspect-[34/17] w-full bg-[#0a0a0b] border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl cursor-crosshair transition-all duration-1000",
                      isTimerRunning ? "shadow-[0_0_80px_-20px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20" : ""
                    )}
                  >
                    {/* Minimal Markings */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.07]" viewBox="0 0 68 34">
                      <rect x="0" y="0" width="68" height="34" fill="none" stroke="white" strokeWidth="0.15" />
                      <rect x="13.84" y="0" width="40.32" height="16.5" fill="none" stroke="white" strokeWidth="0.15" />
                      <rect x="24.84" y="0" width="18.32" height="5.5" fill="none" stroke="white" strokeWidth="0.15" />
                      <circle cx="34" cy="11" r="0.2" fill="white" />
                      <path d="M 27.5 16.5 A 9.15 9.15 0 0 0 40.5 16.5" fill="none" stroke="white" strokeWidth="0.15" />
                      <rect x="0" y="17" width="68" height="0.1" fill="white" fillOpacity="0.5" />
                    </svg>

                    {/* Heatmap */}
                    <AnimatePresence>
                      {showHeatmap && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 grid grid-cols-[repeat(34,1fr)] grid-rows-[repeat(17,1fr)] pointer-events-none"
                        >
                          {xgGrid.map((row, r) => row.map((val, c) => (
                            <div key={`${r}-${c}`} style={{ backgroundColor: getXGColor(val) }} className="transition-colors duration-1000" />
                          )))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Shots */}
                    {shots.map((shot) => (
                      <motion.div
                        key={shot.id}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        whileHover={{ scale: 1.4, zIndex: 50 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedShot(shot);
                        }}
                        className={cn(
                          "absolute w-4 h-4 -ml-2 -mt-2 rounded-full flex items-center justify-center cursor-pointer shadow-xl transition-all",
                          shot.isGoal ? "bg-yellow-400 ring-4 ring-yellow-400/20" : "bg-white/80 ring-2 ring-white/10",
                          selectedShot?.id === shot.id ? "ring-blue-500 ring-opacity-100 z-50 scale-125" : ""
                        )}
                        style={{ 
                          top: `${(shot.x / DEFAULT_PITCH.height) * 100}%`, 
                          left: `${(shot.y / DEFAULT_PITCH.width) * 100}%` 
                        }}
                      >
                        {shot.isGoal ? (
                          <Trophy className="w-1.5 h-1.5 text-black" />
                        ) : (
                          <div className="w-1 h-1 bg-black/40 rounded-full" />
                        )}
                      </motion.div>
                    ))}

                    {/* Interaction Ripples */}
                    {ripples.map(ripple => (
                      <motion.div
                        key={ripple.id}
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 5, opacity: 0 }}
                        className="absolute w-8 h-8 -ml-4 -mt-4 border border-blue-500/50 rounded-full pointer-events-none"
                        style={{ top: `${ripple.y}%`, left: `${ripple.x}%` }}
                      />
                    ))}
                  </div>

                  <div className="mt-8 flex items-center justify-between px-2">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-400" />
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Gol</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-white/80" />
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Tiro</span>
                      </div>
                    </div>
                    <p className="text-[9px] font-bold text-gray-600 uppercase tracking-[0.2em]">Interfaccia Tattica v2.0</p>
                  </div>
                </div>
              </div>

              {/* Sidebar Action Zone */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                <section className="bg-white/[0.02] border border-white/[0.05] rounded-[2.5rem] p-7 transition-all hover:bg-white/[0.03]">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-11 h-11 bg-white/[0.03] border border-white/5 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                      {selectedShot ? <Settings className="w-5 h-5 animate-spin-slow" /> : <Plus className="w-5 h-5 text-gray-400" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">{selectedShot ? 'Modifica Evento' : 'Registra Tiro'}</h3>
                      <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-1">Dati real-time</p>
                    </div>
                  </div>

                  <div className="space-y-7">
                    <div className="space-y-3">
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Giocatore</label>
                      <div className="relative group">
                        <select 
                          value={selectedShot ? selectedShot.playerName : newShotConfig.playerName}
                          onChange={(e) => {
                             const val = e.target.value;
                             if (val === 'ADD_NEW') setIsAddingNewPlayer(true);
                             else if (selectedShot) updateShot(selectedShot.id, { playerName: val });
                             else setNewShotConfig(prev => ({ ...prev, playerName: val }));
                          }}
                          className="w-full bg-[#0d0d0e] border border-white/5 rounded-2xl py-4 px-6 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none"
                        >
                          <option value="">Seleziona...</option>
                          {PREDEFINED_PLAYERS.map(p => <option key={p} value={p}>{p}</option>)}
                          {playerList.filter(p => !PREDEFINED_PLAYERS.includes(p)).map(p => <option key={p} value={p}>{p}</option>)}
                          <option value="ADD_NEW">+ Aggiungi Nuovo</option>
                        </select>
                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-700 pointer-events-none" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Parte Corpo</label>
                        <div className="flex bg-[#0d0d0e] p-1 rounded-2xl border border-white/5">
                          {[
                            { id: 'foot', label: 'Piede', icon: Footprints },
                            { id: 'head', label: 'Testa', icon: UserIcon }
                          ].map(part => (
                            <button
                              key={part.id}
                              onClick={() => {
                                if (selectedShot) updateShot(selectedShot.id, { bodyPart: part.id as BodyPart });
                                else setNewShotConfig(prev => ({ ...prev, bodyPart: part.id as BodyPart }));
                              }}
                              className={cn(
                                "flex-1 flex flex-col items-center gap-2 py-3 rounded-xl transition-all duration-300",
                                (selectedShot ? selectedShot.bodyPart : newShotConfig.bodyPart) === part.id 
                                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                                  : "text-gray-500 hover:text-gray-300"
                              )}
                            >
                              <part.icon className="w-4 h-4" />
                              <span className="text-[8px] font-black uppercase tracking-tighter">{part.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Esito</label>
                        <button
                          onClick={() => {
                            if (selectedShot) updateShot(selectedShot.id, { isGoal: !selectedShot.isGoal });
                            else setNewShotConfig(prev => ({ ...prev, isGoal: !prev.isGoal }));
                          }}
                          className={cn(
                            "w-full h-full min-h-[78px] flex flex-col items-center justify-center gap-2 border-2 rounded-2xl transition-all duration-300",
                            (selectedShot ? selectedShot.isGoal : newShotConfig.isGoal)
                              ? "bg-yellow-500/10 border-yellow-500/40 text-yellow-500" 
                              : "bg-[#0d0d0e] border-white/5 text-gray-600 hover:border-white/10"
                          )}
                        >
                          <Trophy className={cn("w-5 h-5", (selectedShot ? selectedShot.isGoal : newShotConfig.isGoal) ? "animate-bounce" : "opacity-30")} />
                          <span className="text-[8px] font-black uppercase tracking-widest leading-none">
                            {(selectedShot ? selectedShot.isGoal : newShotConfig.isGoal) ? 'GOL' : 'TIRO'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-4 space-y-4">
                      {selectedShot && (
                        <div className="flex flex-col gap-2">
                           <button 
                             onClick={() => removeShot(selectedShot.id)}
                             className="w-full py-4 bg-red-500/5 hover:bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                           >
                             Elimina Tiro
                           </button>
                           <button 
                             onClick={() => setSelectedShot(null)}
                             className="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                           >
                             Chiudi Modifica
                           </button>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={saveMatch} disabled={isSaving || isReadOnly} className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-500/10 flex items-center justify-center gap-2 disabled:opacity-30">
                          <Save className="w-3.5 h-3.5" /> Salva
                        </button>
                        <button onClick={exportToExcel} className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                          <FileDown className="w-3.5 h-3.5" /> Export
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Event Feed Bento Card */}
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-[2.5rem] p-7 h-[300px] flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Live Feed</h3>
                    <div className="px-2 py-1 bg-white/5 rounded-lg text-[8px] font-black text-blue-500">{matchEvents.length} EVENTI</div>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
                    {matchEvents.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-700 opacity-50">
                        <Activity className="w-8 h-8 mb-3" />
                        <span className="text-[8px] font-black uppercase tracking-widest">In attesa di eventi...</span>
                      </div>
                    ) : (
                      matchEvents.map(event => (
                        <div key={event.id} className="flex gap-4 p-3 bg-white/[0.02] border border-white/[0.03] rounded-2xl group hover:border-white/10 transition-all">
                          <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                            event.type === 'goal' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-blue-600/10 text-blue-500'
                          )}>
                            {event.type === 'goal' ? <Trophy className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-white leading-snug">{event.description}</p>
                            <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest mt-1">Minuto {event.minute}'</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
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

                <div className="h-px bg-white/5" />

                {/* Offline Guide */}
                <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Shield className="w-4 h-4" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest">Guida Offline</h3>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    Per avviare l'app senza internet, aggiungila alla schermata Home (clicca "Installa" nell'header o usa il menu del browser). Una volta installata, l'app si caricherà istantaneamente anche offline.
                  </p>
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
              className="absolute inset-0 bg-[#070708]/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0d0d0e] border border-white/[0.05] rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-white/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/[0.03] rounded-2xl flex items-center justify-center">
                    <List className="text-blue-500 w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white uppercase tracking-tight">Le Mie Partite</h2>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Archivio Analitico</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowMatchList(false)}
                  className="w-12 h-12 bg-white/[0.03] hover:bg-white/[0.06] rounded-2xl flex items-center justify-center text-gray-500 hover:text-white transition-all outline-none"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4 no-scrollbar">
                {matches.length === 0 ? (
                  <div className="py-24 text-center">
                    <div className="w-20 h-20 bg-white/[0.02] rounded-full flex items-center justify-center mx-auto mb-6">
                      <FileSpreadsheet className="w-8 h-8 text-gray-700" />
                    </div>
                    <p className="text-gray-600 text-[10px] font-black uppercase tracking-[0.2em]">Nessuna partita salvata</p>
                  </div>
                ) : (
                  matches.map((match) => (
                    <div 
                      key={match.id}
                      className="group bg-white/[0.01] border border-white/5 hover:border-blue-500/20 rounded-3xl p-5 flex items-center justify-between transition-all"
                    >
                      <div 
                        className={cn(
                          "flex-1 overflow-hidden",
                          loadingMatchId ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                        )} 
                        onClick={() => !loadingMatchId && loadMatch(match)}
                      >
                        <div className="flex items-center gap-4 mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-white uppercase tracking-tight">{match.teamName}</span>
                            <span className="text-[9px] font-bold text-gray-700 uppercase italic">vs</span>
                            <span className="text-sm font-black text-white uppercase tracking-tight">{match.awayTeam || 'Avversario'}</span>
                          </div>
                          <div className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[8px] font-black uppercase tracking-widest">
                            {match.goals} Gol • {match.totalXG.toFixed(2)} xG
                          </div>
                        </div>
                        <p className="text-[9px] text-gray-600 font-bold uppercase tracking-[0.2em]">
                          {new Date(match.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <button 
                          onClick={() => {
                            const url = `${window.location.origin}${window.location.pathname}?matchId=${match.id}`;
                            navigator.clipboard.writeText(url);
                            setShowToast({ message: "Link copiato!", type: 'success' });
                          }}
                          className="p-3 bg-white/[0.03] hover:bg-blue-500/10 text-gray-600 hover:text-blue-500 rounded-xl transition-all"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => loadMatch(match)}
                          disabled={loadingMatchId !== null}
                          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
                        >
                          {loadingMatchId === match.id ? 'Loading...' : 'Apri'}
                        </button>
                        <button 
                          onClick={() => setMatchToDelete(match.id)}
                          className="p-3 bg-white/[0.03] hover:bg-red-500/10 text-gray-600 hover:text-red-500 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
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
            initial={{ opacity: 0, y: 50, x: '-50%', scale: 0.9 }}
            animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
            exit={{ opacity: 0, y: 50, x: '-50%', scale: 0.9 }}
            className="fixed bottom-12 left-1/2 z-[300] px-8 py-4 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-4 border border-white/[0.05] bg-[#0d0d0e]/95 backdrop-blur-2xl"
          >
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center",
              showToast.type === 'success' ? "bg-blue-500/10 text-blue-500" : "bg-red-500/10 text-red-500"
            )}>
              {showToast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            </div>
            <span className="font-black text-[10px] uppercase tracking-widest text-white leading-none">{showToast.message}</span>
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
    
    const count = currentIpoEvents[key as keyof typeof ipoEvents];

    return (
      <div className="flex items-center justify-between p-5 rounded-[2rem] bg-white/[0.01] border border-white/[0.03] hover:bg-white/[0.02] transition-all group">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center text-gray-400 group-hover:text-blue-500 transition-colors">
            {icon}
          </div>
          <div>
            <div className="text-[10px] font-black text-white uppercase tracking-[0.1em]">{label}</div>
            <div className="text-[8px] font-bold text-gray-600 uppercase tracking-widest mt-1">PESO: {weight}</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center bg-gray-950/50 rounded-2xl p-1.5 border border-white/5">
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (isReadOnly || count <= 0) return;
                setIpoEventsFn((prev: any) => ({ ...prev, [key]: prev[key] - 1 }));
                addMatchEvent({ type: 'ipo_event', description: `Rimosso ${label} (${currentTeamName})` });
              }}
              className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-white transition-colors"
            >
              <Minus className="w-4 h-4" />
            </motion.button>
            <div className="w-12 text-center font-black text-white text-xl tabular-nums">
              {count}
            </div>
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (isReadOnly) return;
                setIpoEventsFn((prev: any) => ({ ...prev, [key]: prev[key] + 1 }));
                addMatchEvent({ type: 'ipo_event', description: `Aggiunto ${label} (${currentTeamName})` });
              }}
              className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
            </motion.button>
          </div>
          <div className="w-16 text-right font-black text-blue-500 text-lg tabular-nums">
            {(count * weight).toFixed(1)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-8">
      {/* Scoreboard Bento */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-1 bg-white/[0.02] border border-white/[0.05] rounded-[2.5rem] p-8 flex flex-col justify-between min-h-[220px]"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Live Status</p>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none mb-2">
              {ipoActiveTeam === 'home' ? teamName : awayTeam}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{ipoActiveTeam === 'home' ? 'Squadra Casa' : 'Squadra Ospite'}</span>
              <div className="h-px w-8 bg-white/10" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1 bg-white/[0.02] border border-white/[0.05] rounded-[2.5rem] p-8 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Performance Index</p>
            <Zap className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-4">
            <span className="text-6xl font-black text-white tracking-tighter tabular-nums">
              <AnimatedCounter value={ipoActiveTeam === 'home' ? ipo : ipoAway} />
            </span>
            <span className="text-xs font-black text-blue-500 uppercase tracking-widest leading-none bg-blue-500/10 px-3 py-1 rounded-full">IPO</span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-1 bg-white/[0.02] border border-white/[0.05] rounded-[2.5rem] p-8 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Real Efficiency</p>
            <Trophy className="w-4 h-4 text-yellow-500" />
          </div>
          <div className="flex items-center justify-between">
             <div className="flex flex-col">
                <span className="text-4xl font-black text-white">{ipoActiveTeam === 'home' ? goals : goalsAway}</span>
                <span className="text-[8px] font-bold text-gray-600 uppercase mt-1">GOL TOTALI</span>
             </div>
             <div className="h-10 w-px bg-white/10 mx-4" />
             <div className="flex flex-col text-right">
                <span className="text-4xl font-black text-white">{(efficiency * 100).toFixed(0)}%</span>
                <span className="text-[8px] font-bold text-gray-600 uppercase mt-1">EFFICIENZA</span>
             </div>
          </div>
        </motion.div>
      </div>

      {/* Events Control Zone */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 flex flex-col gap-6">
           <div className="bg-[#0d0d0e] border border-white/5 rounded-[2.5rem] p-4 flex flex-col gap-2">
             <button
               onClick={() => setIpoActiveTeam('home')}
               className={cn(
                 "group relative py-6 px-8 rounded-[2rem] text-left transition-all duration-500 overflow-hidden",
                 ipoActiveTeam === 'home' ? "bg-white/[0.03]" : "hover:bg-white/[0.01]"
               )}
             >
               {ipoActiveTeam === 'home' && <motion.div layoutId="ipo-active" className="absolute inset-0 bg-blue-500/5 ring-1 ring-blue-500/20" />}
               <div className="relative z-10">
                 <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-1">Squadra A</p>
                 <h4 className="text-sm font-black text-white uppercase tracking-tight">{teamName}</h4>
               </div>
             </button>
             <button
               onClick={() => setIpoActiveTeam('away')}
               className={cn(
                 "group relative py-6 px-8 rounded-[2rem] text-left transition-all duration-500 overflow-hidden",
                 ipoActiveTeam === 'away' ? "bg-white/[0.03]" : "hover:bg-white/[0.01]"
               )}
             >
               {ipoActiveTeam === 'away' && <motion.div layoutId="ipo-active" className="absolute inset-0 bg-blue-500/5 ring-1 ring-blue-500/20" />}
               <div className="relative z-10">
                 <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-1">Squadra B</p>
                 <h4 className="text-sm font-black text-white uppercase tracking-tight">{awayTeam || 'Avversario'}</h4>
               </div>
             </button>
           </div>

           <div className="bg-white/[0.01] border border-white/[0.03] rounded-[2.5rem] p-8 space-y-6">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                    <Zap className="w-4 h-4" />
                 </div>
                 <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Azioni Rapide</h4>
              </div>
              <div className="flex flex-col gap-3">
                 <button 
                   onClick={() => {
                     if (ipoActiveTeam === 'home') setGoals(goals + 1);
                     else setGoalsAway(goalsAway + 1);
                     addMatchEvent({ type: 'goal', description: `GOL rapido (${ipoActiveTeam === 'home' ? teamName : awayTeam})` });
                   }}
                   className="w-full py-4 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-yellow-500/20 flex items-center justify-center gap-3"
                 >
                   <Trophy className="w-4 h-4" /> Registra GOL
                 </button>
                 <button 
                    onClick={() => {
                      if (ipoActiveTeam === 'home') {
                        setIpoEvents({ shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
                        setGoals(0);
                      } else {
                        setIpoEventsAway({ shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
                        setGoalsAway(0);
                      }
                      addMatchEvent({ type: 'match_reset', description: `Reset (${ipoActiveTeam === 'home' ? teamName : awayTeam})` });
                    }}
                    className="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
                 >
                    Reset Statistiche
                 </button>
              </div>
           </div>
        </div>

        <div className="lg:col-span-8 bg-white/[0.01] border border-white/[0.03] rounded-[3rem] p-8">
           <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Pannello Eventi</h3>
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-1">Click per incrementare l'indice IPO</p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-xl">
                 <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">LIVE TRACKING</span>
                 <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderEventRow('shotsIn', 'Tiro in area', weights.shotsIn, <Target className="w-5 h-5" />, ipoActiveTeam)}
              {renderEventRow('shotsOut', 'Tiro fuori/respinto', weights.shotsOut, <Zap className="w-5 h-5" />, ipoActiveTeam)}
              {renderEventRow('penalties', 'Calcio di Rigore', weights.penalties, <CheckCircle2 className="w-5 h-5" />, ipoActiveTeam)}
              {renderEventRow('freeKicks', 'Calcio di Punizione', weights.freeKicks, <Activity className="w-5 h-5" />, ipoActiveTeam)}
              {renderEventRow('corners', 'Calcio d\'angolo', weights.corners, <RotateCw className="w-5 h-5" />, ipoActiveTeam)}
              {renderEventRow('crosses', 'Cross/Traversone', weights.crosses, <ChevronUp className="w-5 h-5" />, ipoActiveTeam)}
           </div>

           <div className="mt-10 pt-8 border-t border-white/[0.03] flex items-center justify-between">
              <p className="text-[9px] font-bold text-gray-700 uppercase tracking-[0.2em]">Algoritmo IPO v3.4 Dynamic Weighting</p>
              <div className="flex items-center gap-4">
                 <span className="text-[10px] font-black text-gray-500 uppercase">Totale</span>
                 <span className="text-3xl font-black text-white">{(ipoActiveTeam === 'home' ? ipo : ipoAway).toFixed(1)}</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

