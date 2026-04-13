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
  Shield
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
  homeColor?: string;
  awayColor?: string;
  date: string;
  createdAt: any;
  totalXG: number;
  totalGoals: number;
  ipoEventsHome?: any;
  ipoEventsAway?: any;
  goalsHome?: number;
  goalsAway?: number;
  possessionHomeSeconds?: number;
  possessionAwaySeconds?: number;
  myTeamSide?: 'home' | 'away';
  matchEvents?: MatchEvent[];
}

interface MatchEvent {
  id: string;
  minute: number;
  type: 'shot' | 'goal' | 'ipo_event' | 'possession_change' | 'match_start' | 'match_pause' | 'match_reset';
  team: 'home' | 'away' | 'none';
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
    <path d="M136 376 L256 136 L376 376" stroke="currentColor" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="256" cy="216" r="40" fill="currentColor" className="animate-pulse"/>
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

export default function App() {
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
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [homeTeam, setHomeTeam] = useState('Bologna U18');
  const [awayTeam, setAwayTeam] = useState('Avversario');
  const [homeColor, setHomeColor] = useState('#eab308'); // Yellow-500
  const [awayColor, setAwayColor] = useState('#3b82f6'); // Blue-500
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loadingMatchId, setLoadingMatchId] = useState<string | null>(null);

  // UI States
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null);
  const [showToast, setShowToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeTab, setActiveTab] = useState<'xg' | 'ipo'>('xg');
  const [teamFilter, setTeamFilter] = useState<'all' | 'home' | 'away'>('home');
  const [myTeamSide, setMyTeamSide] = useState<'home' | 'away'>('home');

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState(0);
  const lastTickRef = useRef<number>(Date.now());
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [possessionState, setPossessionState] = useState<'home' | 'away' | 'none'>('none');
  const [possessionHomeSeconds, setPossessionHomeSeconds] = useState(0);
  const [possessionAwaySeconds, setPossessionAwaySeconds] = useState(0);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [ripples, setRipples] = useState<{ id: string, x: number, y: number }[]>([]);
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.4);
  const [heatmapSaturation, setHeatmapSaturation] = useState(100);
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
  const [ipoEventsHome, setIpoEventsHome] = useState({
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

  const [goalsHome, setGoalsHome] = useState(0);
  const [goalsAway, setGoalsAway] = useState(0);

  // Dynamic Theme Logic
  const scoreDiff = goalsHome - goalsAway;
  const possessionDiff = (possessionHomeSeconds - possessionAwaySeconds) / 60;
  const matchDominance = Math.max(-1, Math.min(1, (scoreDiff * 0.4) + (possessionDiff * 0.05)));
  
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

  const ipoHome = useMemo(() => calculateIPO(ipoEventsHome), [ipoEventsHome]);
  const ipoAway = useMemo(() => calculateIPO(ipoEventsAway), [ipoEventsAway]);

  const prevIpoHome = usePrevious(ipoHome);
  const prevIpoAway = usePrevious(ipoAway);

  const [newShotConfig, setNewShotConfig] = useState<{
    team: 'home' | 'away';
    bodyPart: BodyPart;
    assistType: AssistType;
    isGoal: boolean;
    playerName: string;
    minute: number;
  }>({
    team: 'home',
    bodyPart: 'foot',
    assistType: 'none',
    isGoal: false,
    playerName: '',
    minute: 0,
  });

  const pitchRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const xgGrid = useMemo(() => generateXGGrid(), []);

  // Online status effect
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
            setPossessionHomeSeconds(prev => prev + deltaSec);
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
  const filteredShots = useMemo(() => {
    if (teamFilter === 'all') return shots;
    return shots.filter(s => s.team === teamFilter);
  }, [shots, teamFilter]);

  // Dynamic Stats for the main cards
  const displayShots = useMemo(() => {
    if (teamFilter === 'all') return shots.filter(s => s.team === myTeamSide);
    return filteredShots;
  }, [shots, filteredShots, teamFilter, myTeamSide]);

  const displayXG = useMemo(() => displayShots.reduce((sum, s) => sum + s.xg, 0), [displayShots]);
  const displayGoals = useMemo(() => displayShots.filter(s => s.isGoal).length, [displayShots]);
  const displayXGPerShot = useMemo(() => displayShots.length > 0 ? displayXG / displayShots.length : 0, [displayShots, displayXG]);

  const totalXG = useMemo(() => shots.reduce((sum, s) => sum + s.xg, 0), [shots]);
  const totalGoals = useMemo(() => shots.filter(s => s.isGoal).length, [shots]);

  // Chart Data
  const chartData = useMemo(() => [
    { name: 'Expected Goals (xG)', value: displayXG, color: '#10b981' },
    { name: 'Gol Reali', value: displayGoals, color: '#eab308' },
  ], [displayXG, displayGoals]);

  const filteredMatchEvents = useMemo(() => {
    if (teamFilter === 'all') return matchEvents;
    return matchEvents.filter(e => e.team === teamFilter || e.team === 'none');
  }, [matchEvents, teamFilter]);

  const handlePitchClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pitchRef.current) return;

    const rect = pitchRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const mY = (clickX / rect.width) * DEFAULT_PITCH.width;
    const mX = (clickY / rect.height) * DEFAULT_PITCH.height;

    const xg = calculateXG(mX, mY, newShotConfig.bodyPart, newShotConfig.assistType);

    const shotTeam = teamFilter === 'all' ? myTeamSide : teamFilter;

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
      team: shotTeam,
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
      team: newShotConfig.team,
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
        { Team: homeTeam, ...ipoEventsHome, Goals: goalsHome, Possession: `${Math.floor(possessionHomeSeconds / 60)}:${(possessionHomeSeconds % 60).toString().padStart(2, '0')}` },
        { Team: awayTeam, ...ipoEventsAway, Goals: goalsAway, Possession: `${Math.floor(possessionAwaySeconds / 60)}:${(possessionAwaySeconds % 60).toString().padStart(2, '0')}` }
      ];

      // 3. Match Events Log
      const eventsLog = matchEvents.map(e => ({
        Minuto: e.minute,
        Squadra: e.team === 'home' ? homeTeam : e.team === 'away' ? awayTeam : 'N/A',
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

      XLSX.writeFile(workbook, `MatchReport_${homeTeam}_vs_${awayTeam}_${new Date().toISOString().split('T')[0]}.xlsx`);
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
        homeTeam,
        awayTeam,
        homeColor,
        awayColor,
        date: new Date().toISOString(),
        createdAt: serverTimestamp(),
        totalXG: totalXG,
        totalGoals: totalGoals,
        ipoEventsHome,
        ipoEventsAway,
        goalsHome,
        goalsAway,
        possessionHomeSeconds,
        possessionAwaySeconds,
        myTeamSide
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

      setShowToast({ message: "Partita salvata con successo!", type: 'success' });
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
    try {
      setCurrentMatchId(match.id);
      setHomeTeam(match.homeTeam);
      setAwayTeam(match.awayTeam);
      setHomeColor(match.homeColor || '#eab308');
      setAwayColor(match.awayColor || '#3b82f6');
      setIpoEventsHome(match.ipoEventsHome || { shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
      setIpoEventsAway(match.ipoEventsAway || { shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
      setGoalsHome(match.goalsHome || 0);
      setGoalsAway(match.goalsAway || 0);
      setPossessionHomeSeconds(match.possessionHomeSeconds || 0);
      setPossessionAwaySeconds(match.possessionAwaySeconds || 0);
      setMyTeamSide(match.myTeamSide || 'home');
      setTeamFilter('all');
      setPossessionState('none');
      
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
    setIpoEventsHome({ shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
    setIpoEventsAway({ shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
    setGoalsHome(0);
    setGoalsAway(0);
    setPossessionHomeSeconds(0);
    setPossessionAwaySeconds(0);
    setPossessionState('none');
    setMatchEvents([]);
  };

  const getXGColor = (val: number) => {
    let h = 0;
    if (val < 0.1) h = 158; // Green
    else if (val < 0.3) h = 45; // Yellow
    else if (val < 0.6) h = 25; // Orange
    else h = 0; // Red

    return `hsla(${h}, ${heatmapSaturation}%, 50%, ${heatmapOpacity})`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="bg-black/40 border-b border-white/10 backdrop-blur-md sticky top-0 z-50">
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
                  <div 
                    className="h-full transition-all duration-500" 
                    style={{ 
                      width: `${possessionHomeSeconds + possessionAwaySeconds > 0 ? (possessionHomeSeconds / (possessionHomeSeconds + possessionAwaySeconds)) * 100 : 50}%`,
                      backgroundColor: homeColor
                    }}
                  />
                  <div 
                    className="h-full transition-all duration-500" 
                    style={{ 
                      width: `${possessionHomeSeconds + possessionAwaySeconds > 0 ? (possessionAwaySeconds / (possessionHomeSeconds + possessionAwaySeconds)) * 100 : 50}%`,
                      backgroundColor: awayColor
                    }}
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
                    possessionState === 'home' ? "text-white shadow-lg" : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                  )}
                  style={{ 
                    backgroundColor: possessionState === 'home' ? homeColor : undefined,
                    borderColor: possessionState === 'home' ? homeColor : undefined,
                    boxShadow: possessionState === 'home' ? `0 10px 15px -3px ${homeColor}33` : undefined
                  }}
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
                    possessionState === 'away' ? "text-white shadow-lg" : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                  )}
                  style={{ 
                    backgroundColor: possessionState === 'away' ? awayColor : undefined,
                    borderColor: possessionState === 'away' ? awayColor : undefined,
                    boxShadow: possessionState === 'away' ? `0 10px 15px -3px ${awayColor}33` : undefined
                  }}
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
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className={cn(
                    "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all",
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
                    setPossessionHomeSeconds(0);
                    setPossessionAwaySeconds(0);
                    setPossessionState('none');
                  }}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </div>

            <div className="h-8 w-px bg-white/10 shrink-0" />

            {/* Dominance Indicator */}
            <div className="hidden md:flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 shrink-0">
              <div className="flex items-center gap-2">
                <Activity 
                  className="w-3.5 h-3.5 transition-colors"
                  style={{ color: matchDominance > 0.2 ? homeColor : matchDominance < -0.2 ? awayColor : '#6b7280' }}
                />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Dominio</span>
              </div>
              <div className="flex items-center gap-1 w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  animate={{ 
                    width: `${Math.abs(matchDominance) * 100}%`,
                    backgroundColor: matchDominance > 0 ? homeColor : awayColor,
                    x: matchDominance > 0 ? '50%' : '-50%'
                  }}
                  className="h-full rounded-full"
                  style={{ marginLeft: '50%' }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                />
              </div>
            </div>

            <div className="h-8 w-px bg-white/10 shrink-0" />

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
                <div className="flex items-center bg-white/5 rounded-lg p-1 border border-white/10">
                  <button 
                    onClick={() => setTeamFilter('all')}
                    className={cn(
                      "px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-medium transition-all",
                      teamFilter === 'all' ? "bg-white/20 text-white shadow-lg" : "text-gray-400 hover:text-white"
                    )}
                  >
                    Tutti
                  </button>
                  <button 
                    onClick={() => setTeamFilter('home')}
                    className={cn(
                      "px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-medium transition-all",
                      teamFilter === 'home' ? "text-white shadow-lg" : "text-gray-400 hover:text-white"
                    )}
                    style={{ backgroundColor: teamFilter === 'home' ? homeColor : undefined }}
                  >
                    Casa
                  </button>
                  <button 
                    onClick={() => setTeamFilter('away')}
                    className={cn(
                      "px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-medium transition-all",
                      teamFilter === 'away' ? "text-white shadow-lg" : "text-gray-400 hover:text-white"
                    )}
                    style={{ backgroundColor: teamFilter === 'away' ? awayColor : undefined }}
                  >
                    Ospite
                  </button>
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
                        <span className="text-[8px] font-black text-gray-500 uppercase">Saturazione</span>
                        <span className="text-[8px] font-bold text-blue-500">{heatmapSaturation}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        step="10" 
                        value={heatmapSaturation}
                        onChange={(e) => setHeatmapSaturation(parseInt(e.target.value))}
                        className="w-20 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
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

              {user ? (
                <>
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
                    disabled={isSaving}
                    className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50"
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
              borderColor: possessionState === 'home' ? 'rgba(59, 130, 246, 0.5)' : 
                          possessionState === 'away' ? 'rgba(239, 68, 68, 0.5)' : 
                          'rgba(255, 255, 255, 0.1)',
              boxShadow: possessionState === 'home' ? '0 0 30px rgba(59, 130, 246, 0.15)' : 
                         possessionState === 'away' ? '0 0 30px rgba(239, 68, 68, 0.15)' : 
                         '0 0 0px rgba(0,0,0,0)'
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
                disabled={shots.length === 0}
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
              {filteredShots.map((shot) => (
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
          {/* Opponent Input */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-red-500" />
              <h2 className="font-bold text-xs sm:text-sm uppercase tracking-widest text-gray-400">
                Avversario
              </h2>
            </div>
            <input 
              type="text" 
              value={awayTeam}
              onChange={(e) => setAwayTeam(e.target.value)}
              placeholder="Nome Avversario"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
            />
          </div>

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
                <label className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase mb-2 sm:mb-3 block">Squadra</label>
                <div className="bg-black/40 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-white/10 text-sm font-bold text-white">
                  { (selectedShot ? selectedShot.team : (teamFilter === 'all' ? myTeamSide : teamFilter)) === 'home' ? homeTeam : awayTeam }
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

          <div className="space-y-6">
            {/* Shot List Summary */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-3 sm:p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-400">Ultimi Tiri</h3>
                <span className="bg-emerald-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full">{filteredShots.length}</span>
              </div>
              <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                {filteredShots.length === 0 ? (
                  <div className="p-6 text-center text-gray-600 text-[10px] italic">Nessun tiro registrato</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {filteredShots.slice().reverse().map((shot) => (
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
              <MatchLog events={filteredMatchEvents} homeTeam={homeTeam} awayTeam={awayTeam} />
            </div>
          </div>
        </div>
      </div>
    ) : (
          <IPOView 
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            homeColor={homeColor}
            awayColor={awayColor}
            ipoEventsHome={ipoEventsHome}
            setIpoEventsHome={setIpoEventsHome}
            ipoEventsAway={ipoEventsAway}
            setIpoEventsAway={setIpoEventsAway}
            goalsHome={goalsHome}
            setGoalsHome={setGoalsHome}
            goalsAway={goalsAway}
            setGoalsAway={setGoalsAway}
            ipoHome={ipoHome}
            ipoAway={ipoAway}
            prevIpoHome={prevIpoHome}
            prevIpoAway={prevIpoAway}
            possessionHomeSeconds={possessionHomeSeconds}
            setPossessionHomeSeconds={setPossessionHomeSeconds}
            possessionAwaySeconds={possessionAwaySeconds}
            setPossessionAwaySeconds={setPossessionAwaySeconds}
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
                      <div 
                        className={cn(
                          "flex-1 overflow-hidden",
                          loadingMatchId ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                        )} 
                        onClick={() => !loadingMatchId && loadMatch(match)}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: match.homeColor || '#eab308' }} />
                            <span className="text-xs sm:text-sm font-black text-white truncate">{match.homeTeam}</span>
                            <span className="text-[10px] text-gray-500">vs</span>
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: match.awayColor || '#3b82f6' }} />
                            <span className="text-xs sm:text-sm font-black text-white truncate">{match.awayTeam}</span>
                          </div>
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
  homeTeam, 
  awayTeam, 
  homeColor,
  awayColor,
  ipoEventsHome, 
  setIpoEventsHome, 
  ipoEventsAway, 
  setIpoEventsAway,
  goalsHome,
  setGoalsHome,
  goalsAway,
  setGoalsAway,
  ipoHome,
  ipoAway,
  prevIpoHome,
  prevIpoAway,
  possessionHomeSeconds,
  setPossessionHomeSeconds,
  possessionAwaySeconds,
  setPossessionAwaySeconds,
  weights,
  addMatchEvent
}: any) {
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('home');

  const efficiencyHome = ipoHome > 0 ? goalsHome / ipoHome : 0;
  const efficiencyAway = ipoAway > 0 ? goalsAway / ipoAway : 0;

  const renderEventRow = (team: 'home' | 'away', key: string, label: string, weight: number, icon: any) => {
    const events = team === 'home' ? ipoEventsHome : ipoEventsAway;
    const setEvents = team === 'home' ? setIpoEventsHome : setIpoEventsAway;
    const count = events[key as keyof typeof events];
    const teamColorStyle = { color: team === 'home' ? homeColor : awayColor };

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
                if (count > 0) {
                  setEvents((prev: any) => ({ ...prev, [key]: prev[key] - 1 }));
                  addMatchEvent({
                    type: 'ipo_event',
                    team,
                    description: `Rimosso ${label} per ${team === 'home' ? homeTeam : awayTeam}`
                  });
                }
              }}
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
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
                setEvents((prev: any) => ({ ...prev, [key]: prev[key] + 1 }));
                addMatchEvent({
                  type: 'ipo_event',
                  team,
                  description: `Aggiunto ${label} per ${team === 'home' ? homeTeam : awayTeam}`
                });
              }}
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
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
        {/* Home Team Card */}
        <motion.button 
          onClick={() => setSelectedTeam('home')}
          animate={{ 
            scale: selectedTeam === 'home' ? 1 : 0.98,
            borderColor: selectedTeam === 'home' ? homeColor : 'transparent',
            boxShadow: (prevIpoHome !== undefined && ipoHome > prevIpoHome) 
              ? [`0px 0px 0px ${homeColor}00`, `0px 0px 30px ${homeColor}66`, `0px 0px 0px ${homeColor}00`] 
              : "none"
          }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          className={cn(
            "w-full text-left relative overflow-hidden bg-[#121212] border-l-4 rounded-2xl p-6 shadow-2xl transition-all",
            selectedTeam === 'home' ? "ring-2 ring-white/10" : "opacity-60 hover:opacity-100"
          )}
          style={{ borderLeftColor: homeColor }}
        >
          <div className="flex justify-between items-start mb-8">
            <div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Squadra Casa</span>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mt-1">{homeTeam}</h2>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">IPO</span>
              <div className="text-4xl font-black tracking-tighter" style={{ color: homeColor }}>
                <AnimatedCounter value={ipoHome} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <span className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Gol</span>
              <div className="flex items-center justify-between">
                <motion.div 
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.8 }}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (goalsHome > 0) {
                      setGoalsHome(goalsHome - 1);
                      addMatchEvent({ type: 'ipo_event', team: 'home', description: `Annullato GOL per ${homeTeam}` });
                    }
                  }}
                  className="text-gray-500 hover:text-white cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </motion.div>
                <span className="text-2xl font-black text-white">
                  <AnimatedCounter value={goalsHome} decimals={0} />
                </span>
                <motion.div 
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.8 }}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setGoalsHome(goalsHome + 1);
                    addMatchEvent({ type: 'goal', team: 'home', description: `GOL segnato da ${homeTeam}` });
                  }}
                  className="text-gray-500 hover:text-white cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </motion.div>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <span className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Efficienza</span>
              <div className="text-2xl font-black text-white">
                <AnimatedCounter value={efficiencyHome} decimals={2} />
              </div>
            </div>
          </div>
        </motion.button>

        {/* Away Team Card */}
        <motion.button 
          onClick={() => setSelectedTeam('away')}
          animate={{ 
            scale: selectedTeam === 'away' ? 1 : 0.98,
            borderColor: selectedTeam === 'away' ? awayColor : 'transparent',
            boxShadow: (prevIpoAway !== undefined && ipoAway > prevIpoAway) 
              ? [`0px 0px 0px ${awayColor}00`, `0px 0px 30px ${awayColor}66`, `0px 0px 0px ${awayColor}00`] 
              : "none"
          }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          className={cn(
            "w-full text-left relative overflow-hidden bg-[#121212] border-l-4 rounded-2xl p-6 shadow-2xl transition-all",
            selectedTeam === 'away' ? "ring-2 ring-white/10" : "opacity-60 hover:opacity-100"
          )}
          style={{ borderLeftColor: awayColor }}
        >
          <div className="flex justify-between items-start mb-8">
            <div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Squadra Ospite</span>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mt-1">{awayTeam}</h2>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">IPO</span>
              <div className="text-4xl font-black tracking-tighter" style={{ color: awayColor }}>
                <AnimatedCounter value={ipoAway} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <span className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Gol</span>
              <div className="flex items-center justify-between">
                <motion.div 
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.8 }}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (goalsAway > 0) {
                      setGoalsAway(goalsAway - 1);
                      addMatchEvent({ type: 'ipo_event', team: 'away', description: `Annullato GOL per ${awayTeam}` });
                    }
                  }}
                  className="text-gray-500 hover:text-white cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </motion.div>
                <span className="text-2xl font-black text-white">
                  <AnimatedCounter value={goalsAway} decimals={0} />
                </span>
                <motion.div 
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.8 }}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setGoalsAway(goalsAway + 1);
                    addMatchEvent({ type: 'goal', team: 'away', description: `GOL segnato da ${awayTeam}` });
                  }}
                  className="text-gray-500 hover:text-white cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </motion.div>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <span className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Efficienza</span>
              <div className="text-2xl font-black text-white">
                <AnimatedCounter value={efficiencyAway} decimals={2} />
              </div>
            </div>
          </div>
        </motion.button>

        {/* Comparison Card */}
        <div className="bg-[#121212] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-4 h-4 text-gray-500" />
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Confronto IPO</span>
          </div>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-[10px] font-bold uppercase mb-2">
                <span className="text-white">{homeTeam}</span>
                <span style={{ color: homeColor }}>
                  <AnimatedCounter value={ipoHome} />
                </span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (ipoHome / (ipoHome + ipoAway || 1)) * 100)}%` }}
                  className="h-full" 
                  style={{ backgroundColor: homeColor }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-bold uppercase mb-2">
                <span className="text-white">{awayTeam}</span>
                <span style={{ color: awayColor }}>
                  <AnimatedCounter value={ipoAway} />
                </span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (ipoAway / (ipoHome + ipoAway || 1)) * 100)}%` }}
                  className="h-full" 
                  style={{ backgroundColor: awayColor }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
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
                <span style={{ color: homeColor }}>
                  {possessionHomeSeconds + possessionAwaySeconds > 0 ? Math.round((possessionHomeSeconds / (possessionHomeSeconds + possessionAwaySeconds)) * 100) : 50}%
                </span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-500" 
                  style={{ 
                    width: `${possessionHomeSeconds + possessionAwaySeconds > 0 ? (possessionHomeSeconds / (possessionHomeSeconds + possessionAwaySeconds)) * 100 : 50}%`,
                    backgroundColor: homeColor
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-bold uppercase mb-2">
                <span className="text-white">{awayTeam}</span>
                <span style={{ color: awayColor }}>
                  {possessionHomeSeconds + possessionAwaySeconds > 0 ? Math.round((possessionAwaySeconds / (possessionHomeSeconds + possessionAwaySeconds)) * 100) : 50}%
                </span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-500" 
                  style={{ 
                    width: `${possessionHomeSeconds + possessionAwaySeconds > 0 ? (possessionAwaySeconds / (possessionHomeSeconds + possessionAwaySeconds)) * 100 : 50}%`,
                    backgroundColor: awayColor
                  }}
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
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
              style={{ 
                backgroundColor: selectedTeam === 'home' ? `${homeColor}1a` : `${awayColor}1a`,
                color: selectedTeam === 'home' ? homeColor : awayColor
              }}
            >
              <Target className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight">
              Eventi <span style={{ color: selectedTeam === 'home' ? homeColor : awayColor }}>
                {selectedTeam === 'home' ? homeTeam : awayTeam}
              </span>
            </h3>
          </div>
          <button 
            onClick={() => {
              if (selectedTeam === 'home') {
                setIpoEventsHome({ shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
                setGoalsHome(0);
                setPossessionHomeSeconds(0);
                addMatchEvent({ type: 'match_reset', team: 'home', description: `Reset totale ${homeTeam}` });
              } else {
                setIpoEventsAway({ shotsIn: 0, shotsOut: 0, penalties: 0, freeKicks: 0, corners: 0, crosses: 0 });
                setGoalsAway(0);
                setPossessionAwaySeconds(0);
                addMatchEvent({ type: 'match_reset', team: 'away', description: `Reset totale ${awayTeam}` });
              }
            }}
            className="p-2 text-gray-500 hover:text-white transition-colors"
            title="Resetta statistiche squadra"
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
