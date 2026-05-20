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
  Settings2,
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
  ChevronUp,
  Sun,
  Moon,
  Users,
  Folder,
  FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

import { Shot, BodyPart, AssistType, DEFAULT_PITCH, Player } from './types';
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
  shotId?: string;
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
      <linearGradient id="logo-blue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </linearGradient>
      <linearGradient id="logo-neon" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10b981" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
      <linearGradient id="logo-rainbow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="50%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#10b981" />
      </linearGradient>
      <filter id="premium-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* Elegant background grid overlay representing a technical tactical pitch */}
    <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.08" />
    <path d="M 50 6 V 94 M 6 50 H 94" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.05" />
    <circle cx="50" cy="50" r="14" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.06" fill="none" />

    {/* Technical vertical data bars forming an ascending chart trajectory */}
    {/* Bar 1: Base stats (slanted, technical pill) */}
    <rect x="29" y="44" width="7" height="32" rx="3.5" transform="rotate(-12 29 44)" fill="url(#logo-blue)" fillOpacity="0.85" />
    
    {/* Bar 2: Expected Goals buildup */}
    <rect x="44" y="32" width="7" height="44" rx="3.5" transform="rotate(-12 44 32)" fill="url(#logo-blue)" />
    
    {/* Bar 3: Real conversion (emerald highlight) */}
    <rect x="59" y="24" width="7" height="52" rx="3.5" transform="rotate(-12 59 24)" fill="url(#logo-neon)" />

    {/* The Majestic Trajectory Arc - represents the perfect curvy kick cutting through the data */}
    <path 
      d="M 18 80 C 26 58, 54 26, 76 22" 
      stroke="url(#logo-rainbow)" 
      strokeWidth="4" 
      strokeLinecap="round"
      filter="url(#premium-glow)"
    />

    {/* Precise technical intersection dots representing tactical position points */}
    <circle cx="21" cy="72" r="2.5" fill="currentColor" fillOpacity="0.25" />
    <circle cx="41" cy="46" r="2.5" fill="currentColor" fillOpacity="0.25" />

    {/* Dynamic Shot / Breakaway Ball Target Node representing peak success */}
    <circle cx="76" cy="22" r="5.5" fill="white" filter="url(#premium-glow)" />
    <circle cx="76" cy="22" r="2.5" fill="#10b981" />
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
  const [showSquadModal, setShowSquadModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [squadSearch, setSquadSearch] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [squadRoleFilter, setSquadRoleFilter] = useState<'Tutti' | 'Portiere' | 'Difensore' | 'Centrocampista' | 'Attaccante'>('Tutti');

  // A list of Team Folders (cartelle della squadra) to store squad versions
  const [teamFolders, setTeamFolders] = useState<{ id: string; name: string; players: Player[] }[]>(() => {
    const saved = localStorage.getItem('team_folders');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
         console.error("Errore nel parse delle cartelle della squadra", e);
      }
    }
    // Default BOLOGNA preset folder
    const defaultPlayersList: Player[] = PREDEFINED_PLAYERS.map((name, index) => ({
      id: `p-${index}`,
      name: name,
      role: (index === 0 || index === 8) ? 'Portiere' : (index % 3 === 0) ? 'Difensore' : (index % 3 === 1) ? 'Centrocampista' : 'Attaccante',
      preferredFoot: index % 2 === 0 ? 'Destro' : 'Sinistro',
      active: true
    }));
    return [
      {
        id: 'bologna-default',
        name: 'BOLOGNA U18 DEFAULT',
        players: defaultPlayersList
      }
    ];
  });

  const [activeFolderId, setActiveFolderId] = useState<string>(() => {
    return localStorage.getItem('active_folder_id') || 'bologna-default';
  });

  // Squad Players State - initialized with either localStorage or active folder players
  const [squadPlayers, setSquadPlayers] = useState<Player[]>(() => {
    const saved = localStorage.getItem('squad_players');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Errore nel parse dei giocatori salvati", e);
      }
    }
    // Fallback to active folder
    const savedFolders = localStorage.getItem('team_folders');
    if (savedFolders) {
      try {
        const parsed = JSON.parse(savedFolders);
        const folderId = localStorage.getItem('active_folder_id') || 'bologna-default';
        const found = parsed.find((f: any) => f.id === folderId);
        if (found) return found.players;
      } catch (e) {}
    }
    // Default predefined players
    return PREDEFINED_PLAYERS.map((name, index) => ({
      id: `p-${index}`,
      name: name,
      role: (index === 0 || index === 8) ? 'Portiere' : (index % 3 === 0) ? 'Difensore' : (index % 3 === 1) ? 'Centrocampista' : 'Attaccante',
      preferredFoot: index % 2 === 0 ? 'Destro' : 'Sinistro',
      active: true
    }));
  });

  // Persist structures
  useEffect(() => {
    localStorage.setItem('squad_players', JSON.stringify(squadPlayers));
    // Keep active folder in sync with actual changes made to squadPlayers
    setTeamFolders(prev => prev.map(f => f.id === activeFolderId ? { ...f, players: squadPlayers } : f));
  }, [squadPlayers, activeFolderId]);

  useEffect(() => {
    localStorage.setItem('team_folders', JSON.stringify(teamFolders));
  }, [teamFolders]);

  useEffect(() => {
    localStorage.setItem('active_folder_id', activeFolderId);
    // When active folder changes, populate the player list from that folder
    const found = teamFolders.find(f => f.id === activeFolderId);
    if (found) {
      setSquadPlayers(found.players);
    }
  }, [activeFolderId]);

  // Update player list whenever squad players or shots change
  useEffect(() => {
    const shotPlayers = Array.from(new Set(shots.map(s => s.playerName))).filter(Boolean);
    const activeSquadNames = squadPlayers.filter(p => p.active).map(p => p.name);
    const combined = Array.from(new Set([...activeSquadNames, ...shotPlayers])).sort();
    setPlayerList(combined);
  }, [shots, squadPlayers]);
  
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
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const lastTickRef = useRef<number>(Date.now());
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [ripples, setRipples] = useState<{ id: string, x: number, y: number }[]>([]);
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.4);
  const [heatmapSaturation, setHeatmapSaturation] = useState(100);
  const [heatmapScale, setHeatmapScale] = useState<'default' | 'viridis' | 'plasma' | 'hot'>('default');
  const [hoveredCell, setHoveredCell] = useState<{ r: number, c: number, xg: number } | null>(null);

  const addMatchEvent = (event: Omit<MatchEvent, 'id' | 'timestamp' | 'minute'> & { minute?: number }) => {
    const newEvent: MatchEvent = {
      id: Math.random().toString(36).substr(2, 9),
      minute: event.minute !== undefined ? event.minute : Math.floor(timerSeconds / 60),
      timestamp: Date.now(),
      type: event.type,
      description: event.description,
      value: event.value,
      shotId: event.shotId
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
      value: newShot.xg,
      shotId: newShot.id,
      minute: newShot.minute
    });
  };

  const updateShot = (id: string, updates: Partial<Shot>) => {
    let finalShot: Shot | null = null;
    setShots(prev => prev.map(s => {
      if (s.id === id) {
        const updatedShot = { ...s, ...updates };
        // Recalculate xG if position or factors change
        if (updates.x !== undefined || updates.y !== undefined || updates.bodyPart !== undefined || updates.assistType !== undefined) {
          updatedShot.xg = calculateXG(updatedShot.x, updatedShot.y, updatedShot.bodyPart, updatedShot.assistType, xgCoeffs);
        }
        finalShot = updatedShot;
        return updatedShot;
      }
      return s;
    }));
    
    if (selectedShot?.id === id) {
      setSelectedShot(prev => prev ? { ...prev, ...updates } : null);
    }

    // Force update the match event for this shot
    if (finalShot) {
      const shot: Shot = finalShot;
      setMatchEvents(prev => prev.map(e => {
        if (e.shotId === id) {
          return {
            ...e,
            minute: shot.minute,
            type: shot.isGoal ? 'goal' : 'shot',
            description: `${shot.isGoal ? 'GOL!' : 'Tiro'} - xG: ${shot.xg.toFixed(2)} (${shot.playerName})`,
            value: shot.xg
          };
        }
        return e;
      }));
    }
  };

  const removeShot = (id: string) => {
    setShots(prev => prev.filter(s => s.id !== id));
    if (selectedShot?.id === id) setSelectedShot(null);

    // Remove the corresponding match event
    setMatchEvents(prev => prev.filter(e => e.shotId !== id));
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
        goalsAway,
        matchEvents // Added for live feed state persistence
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

      // Restore matchEvents with a robust fallback for old saved matches (backwards compatibility)
      let loadedEvents = match.matchEvents || [];
      if (loadedEvents.length === 0 && shotsData.length > 0) {
        loadedEvents = shotsData.map(shot => ({
          id: Math.random().toString(36).substr(2, 9),
          minute: shot.minute || 0,
          type: shot.isGoal ? 'goal' : 'shot',
          description: `${shot.isGoal ? 'GOL!' : 'Tiro'} - xG: ${shot.xg.toFixed(2)} (${shot.playerName})`,
          timestamp: shot.timestamp || Date.now(),
          value: shot.xg,
          shotId: shot.id
        }));
        // Sort reverse-chronologically so newest is first
        loadedEvents.sort((a, b) => b.timestamp - a.timestamp);
      }
      setMatchEvents(loadedEvents);

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
    setMatchEvents(prev => prev.filter(e => e.shotId !== lastShot.id));
    
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
    <div className={cn(
      "relative min-h-screen font-sans selection:bg-blue-500/30 overflow-x-hidden transition-colors duration-500",
      theme === 'dark' ? "bg-[#070708] text-gray-100" : "bg-white text-gray-900"
    )}>
      {/* Global Loading Overlay */}
      <AnimatePresence>
        {loadingMatchId && !showMatchList && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "fixed inset-0 z-[100] backdrop-blur-2xl flex flex-col items-center justify-center gap-8",
              theme === 'dark' ? "bg-[#070708]/95" : "bg-white/95"
            )}
          >
            <div className="relative">
              <div className="w-16 h-16 border-2 border-blue-500/10 rounded-full" />
              <div className="absolute inset-0 w-16 h-16 border-2 border-t-blue-500 rounded-full animate-spin" />
              <AppLogo className="absolute inset-0 m-auto w-6 h-6 animate-pulse" />
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center">
              <h3 className={cn("text-xs font-bold uppercase tracking-[0.3em]", theme === 'dark' ? "text-white" : "text-gray-900")}>Sincronizzazione</h3>
              <p className="text-gray-500 text-[10px] font-medium tracking-widest uppercase opacity-50">Preparazione campo Analitico...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className={cn(
        "border-b backdrop-blur-3xl sticky top-0 z-50 transition-colors duration-500",
        theme === 'dark' ? "bg-[#070708]/50 border-white/[0.03]" : "bg-white/70 border-gray-100"
      )}>
        <div className="max-w-[1600px] mx-auto px-6 h-18 flex items-center justify-between gap-8">
          <div className="flex items-center gap-5">
            <div className={cn(
              "w-10 h-10 flex items-center justify-center rounded-xl shadow-xl relative group overflow-hidden transition-all duration-500 hover:border-blue-500/20 border",
              theme === 'dark' ? "bg-white/[0.03] border-white/5" : "bg-gray-50 border-gray-200"
            )}>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-blue-400/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <AppLogo className="w-6 h-6 relative z-10 group-hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2.5">
                <h1 className={cn("font-black text-base tracking-tight leading-none uppercase", theme === 'dark' ? "text-white" : "text-gray-900")}>
                  Analytic <span className="text-blue-500">Hub</span>
                </h1>
                <div className="flex gap-1 items-center">
                  <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                  <span className={cn("w-1 h-1 rounded-full", theme === 'dark' ? "bg-white/10" : "bg-gray-200")} />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <button 
                  onClick={() => setShowMatchSettings(true)}
                  className="flex items-center gap-2 hover:text-blue-400 transition-all group/match whitespace-nowrap"
                >
                  <span className={cn("text-[8px] font-bold uppercase tracking-[0.1em] group-hover/match:text-blue-400/80 transition-colors", theme === 'dark' ? "text-gray-500" : "text-gray-400")}>
                    {teamName} <span className="italic lowercase mx-0.5 opacity-50">vs</span> {awayTeam || 'Avversario'}
                  </span>
                  <Settings className="w-2 h-2 text-gray-700 group-hover/match:text-blue-400 opacity-50 transition-all" />
                </button>
              </div>
            </div>
          </div>

          <div className={cn(
            "flex items-center border rounded-[1.25rem] p-1 gap-1",
            theme === 'dark' ? "bg-white/[0.02] border-white/5" : "bg-gray-50 border-gray-100"
          )}>
            <button
              onClick={() => setActiveTab('xg')}
              className={cn(
                "px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-1.5 outline-none",
                activeTab === 'xg' 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25 scale-[1.02]" 
                  : (theme === 'dark' ? "text-gray-500 hover:text-white hover:bg-white/[0.02]" : "text-gray-400 hover:text-gray-800 hover:bg-white")
              )}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Analisi Campo</span>
            </button>
            <button
              onClick={() => setActiveTab('ipo')}
              className={cn(
                "px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-1.5 outline-none",
                activeTab === 'ipo' 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25 scale-[1.02]" 
                  : (theme === 'dark' ? "text-gray-500 hover:text-white hover:bg-white/[0.02]" : "text-gray-400 hover:text-gray-800 hover:bg-white")
              )}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Indice IPO</span>
            </button>
          </div>

          <div className="flex items-center gap-6">
            <div className={cn(
              "hidden lg:flex items-center border rounded-xl px-4 py-1.5 gap-4",
              theme === 'dark' ? "bg-white/[0.02] border-white/5" : "bg-gray-50 border-gray-100"
            )}>
              <div className="flex items-center gap-2">
                <div className={cn("w-1 h-1 rounded-full transition-colors", isOnline ? "bg-emerald-500" : "bg-red-500 animate-pulse")} />
                <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-none">{isOnline ? 'Online' : 'Offline'}</span>
              </div>
              <div className={cn("w-px h-3", theme === 'dark' ? "bg-white/10" : "bg-gray-200")} />
              <div className={cn("flex items-center gap-2 text-[9px] font-black font-mono tabular-nums leading-none tracking-widest", theme === 'dark' ? "text-white/90" : "text-gray-900")}>
                <Clock className="w-3 h-3 text-gray-500" />
                {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:{String(timerSeconds % 60).padStart(2, '0')}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className={cn(
                  "px-4 py-2 rounded-xl transition-all border outline-none font-black uppercase tracking-widest text-[9px]",
                  isTimerRunning 
                    ? (theme === 'dark' ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/20" : "bg-yellow-500 text-white border-yellow-500 shadow-lg shadow-yellow-500/20")
                    : (theme === 'dark' ? "bg-blue-600/10 border-blue-500/20 text-blue-500 hover:bg-blue-600/20" : "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20")
                )}
              >
                <div className="flex items-center gap-2">
                  {isTimerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span className="hidden xs:inline">{isTimerRunning ? 'Pausa' : 'Avvia'}</span>
                </div>
              </button>
              
              <div className={cn("h-6 w-px mx-1", theme === 'dark' ? "bg-white/5" : "bg-gray-100")} />

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className={cn(
                    "p-2.5 rounded-xl border transition-all outline-none",
                    theme === 'dark' ? "bg-white/[0.02] border-white/5 text-gray-500 hover:text-white" : "bg-gray-50 border-gray-100 text-gray-400 hover:text-gray-900"
                  )}
                  title={theme === 'dark' ? "Modalità Chiara" : "Modalità Scura"}
                >
                  {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                </button>
                <button 
                  onClick={() => setShowSquadModal(true)}
                  className={cn(
                    "p-2.5 rounded-xl border transition-all outline-none flex items-center gap-1.5 focus:outline-none",
                    theme === 'dark' ? "bg-white/[0.02] border-white/5 text-gray-500 hover:text-white" : "bg-gray-50 border-gray-100 text-gray-400 hover:text-gray-900"
                  )}
                  title="Scheda Squadra"
                >
                  <Users className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[9px] font-black uppercase tracking-wider hidden sm:inline">Roster</span>
                </button>
                <button 
                  onClick={() => setShowMatchList(true)}
                  className={cn(
                    "p-2.5 rounded-xl border transition-all outline-none",
                    theme === 'dark' ? "bg-white/[0.02] border-white/5 text-gray-500 hover:text-white" : "bg-gray-50 border-gray-100 text-gray-400 hover:text-gray-900"
                  )}
                  title="Le mie partite"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => user ? logout() : login()}
                  className={cn(
                    "p-2.5 rounded-xl border transition-all outline-none",
                    theme === 'dark' ? "bg-white/[0.02] border-white/5 text-gray-500 hover:text-white" : "bg-gray-50 border-gray-100 text-gray-400 hover:text-gray-900"
                  )}
                  title={user ? "Logout" : "Accedi"}
                >
                  {user ? <LogOut className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className={cn("hidden sm:block h-6 w-px mx-1", theme === 'dark' ? "bg-white/10" : "bg-gray-200")} />

            {activeTab === 'xg' && (
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex items-center rounded-xl p-1 border",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
                )}>
                  <button 
                    onClick={() => setShowHeatmap(!showHeatmap)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                      showHeatmap 
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                        : (theme === 'dark' ? "text-gray-400 hover:text-white" : "text-gray-400 hover:text-gray-600")
                    )}
                  >
                    <Flame className="w-3 h-3" />
                    <span className="hidden xs:inline">Heat Map</span>
                  </button>
                  <button 
                    onClick={() => setShowGridValues(!showGridValues)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                      showGridValues 
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                        : (theme === 'dark' ? "text-gray-400 hover:text-white" : "text-gray-400 hover:text-gray-600")
                    )}
                  >
                    <Hash className="w-3 h-3" />
                    <span className="hidden xs:inline">Grid</span>
                  </button>
                </div>

                {showHeatmap && (
                  <div className={cn(
                    "hidden lg:flex items-center gap-4 border rounded-xl px-3 py-1.5",
                    theme === 'dark' ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[7px] font-black text-gray-500 uppercase">Opacità</span>
                        <span className="text-[7px] font-bold text-blue-500">{Math.round(heatmapOpacity * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.1" 
                        value={heatmapOpacity}
                        onChange={(e) => setHeatmapOpacity(parseFloat(e.target.value))}
                        className="w-16 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                    <div className={cn("w-px h-6", theme === 'dark' ? "bg-white/10" : "bg-gray-200")} />
                    <div className="flex flex-col gap-1">
                      <span className="text-[7px] font-black text-gray-500 uppercase">Scala</span>
                      <div className="flex items-center gap-1">
                        {(['default', 'viridis', 'plasma', 'hot'] as const).map((scale) => (
                          <button
                            key={scale}
                            onClick={() => setHeatmapScale(scale)}
                            className={cn(
                              "w-3 h-3 rounded-full border transition-all",
                              theme === 'dark' ? "border-white/10" : "border-gray-200",
                              heatmapScale === scale ? "ring-2 ring-blue-500 scale-110" : "opacity-50 hover:opacity-100",
                              scale === 'default' && "bg-gradient-to-r from-green-500 via-yellow-500 to-red-500",
                              scale === 'viridis' && "bg-gradient-to-r from-[#440154] via-[#21908d] to-[#fde725]",
                              scale === 'plasma' && "bg-gradient-to-r from-[#0d0887] via-[#9c179e] to-[#f0f921]",
                              scale === 'hot' && "bg-gradient-to-r from-[#800000] via-[#ff0000] to-[#ffff00]"
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button 
                onClick={exportToExcel}
                className={cn(
                  "p-2.5 rounded-xl border transition-all outline-none",
                  theme === 'dark' ? "bg-emerald-600/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-600/20" : "bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100"
                )}
                title="Esporta Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </button>

              <button 
                onClick={() => setShowXGTuning(true)}
                className={cn(
                  "p-2.5 rounded-xl border transition-all outline-none",
                  theme === 'dark' ? "bg-white/[0.02] border-white/5 text-gray-500 hover:text-white" : "bg-gray-50 border-gray-100 text-gray-400 hover:text-gray-900"
                )}
                title="Personalizza Modello"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>

              {user && currentMatchId && !isReadOnly && (
                <button 
                  onClick={() => {
                    const url = `${window.location.origin}${window.location.pathname}?matchId=${currentMatchId}`;
                    navigator.clipboard.writeText(url);
                    setShowToast({ message: "Link di invito copiato!", type: 'success' });
                  }}
                  className={cn(
                    "p-2.5 rounded-xl border transition-all outline-none",
                    theme === 'dark' ? "bg-blue-600/10 border-blue-500/20 text-blue-400 hover:bg-blue-600/20" : "bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100"
                  )}
                  title="Invita Collaboratori"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              )}

              {user && !isReadOnly && (
                <button 
                  onClick={saveMatch}
                  disabled={isSaving}
                  className={cn(
                    "p-2.5 rounded-xl border transition-all outline-none",
                    isSaving 
                      ? "opacity-50 cursor-not-allowed" 
                      : (theme === 'dark' ? "bg-blue-600/10 border-blue-500/20 text-blue-500 hover:bg-blue-600/20" : "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20")
                  )}
                  title="Salva Partita"
                >
                  {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                </button>
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
              {[
                { 
                  label: 'Expected Goals', 
                  value: displayXG, 
                  icon: Target, 
                  color: 'blue', 
                  detail: 'xG', 
                  decimals: 2,
                  glow: 'rgba(59, 130, 246, 0.15)',
                  badgeClass: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
                  aux: (
                    <div className="mt-3 pt-3 border-t border-gray-500/10 flex items-center justify-between text-[9px] font-mono tracking-wider opacity-60">
                      <span>BUILDACTIVE RATIO</span>
                      <span>{(displayXG / Math.max(1, shots.length)).toFixed(2)} AVG</span>
                    </div>
                  )
                },
                { 
                  label: 'Gol Reali', 
                  value: displayGoals, 
                  icon: Trophy, 
                  color: 'yellow', 
                  detail: 'Gol', 
                  decimals: 0,
                  glow: 'rgba(234, 179, 8, 0.15)',
                  badgeClass: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
                  aux: (
                    <div className="mt-3 pt-3 border-t border-gray-500/10 flex items-center justify-between text-[9px] font-mono tracking-wider opacity-60">
                      <span>CONVERSINE RATE</span>
                      <span>{displayGoals > 0 && displayXG > 0 ? `${Math.round((displayGoals / displayXG) * 100)}%` : '0%'}</span>
                    </div>
                  )
                },
                { 
                  label: 'xG/Tiro', 
                  value: displayXGPerShot, 
                  icon: Activity, 
                  color: 'emerald', 
                  detail: 'Qualità', 
                  decimals: 2,
                  glow: 'rgba(16, 185, 129, 0.15)',
                  badgeClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
                  aux: (
                    <div className="mt-3 pt-3 border-t border-gray-500/10 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[9px] font-mono tracking-wider opacity-60">
                        <span>QUALITÀ TIRO</span>
                        <span>{displayXGPerShot > 0.15 ? 'ALTA' : displayXGPerShot > 0.08 ? 'MED' : 'BASSA'}</span>
                      </div>
                      <div className="h-1 w-full bg-gray-500/10 rounded-full overflow-hidden mt-1">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                          style={{ width: `${Math.min(100, displayXGPerShot * 400)}%` }} 
                        />
                      </div>
                    </div>
                  )
                },
                { 
                  label: 'Indice IPO', 
                  value: ipo, 
                  icon: Zap, 
                  color: 'indigo', 
                  detail: ipo >= ipoAway ? 'Dominio' : 'In Difesa', 
                  decimals: 1,
                  glow: 'rgba(99, 102, 241, 0.15)',
                  badgeClass: ipo >= ipoAway ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-red-500 bg-red-500/10 border-red-500/20',
                  aux: (
                    <div className="mt-3 pt-3 border-t border-gray-500/10 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[9px] font-mono tracking-wider opacity-60">
                        <span>GAP AVVERSARIO</span>
                        <span>{(ipo - ipoAway).toFixed(1)}</span>
                      </div>
                      <div className="h-1 w-full bg-gray-500/10 rounded-full overflow-hidden mt-1 flex">
                        <div 
                          className="h-full bg-indigo-500 transition-all duration-1000" 
                          style={{ width: `${(ipo / Math.max(1, ipo + ipoAway)) * 100}%` }} 
                        />
                        <div 
                          className="h-full bg-red-500 transition-all duration-1000" 
                          style={{ width: `${(ipoAway / Math.max(1, ipo + ipoAway)) * 100}%` }} 
                        />
                      </div>
                    </div>
                  )
                }
              ].map((stat, i) => (
                <motion.div 
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ 
                    y: -4, 
                    boxShadow: theme === 'dark' ? `0 15px 30px -10px ${stat.glow}` : '0 10px 25px -10px rgba(0,0,0,0.05)',
                    borderColor: theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' 
                  }}
                  className={cn(
                    "border rounded-[2rem] p-6 group transition-all duration-500 relative overflow-hidden",
                    theme === 'dark' 
                      ? "bg-white/[0.02] border-white/[0.05]" 
                      : "bg-white border-gray-100 shadow-sm"
                  )}
                >
                  {/* Subtle technical corner accents */}
                  <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-white/5 group-hover:border-white/20 transition-colors pointer-events-none" />
                  <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-white/5 group-hover:border-white/20 transition-colors pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-white/5 group-hover:border-white/20 transition-colors pointer-events-none" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-white/5 group-hover:border-white/20 transition-colors pointer-events-none" />

                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className={cn(
                      "w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500 border",
                      stat.color === 'blue' ? "bg-blue-500/10 border-blue-500/25 text-blue-500" :
                      stat.color === 'yellow' ? "bg-yellow-500/10 border-yellow-500/25 text-yellow-500" :
                      stat.color === 'emerald' ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-500" :
                      "bg-indigo-500/10 border-indigo-500/25 text-indigo-500"
                    )}>
                    <stat.icon className="w-5 h-5" />
                    </div>
                    {stat.label === 'Expected Goals' && (
                      <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-[7px] font-black text-blue-500 uppercase tracking-widest">Live Model</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 relative z-10">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{stat.label}</p>
                    <div className="flex items-baseline gap-2">
                      <span className={cn("text-4xl font-black tracking-tight leading-none tabular-nums", theme === 'dark' ? "text-white" : "text-gray-900")}>
                        <AnimatedCounter value={stat.value} decimals={stat.decimals} />
                      </span>
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-wider px-2 header-tag border rounded-md font-mono",
                        stat.badgeClass
                      )}>
                        {stat.detail}
                      </span>
                    </div>
                  </div>
                  {/* Auxiliary technical details */}
                  {stat.aux}

                  {/* Subtle pulsing background decoration */}
                  <div className={cn(
                    "absolute -right-4 -bottom-4 w-28 h-28 rounded-full blur-3xl opacity-0 group-hover:opacity-15 transition-opacity duration-1000",
                    stat.color === 'blue' ? "bg-blue-500" :
                    stat.color === 'yellow' ? "bg-yellow-500" :
                    stat.color === 'emerald' ? "bg-emerald-500" :
                    "bg-indigo-500"
                  )} />
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Pitch Area */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                <div className={cn(
                  "relative border rounded-[3rem] p-4 sm:p-6 lg:p-8 overflow-hidden group/field transition-colors",
                  theme === 'dark' ? "bg-white/[0.01] border-white/[0.03]" : "bg-white border-gray-100 shadow-sm"
                )}>
                  {/* Field Tools */}
                  <div className="absolute top-8 left-8 flex items-center gap-3 z-10 pointer-events-none">
                    <div className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 backdrop-blur-xl border rounded-full ring-1",
                      theme === 'dark' ? "bg-gray-950/80 border-white/5 ring-white/5" : "bg-white/80 border-gray-200 ring-gray-100 shadow-sm"
                    )}>
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      <span className={cn("text-[9px] font-black uppercase tracking-[0.2em]", theme === 'dark' ? "text-white" : "text-gray-900")}>Analisi Campo</span>
                    </div>
                  </div>

                  <div className="absolute top-8 right-8 flex items-center gap-2 z-20">
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => undoLastShot()}
                      disabled={shots.length === 0 || isReadOnly}
                      className={cn(
                        "p-2.5 rounded-xl border transition-all outline-none disabled:opacity-20",
                        theme === 'dark' ? "bg-gray-950/80 backdrop-blur-xl border-white/5 text-gray-400 hover:text-white" : "bg-white/80 backdrop-blur-xl border-gray-200 text-gray-400 hover:text-gray-900 shadow-sm"
                      )}
                    >
                      <Undo2 className="w-4 h-4" />
                    </motion.button>
                  </div>

                  {/* Pitch Canvas Styled */}
                  <div 
                    ref={pitchRef}
                    onClick={handlePitchClick}
                    className={cn(
                      "relative aspect-[34/17] w-full border rounded-[2rem] overflow-hidden cursor-crosshair transition-all duration-1000",
                      theme === 'dark' 
                        ? "bg-[#09090a] border-white/5 shadow-2xl" 
                        : "bg-gray-50 border-gray-200 shadow-md",
                      isTimerRunning ? "shadow-[0_0_80px_-20px_rgba(59,130,246,0.25)] ring-2 ring-blue-500/35" : ""
                    )}
                  >
                    {/* Minimal Markings */}
                    <svg className={cn("absolute inset-0 w-full h-full pointer-events-none transition-all", theme === 'dark' ? "text-white/30" : "text-blue-950/40")} viewBox="0 0 68 34">
                      <defs>
                        <pattern id="pitch-stripes" width="8" height="34" patternUnits="userSpaceOnUse">
                          <rect width="4" height="34" fill="currentColor" fillOpacity={theme === 'dark' ? "0.06" : "0.04"} />
                        </pattern>
                      </defs>
                      <rect x="0" y="0" width="68" height="34" fill="url(#pitch-stripes)" />
                      <rect x="0" y="0" width="68" height="34" fill="none" stroke="currentColor" strokeWidth="0.28" />
                      <rect x="13.84" y="0" width="40.32" height="16.5" fill="none" stroke="currentColor" strokeWidth="0.28" />
                      <rect x="24.84" y="0" width="18.32" height="5.5" fill="none" stroke="currentColor" strokeWidth="0.28" />
                      <circle cx="34" cy="11" r="0.3" fill="currentColor" />
                      <path d="M 27.5 16.5 A 9.15 9.15 0 0 0 40.5 16.5" fill="none" stroke="currentColor" strokeWidth="0.28" />
                      {/* Goalposts Highlight */}
                      <circle cx="30.34" cy="0" r="0.4" fill="currentColor" />
                      <circle cx="37.66" cy="0" r="0.4" fill="currentColor" />
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

                    {/* Selected Shot Trajectory Arc */}
                    {selectedShot && (
                      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 animate-fade-in" viewBox="0 0 68 34">
                        <defs>
                          <linearGradient id="shot-trajectory-grad" x1="0%" y1="100%" x2="0%" y2="0%">
                            <stop offset="0%" stopColor={selectedShot.isGoal ? "#facc15" : "#3b82f6"} stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity="1" />
                          </linearGradient>
                          <filter id="soft-glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur in="SourceGraphic" stdDeviation="0.4" />
                            <feMerge>
                              <feMergeNode />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        {/* Shadow curve */}
                        <path 
                          d={`M ${selectedShot.y} ${selectedShot.x} C ${selectedShot.y} ${selectedShot.x * 0.7}, 34 ${selectedShot.x * 0.3}, 34 0`}
                          fill="none"
                          stroke="black"
                          strokeOpacity="0.2"
                          strokeWidth="0.8"
                          className="blur-[1px]"
                        />
                        {/* Glow curve */}
                        <motion.path 
                          d={`M ${selectedShot.y} ${selectedShot.x} C ${selectedShot.y} ${selectedShot.x * 0.7}, 34 ${selectedShot.x * 0.3}, 34 0`}
                          fill="none"
                          stroke="url(#shot-trajectory-grad)"
                          strokeWidth="0.5"
                          filter="url(#soft-glow)"
                          strokeDasharray="1.5 1"
                          animate={{ strokeDashoffset: [0, -10] }}
                          transition={{ repeat: Infinity, ease: "linear", duration: 1.5 }}
                        />
                        {/* Solid path accent */}
                        <path 
                          d={`M ${selectedShot.y} ${selectedShot.x} C ${selectedShot.y} ${selectedShot.x * 0.7}, 34 ${selectedShot.x * 0.3}, 34 0`}
                          fill="none"
                          stroke={selectedShot.isGoal ? "#facc15" : "#60a5fa"}
                          strokeWidth="0.2"
                          strokeOpacity="0.6"
                        />
                        {/* Goal impact pulse */}
                        <circle cx="34" cy="0" r="1.5" fill={selectedShot.isGoal ? "#facc15" : "#ef4444"} className="animate-ping" fillOpacity="0.4" />
                        <circle cx="34" cy="0" r="0.6" fill={selectedShot.isGoal ? "#facc15" : "#ef4444"} />
                      </svg>
                    )}

                    {/* Selected Shot Laser Targeting Guides & Radar Pulse */}
                    {selectedShot && (
                      <div className="absolute inset-0 pointer-events-none z-10">
                        {/* Horizontal dashed targeting line */}
                        <div 
                          className="absolute left-0 right-0 border-t border-dashed border-blue-500/40" 
                          style={{ top: `${(selectedShot.x / DEFAULT_PITCH.height) * 100}%` }}
                        />
                        {/* Vertical dashed targeting line */}
                        <div 
                          className="absolute top-0 bottom-0 border-l border-dashed border-blue-500/40" 
                          style={{ left: `${(selectedShot.y / DEFAULT_PITCH.width) * 100}%` }}
                        />
                        {/* Radar Range Rings */}
                        <div 
                          className="absolute w-12 h-12 -ml-6 -mt-6 border border-blue-500/20 rounded-full animate-ping opacity-75"
                          style={{ 
                            top: `${(selectedShot.x / DEFAULT_PITCH.height) * 100}%`, 
                            left: `${(selectedShot.y / DEFAULT_PITCH.width) * 100}%` 
                          }}
                        />
                        <div 
                          className="absolute w-8 h-8 -ml-4 -mt-4 border border-dashed border-blue-500/60 rounded-full animate-[spin_10s_linear_infinite]"
                          style={{ 
                            top: `${(selectedShot.x / DEFAULT_PITCH.height) * 100}%`, 
                            left: `${(selectedShot.y / DEFAULT_PITCH.width) * 100}%` 
                          }}
                        />
                        {/* Interactive Coordinate Indicator */}
                        <div 
                          className="absolute flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-950/90 text-white border border-white/10 text-[7px] font-mono shadow-2xl"
                          style={{ 
                            top: `${Math.min(92, (selectedShot.x / DEFAULT_PITCH.height) * 100 + 4)}%`, 
                            left: `${Math.min(88, (selectedShot.y / DEFAULT_PITCH.width) * 100 + 3)}%` 
                          }}
                        >
                          <span>X:{(selectedShot.x).toFixed(1)}</span>
                          <span className="opacity-40">|</span>
                          <span>Y:{(selectedShot.y).toFixed(1)}</span>
                        </div>
                      </div>
                    )}

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
                          selectedShot?.id === shot.id ? "ring-blue-500 ring-2 ring-offset-2 ring-offset-black z-50 scale-125" : ""
                        )}
                        style={{ 
                          top: `${(shot.x / DEFAULT_PITCH.height) * 100}%`, 
                          left: `${(shot.y / DEFAULT_PITCH.width) * 100}%` 
                        }}
                      >
                        {shot.isGoal ? (
                          <Trophy className="w-1.5 h-1.5 text-black" />
                        ) : (
                          <div className="w-1.5 h-1.5 bg-black/60 rounded-full" />
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

                    {/* Selected Shot HUD Badge */}
                    <AnimatePresence>
                      {selectedShot && (
                        <motion.div
                          initial={{ opacity: 0, x: -15, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={cn(
                            "absolute bottom-4 left-4 z-40 w-52 border rounded-2xl p-4 backdrop-blur-md shadow-2xl flex flex-col gap-2 transition-colors pointer-events-auto",
                            theme === 'dark' ? "bg-gray-950/85 border-white/10 text-white" : "bg-white/95 border-gray-200/80 text-gray-900"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Dettaglio Tiro</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedShot(null);
                              }}
                              className="text-gray-400 hover:text-white transition-colors p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          
                          <div className="flex items-center gap-2.5">
                            <div className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center border shrink-0",
                              selectedShot.isGoal ? "bg-yellow-400/10 border-yellow-400/25 text-yellow-500" : "bg-blue-500/10 border-blue-500/25 text-blue-500"
                            )}>
                              {selectedShot.isGoal ? <Trophy className="w-3.5 h-3.5" /> : <Target className="w-3.5 h-3.5" />}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] font-black uppercase leading-none truncate">{selectedShot.playerName || "Giocatore"}</span>
                              <span className="text-[7px] text-gray-500 font-bold uppercase tracking-wider mt-1">Minuto {selectedShot.minute || 0}'</span>
                            </div>
                          </div>

                          <div className={cn("h-px", theme === 'dark' ? "bg-white/5" : "bg-gray-200")} />

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[7px] text-gray-500 font-bold uppercase tracking-widest block mb-0.5">Probabilità xG</span>
                              <span className="text-xs font-black text-blue-500">{selectedShot.xg ? selectedShot.xg.toFixed(3) : '0.000'}</span>
                            </div>
                            <div>
                              <span className="text-[7px] text-gray-500 font-bold uppercase tracking-widest block mb-0.5">Strike style</span>
                              <span className="text-[10px] font-bold uppercase tracking-tight truncate">{selectedShot.bodyPart === 'head' ? 'Testa' : 'Piede'}</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
                <section className={cn(
                  "border rounded-[2.5rem] p-7 transition-all duration-300 relative overflow-hidden",
                  theme === 'dark' 
                    ? "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]" 
                    : "bg-white border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200"
                )}>
                  {/* Background fine technical grids */}
                  <div className="absolute top-0 right-0 w-20 h-20 border-b border-l border-gray-500/5 pointer-events-none" />

                  <div className="flex items-center gap-4 mb-8 relative z-10">
                    <div className={cn(
                      "w-11 h-11 border rounded-2xl flex items-center justify-center transition-transform duration-500 shadow-inner",
                      theme === 'dark' 
                        ? "bg-white/[0.03] border-white/5 text-blue-400" 
                        : "bg-gray-50 border-gray-200 text-blue-600"
                    )}>
                      {selectedShot ? <Settings className="w-5 h-5 animate-spin-slow" /> : <Plus className="w-5 h-5 text-gray-400" />}
                    </div>
                    <div>
                      <h3 className={cn("text-xs font-black uppercase tracking-wider", theme === 'dark' ? "text-white" : "text-gray-900")}>
                        {selectedShot ? 'Modifica Evento' : 'Registra Tiro'}
                      </h3>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">Dati real-time</p>
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
                          className={cn(
                            "w-full border rounded-2xl py-4 px-6 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none",
                            theme === 'dark' ? "bg-[#0d0d0e] border-white/5 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                          )}
                        >
                          <option value="">Seleziona...</option>
                          {playerList.map(pName => {
                            const pObj = squadPlayers.find(sp => sp.name.toUpperCase() === pName.toUpperCase());
                            const displayLabel = pObj 
                              ? `${pObj.name}${pObj.role ? ` - ${pObj.role}` : ''}`
                              : pName;
                            return <option key={pName} value={pName}>{displayLabel}</option>;
                          })}
                          <option value="ADD_NEW">+ Aggiungi Nuovo...</option>
                        </select>
                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Parte Corpo</label>
                        <div className={cn(
                          "flex p-1 rounded-2xl border transition-colors",
                          theme === 'dark' ? "bg-[#0d0d0e] border-white/5" : "bg-gray-100 border-gray-200"
                        )}>
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
                                  ? (theme === 'dark' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-white text-blue-600 shadow-sm font-black") 
                                  : "text-gray-500 hover:text-gray-400"
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
                              : (theme === 'dark' ? "bg-[#0d0d0e] border-white/5 text-gray-600 hover:border-white/10" : "bg-gray-100 border-gray-200 text-gray-500 hover:border-gray-300")
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
                             className={cn(
                               "w-full py-4 border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                               theme === 'dark' ? "bg-red-500/5 hover:bg-red-500/10 text-red-500 border-red-500/20" : "bg-red-50 hover:bg-red-100 text-red-600 border-red-100"
                             )}
                           >
                             Elimina Tiro
                           </button>
                           <button 
                             onClick={() => setSelectedShot(null)}
                             className={cn(
                               "w-full py-4 border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                               theme === 'dark' ? "bg-white/5 hover:bg-white/10 text-gray-400 border-white/10" : "bg-gray-50 hover:bg-gray-100 text-gray-500 border-gray-100"
                             )}
                           >
                             Chiudi Modifica
                           </button>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={saveMatch} 
                          disabled={isSaving || isReadOnly} 
                          className={cn(
                            "flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-30",
                            theme === 'dark' ? "bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-500/10" : "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                          )}
                        >
                          <Save className="w-3.5 h-3.5" /> Salva
                        </button>
                        <button 
                          onClick={exportToExcel} 
                          className={cn(
                            "flex-1 py-4 border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                            theme === 'dark' ? "bg-white/5 hover:bg-white/10 text-white border-white/5" : "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-100"
                          )}
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" /> Export
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Event Feed Bento Card */}
                <div className={cn(
                  "border rounded-[2.5rem] p-7 h-[300px] flex flex-col transition-colors",
                  theme === 'dark' ? "bg-white/[0.02] border-white/[0.05]" : "bg-white border-gray-100 shadow-sm"
                )}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Live Feed</h3>
                    <div className="px-2 py-1 bg-blue-500/10 rounded-lg text-[8px] font-black text-blue-500">{matchEvents.length} EVENTI</div>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
                    {matchEvents.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-40">
                        <Activity className="w-10 h-10 mb-4 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">In attesa di eventi...</span>
                      </div>
                    ) : (
                      matchEvents.map(event => (
                        <div key={event.id} className={cn(
                          "flex gap-4 p-4 border rounded-[1.5rem] group transition-all duration-300",
                          theme === 'dark' ? "bg-white/[0.02] border-white/[0.03] hover:bg-white/[0.04] hover:border-white/10" : "bg-gray-50/50 border-gray-100 hover:bg-white hover:border-gray-200 hover:shadow-sm"
                        )}>
                          <div className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                            event.type === 'goal' ? 'bg-yellow-500/10 text-yellow-500' : 
                            event.type === 'shot' ? 'bg-blue-600/10 text-blue-500' :
                            'bg-gray-500/10 text-gray-400'
                          )}>
                            {event.type === 'goal' ? <Trophy className="w-5 h-5" /> : 
                             event.type === 'shot' ? <Target className="w-5 h-5" /> : 
                             <Zap className="w-5 h-5" />}
                          </div>
                          <div className="flex-1">
                            <p className={cn("text-xs font-black leading-tight", theme === 'dark' ? "text-white" : "text-gray-900")}>{event.description}</p>
                            <div className="flex items-center gap-2 mt-1.5 focus:outline-none">
                              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest bg-gray-500/5 px-2 py-0.5 rounded-full">Minuto {event.minute}'</span>
                              {event.value && <span className="text-[9px] font-bold text-blue-500/80 uppercase">+{event.value.toFixed(2)} xG</span>}
                            </div>
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
            theme={theme}
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
              className={cn(
                "relative w-full max-w-md border rounded-3xl shadow-2xl overflow-hidden",
                theme === 'dark' ? "bg-[#121212] border-white/10" : "bg-white border-gray-100"
              )}
            >
              <div className={cn(
                "p-6 border-b flex items-center justify-between",
                theme === 'dark' ? "border-white/10" : "border-gray-100"
              )}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center">
                    <Settings className="text-blue-500 w-5 h-5" />
                  </div>
                  <div>
                    <h2 className={cn("text-lg font-black", theme === 'dark' ? "text-white" : "text-gray-900")}>Impostazioni Partita</h2>
                    <p className="text-xs text-gray-500 font-medium">Configura le squadre</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowMatchSettings(false)}
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                    theme === 'dark' ? "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900"
                  )}
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
                      className={cn(
                        "w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                        theme === 'dark' ? "bg-black/40 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                      )}
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

                <div className={cn("h-px", theme === 'dark' ? "bg-white/5" : "bg-gray-100")} />

                {/* Away Team */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Squadra Ospite</h3>
                  <div className="space-y-3">
                    <input 
                      type="text"
                      value={awayTeam}
                      onChange={(e) => setAwayTeam(e.target.value)}
                      placeholder="Nome Squadra Ospite"
                      className={cn(
                        "w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                        theme === 'dark' ? "bg-black/40 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                      )}
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

                <div className={cn("h-px", theme === 'dark' ? "bg-white/5" : "bg-gray-100")} />

                {/* Offline Guide */}
                <div className={cn(
                  "border rounded-2xl p-4 space-y-2",
                  theme === 'dark' ? "bg-blue-600/10 border-blue-500/20" : "bg-blue-50 border-blue-100"
                )}>
                  <div className="flex items-center gap-2 text-blue-500">
                    <Shield className="w-4 h-4" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest">Guida Offline</h3>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
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
              className={cn(
                "relative w-full max-w-md border rounded-3xl shadow-2xl overflow-hidden",
                theme === 'dark' ? "bg-[#121212] border-white/10" : "bg-white border-gray-100"
              )}
            >
              <div className={cn(
                "p-6 border-b flex items-center justify-between",
                theme === 'dark' ? "border-white/10" : "border-gray-100"
              )}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600/10 rounded-xl flex items-center justify-center">
                    <Activity className="text-emerald-500 w-5 h-5" />
                  </div>
                  <div>
                    <h2 className={cn("text-lg font-black", theme === 'dark' ? "text-white" : "text-gray-900")}>Modello xG</h2>
                    <p className="text-xs text-gray-500 font-medium">Personalizza i coefficienti del calcolo</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowXGTuning(false)}
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                    theme === 'dark' ? "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900"
                  )}
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
                      className={cn(
                        "w-full border rounded-xl px-3 py-2 text-sm outline-none transition-all",
                        theme === 'dark' ? "bg-black/40 border-white/10 text-white focus:ring-1 focus:ring-emerald-500/50" : "bg-gray-50 border-gray-200 text-gray-900 focus:ring-1 focus:ring-emerald-500/50"
                      )}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase">Bonus Passaggio</label>
                    <input 
                      type="number" step="0.1"
                      value={xgCoeffs.beta4Pass}
                      onChange={(e) => setXgCoeffs(prev => ({ ...prev, beta4Pass: parseFloat(e.target.value) }))}
                      className={cn(
                        "w-full border rounded-xl px-3 py-2 text-sm outline-none transition-all",
                        theme === 'dark' ? "bg-black/40 border-white/10 text-white focus:ring-1 focus:ring-emerald-500/50" : "bg-gray-50 border-gray-200 text-gray-900 focus:ring-1 focus:ring-emerald-500/50"
                      )}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase">Bonus Cross</label>
                    <input 
                      type="number" step="0.1"
                      value={xgCoeffs.beta4Cross}
                      onChange={(e) => setXgCoeffs(prev => ({ ...prev, beta4Cross: parseFloat(e.target.value) }))}
                      className={cn(
                        "w-full border rounded-xl px-3 py-2 text-sm outline-none transition-all",
                        theme === 'dark' ? "bg-black/40 border-white/10 text-white focus:ring-1 focus:ring-emerald-500/50" : "bg-gray-50 border-gray-200 text-gray-900 focus:ring-1 focus:ring-emerald-500/50"
                      )}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase">Bonus Ribattuta</label>
                    <input 
                      type="number" step="0.1"
                      value={xgCoeffs.beta4Rebound}
                      onChange={(e) => setXgCoeffs(prev => ({ ...prev, beta4Rebound: parseFloat(e.target.value) }))}
                      className={cn(
                        "w-full border rounded-xl px-3 py-2 text-sm outline-none transition-all",
                        theme === 'dark' ? "bg-black/40 border-white/10 text-white focus:ring-1 focus:ring-emerald-500/50" : "bg-gray-50 border-gray-200 text-gray-900 focus:ring-1 focus:ring-emerald-500/50"
                      )}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setXgCoeffs(DEFAULT_XG_COEFFICIENTS)}
                    className={cn(
                      "flex-1 py-3 font-black rounded-xl transition-all uppercase tracking-widest text-[10px]",
                      theme === 'dark' ? "bg-white/5 hover:bg-white/10 text-gray-400" : "bg-gray-100 hover:bg-gray-200 text-gray-500"
                    )}
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

      {/* Quick Add Player Modal */}
      <AnimatePresence>
        {isAddingNewPlayer && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddingNewPlayer(false);
                if (!selectedShot) setNewShotConfig(prev => ({ ...prev, playerName: '' }));
              }}
              className="absolute inset-0 bg-[#070708]/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className={cn(
                "relative w-full max-w-sm border rounded-[2rem] p-6 shadow-2xl flex flex-col gap-5",
                theme === 'dark' ? "bg-[#0d0d0e] border-white/5 text-white" : "bg-white border-gray-150 text-gray-900"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-wider">Aggiungi Giocatore</h3>
                </div>
                <button 
                  onClick={() => {
                    setIsAddingNewPlayer(false);
                    if (!selectedShot) setNewShotConfig(prev => ({ ...prev, playerName: '' }));
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const nameInput = (formData.get('playerName') as string || '').trim().toUpperCase();
                if (!nameInput) return;
                      const newP: Player = {
                  id: `p-custom-${Math.random().toString(36).substr(2, 9)}`,
                  name: nameInput,
                  role: (formData.get('playerRole') || 'Centrocampista') as any,
                  preferredFoot: (formData.get('playerFoot') || 'Destro') as any,
                  active: true
                };

                setSquadPlayers(prev => [...prev, newP]);
                if (selectedShot) {
                  updateShot(selectedShot.id, { playerName: nameInput });
                } else {
                  setNewShotConfig(prev => ({ ...prev, playerName: nameInput }));
                }
                setIsAddingNewPlayer(false);
                setShowToast({ message: `Giocatore ${nameInput} inserito!`, type: 'success' });
              }} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block font-sans">Nome e Cognome</label>
                  <input 
                    name="playerName"
                    autoFocus
                    required
                    placeholder="Es. MARTINEZ"
                    className={cn(
                      "w-full border rounded-xl py-3 px-4 text-xs font-bold uppercase placeholder:lowercase focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all",
                      theme === 'dark' ? "bg-white/[0.02] border-white/5 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block font-sans">Piede Preferito</label>
                  <select 
                    name="playerFoot"
                    className={cn(
                      "w-full border rounded-xl py-3 px-4 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none",
                      theme === 'dark' ? "bg-white/[0.02] border-white/5 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                    )}
                  >
                    <option value="Destro">Destro</option>
                    <option value="Sinistro">Sinistro</option>
                    <option value="Entrambi">Entrambi</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block font-sans">Ruolo</label>
                  <select 
                    name="playerRole"
                    className={cn(
                      "w-full border rounded-xl py-3 px-4 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none",
                      theme === 'dark' ? "bg-white/[0.02] border-white/5 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                    )}
                  >
                    <option value="Attaccante">Attaccante</option>
                    <option value="Centrocampista">Centrocampista</option>
                    <option value="Difensore">Difensore</option>
                    <option value="Portiere">Portiere</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full mt-4 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Conferma e Seleziona
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Scheda Squadra / Roster Management Modal */}
      <AnimatePresence>
        {showSquadModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowSquadModal(false);
                setEditingPlayer(null);
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "relative w-full max-w-5xl border rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]",
                theme === 'dark' ? "bg-[#0d0d0e] border-white/[0.05]" : "bg-white border-gray-150"
              )}
            >
              {/* Modal Head */}
              <div className={cn(
                "p-6 sm:p-8 border-b flex items-center justify-between shrink-0",
                theme === 'dark' ? "border-white/[0.03]" : "border-gray-100"
              )}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className={cn("text-base sm:text-lg font-black uppercase tracking-tight", theme === 'dark' ? "text-white" : "text-gray-900")}>Scheda Squadra & Roster</h2>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">Gestione e Anagrafica dei Giocatori</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowSquadModal(false);
                    setEditingPlayer(null);
                  }}
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all outline-none",
                    theme === 'dark' ? "bg-white/[0.03] hover:bg-white/[0.06] text-gray-500 hover:text-white" : "bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                  )}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Roster Quick Stats Ribbons */}
              <div className={cn(
                "px-6 py-4 border-b grid grid-cols-2 md:grid-cols-5 gap-4 shrink-0 overflow-x-auto",
                theme === 'dark' ? "bg-[#070708]/40 border-white/[0.03] text-gray-400" : "bg-gray-50/50 border-gray-100 text-gray-600"
              )}>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">Totale Atleti</span>
                  <span className={cn("text-sm font-black mt-1", theme === 'dark' ? "text-white" : "text-gray-900")}>{squadPlayers.length} Giocatori</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Attivi (in campo)</span>
                  <span className="text-sm font-black text-emerald-500 mt-1">{squadPlayers.filter(p => p.active).length} Selezionabili</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest text-red-400">Attaccanti</span>
                  <span className={cn("text-sm font-semibold mt-1", theme === 'dark' ? "text-white/80" : "text-gray-800")}>{squadPlayers.filter(p => p.role === 'Attaccante').length}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest text-blue-400">Centrocampisti</span>
                  <span className={cn("text-sm font-semibold mt-1", theme === 'dark' ? "text-white/80" : "text-gray-800")}>{squadPlayers.filter(p => p.role === 'Centrocampista').length}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest text-yellow-500">Difensori / GK</span>
                  <span className={cn("text-sm font-semibold mt-1", theme === 'dark' ? "text-white/80" : "text-gray-800")}>
                    {squadPlayers.filter(p => p.role === 'Difensore').length} D • {squadPlayers.filter(p => p.role === 'Portiere').length} P
                  </span>
                </div>
              </div>

              {/* LA CARTELLA DELLA SQUADRA / TEAM FOLDER PROFILE MANAGEMENT */}
              <div className={cn(
                "px-6 py-4.5 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0",
                theme === 'dark' ? "bg-[#070708]/30 border-white/[0.03]" : "bg-gray-50/50 border-gray-100"
              )}>
                {/* Left side: switch folder */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className={cn("text-[9px] font-black uppercase tracking-widest block font-sans whitespace-nowrap", theme === 'dark' ? "text-gray-400" : "text-gray-500")}>
                      Cartella Squadra Attiva:
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={activeFolderId}
                      onChange={(e) => setActiveFolderId(e.target.value)}
                      className={cn(
                        "border rounded-xl py-2 px-3 text-xs font-black uppercase tracking-tight focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all",
                        theme === 'dark' ? "bg-black/60 border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                      )}
                    >
                      {teamFolders.map(folder => (
                        <option key={folder.id} value={folder.id}>
                          📁 {folder.name} ({folder.players.length} Atleti)
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        const current = teamFolders.find(f => f.id === activeFolderId);
                        if (!current) return;
                        const newName = prompt("Rinomina la cartella della squadra:", current.name);
                        if (newName && newName.trim()) {
                          const parsedName = newName.trim().toUpperCase();
                          setTeamFolders(prev => prev.map(f => f.id === activeFolderId ? { ...f, name: parsedName } : f));
                          setShowToast({ message: `Cartella rinominata in "${parsedName}"!`, type: 'success' });
                        }
                      }}
                      className={cn(
                        "px-3 py-2 border rounded-xl text-[8px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                        theme === 'dark' ? "bg-white/5 hover:bg-white/10 text-gray-300 border-white/10" : "bg-white hover:bg-gray-100 text-gray-600 border-gray-200"
                      )}
                    >
                      Rinomina
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (teamFolders.length <= 1) {
                          setShowToast({ message: "Impossibile eliminare l'unica cartella del roster!", type: 'error' });
                          return;
                        }
                        const current = teamFolders.find(f => f.id === activeFolderId);
                        if (!current) return;
                        if (confirm(`Sei sicuro di voler eliminare permanentemente la cartella della squadra "${current.name}" e tutti i suoi giocatori? L'azione è irreversibile.`)) {
                          const remaining = teamFolders.filter(f => f.id !== activeFolderId);
                          setTeamFolders(remaining);
                          setActiveFolderId(remaining[0].id);
                          setShowToast({ message: "Cartella della squadra eliminata", type: 'success' });
                        }
                      }}
                      className={cn(
                        "px-3 py-2 border rounded-xl text-[8px] font-black uppercase tracking-wider transition-all hover:bg-red-500/10 hover:text-red-400 whitespace-nowrap",
                        theme === 'dark' ? "bg-white/5 text-gray-400 border-white/10" : "bg-white text-gray-500 border-gray-200"
                      )}
                    >
                      Elimina
                    </button>
                  </div>
                </div>

                {/* Right side: quick create or import/export file */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Create Custom Folder */}
                  <div className="flex items-center gap-2">
                    <input 
                      type="text"
                      placeholder="NOME NUOVA CARTELLA..."
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className={cn(
                        "border rounded-xl py-2 px-3 text-[10px] font-bold uppercase placeholder:font-medium placeholder:lowercase focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all w-44",
                        theme === 'dark' ? "bg-black/40 border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const name = newFolderName.trim().toUpperCase();
                        if (!name) {
                          setShowToast({ message: "Digita un nome per la nuova cartella!", type: 'error' });
                          return;
                        }
                        const newId = `folder-${Date.now()}`;
                        const newFolder = {
                          id: newId,
                          name,
                          players: [] // fully customizable blank roster!
                        };
                        setTeamFolders(prev => [...prev, newFolder]);
                        setActiveFolderId(newId);
                        setNewFolderName('');
                        setShowToast({ message: `Cartella vuota "${name}" creata! Aggiungi i tuoi atleti.`, type: 'success' });
                      }}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[8px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-blue-500/15"
                    >
                      + Crea Cartella
                    </button>
                  </div>

                  {/* Divider */}
                  <span className="w-[1px] h-5 bg-white/10 hidden sm:block" />

                  {/* Export / Import actions binder */}
                  <div className="flex items-center gap-2">
                    {/* Export Roster Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const current = teamFolders.find(f => f.id === activeFolderId);
                        if (!current) return;
                        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(current));
                        const downloadAnchor = document.createElement('a');
                        downloadAnchor.setAttribute("href", dataStr);
                        downloadAnchor.setAttribute("download", `${current.name.toLowerCase().replace(/\s+/g, '_')}_cartella_roster.json`);
                        document.body.appendChild(downloadAnchor);
                        downloadAnchor.click();
                        downloadAnchor.remove();
                        setShowToast({ message: "Cartella roster esportata in file con successo!", type: 'success' });
                      }}
                      title="Salva file roster (.json)"
                      className={cn(
                        "px-3.5 py-2 border rounded-xl text-[8px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5",
                        theme === 'dark' ? "bg-white/5 hover:bg-white/10 text-emerald-400 border-white/10" : "bg-white hover:bg-emerald-50 text-emerald-650 border-gray-200"
                      )}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Esporta File
                    </button>

                    {/* Import Roster File Form */}
                    <label className={cn(
                      "px-3.5 py-2 border rounded-xl text-[8px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                      theme === 'dark' ? "bg-white/5 hover:bg-white/10 text-amber-400 border-white/10" : "bg-white hover:bg-amber-50 text-amber-650 border-gray-200"
                    )}>
                      <Upload className="w-3.5 h-3.5" />
                      Importa File
                      <input 
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            try {
                              const parsed = JSON.parse(event.target?.result as string);
                              if (parsed && typeof parsed === 'object') {
                                const players = parsed.players || parsed;
                                if (Array.isArray(players) || (parsed && Array.isArray((parsed as any).players))) {
                                  const targetPlayersList = Array.isArray(players) ? players : (parsed.players || []);
                                  const sanitizedPlayers: Player[] = targetPlayersList.map((p: any, idx: number) => ({
                                    id: p.id || `p-imp-${idx}-${Math.random().toString(36).substr(2, 5)}`,
                                    name: (p.name || 'Senza Nome').toUpperCase(),
                                    role: p.role || 'Centrocampista',
                                    preferredFoot: p.preferredFoot || 'Destro',
                                    active: p.active !== undefined ? p.active : true
                                  }));
                                  const folderName = (parsed.name || `ROSTER FILE ${new Date().toLocaleDateString()}`).toUpperCase();
                                  const newId = `folder-import-${Date.now()}`;
                                  setTeamFolders(prev => [
                                    ...prev.filter(f => f.name !== folderName),
                                    { id: newId, name: folderName, players: sanitizedPlayers }
                                  ]);
                                  setActiveFolderId(newId);
                                  setShowToast({ message: `Cartella roster "${folderName}" caricata con successo!`, type: 'success' });
                                } else {
                                  throw new Error("I dati dei giocatori non sono in un formato valido.");
                                }
                              }
                            } catch (err: any) {
                              setShowToast({ message: `Errore caricamento: formato non valido`, type: 'error' });
                            }
                          };
                          reader.readAsText(file);
                          e.target.value = ''; // clean input
                        }}
                        className="hidden"
                      />
                    </label>

                    {/* Clear all in current directory button */}
                    <button
                      type="button"
                      onClick={() => {
                        const current = teamFolders.find(f => f.id === activeFolderId);
                        if (!current) return;
                        if (confirm(`Sei sicuro di voler svuotare completamente la cartella "${current.name}"? Tutti i giocatori verranno rimossi e potrai iniziare da zero.`)) {
                          setSquadPlayers([]);
                          setShowToast({ message: `Cartella "${current.name}" svuotata completamente!`, type: 'success' });
                        }
                      }}
                      className={cn(
                        "px-3.5 py-2 border rounded-xl text-[8px] font-black uppercase tracking-wider transition-all hover:bg-red-500/15 hover:text-red-400",
                        theme === 'dark' ? "bg-white/5 text-gray-500 border-white/10" : "bg-white text-gray-400 border-gray-200"
                      )}
                      title="Svuota completamente i giocatori da questa cartella"
                    >
                      Svuota Cartella
                    </button>
                  </div>
                </div>
              </div>

              {/* Bento Content Panels */}
              <div className="p-6 sm:p-8 flex-1 overflow-y-auto no-scrollbar grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Panel 1: Player Creator/Editor (5 cols) */}
                <div className="md:col-span-5 flex flex-col gap-6">
                  <div className={cn(
                    "border rounded-3xl p-6 relative overflow-hidden",
                    theme === 'dark' ? "bg-white/[0.01] border-white/5" : "bg-gray-50 border-gray-150"
                  )}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black",
                        editingPlayer ? "bg-yellow-500/10 text-yellow-500" : "bg-blue-500/10 text-blue-500"
                      )}>
                        {editingPlayer ? '✎' : '+'}
                      </div>
                      <h3 className={cn("text-xs font-black uppercase tracking-wider", theme === 'dark' ? "text-white" : "text-gray-900")}>
                        {editingPlayer ? 'Modifica Atleta' : 'Aggiungi Atleta'}
                      </h3>
                    </div>

                    <form 
                      key={editingPlayer ? editingPlayer.id : 'new-player'}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const name = (formData.get('playerName') as string || '').trim().toUpperCase();
                        if (!name) {
                          setShowToast({ message: "Il nome non può essere vuoto", type: 'error' });
                          return;
                        }

                        const role = formData.get('playerRole') as any;
                        const preferredFoot = formData.get('playerFoot') as any;
                        const active = formData.get('playerActive') === 'true';

                        if (editingPlayer) {
                          setSquadPlayers(prev => prev.map(p => p.id === editingPlayer.id ? {
                            ...p, name, role, preferredFoot, active
                          } : p));
                          setEditingPlayer(null);
                          setShowToast({ message: `Giocatore ${name} aggiornato!`, type: 'success' });
                        } else {
                          const newP: Player = {
                            id: `p-${Date.now()}`,
                            name, role, preferredFoot, active
                          };
                          setSquadPlayers(prev => [...prev, newP]);
                          setShowToast({ message: `Atleta ${name} aggiunto al roster!`, type: 'success' });
                        }
                        e.currentTarget.reset();
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest block font-sans">Nome e Cognome</label>
                        <input 
                          name="playerName"
                          required
                          defaultValue={editingPlayer ? editingPlayer.name : ''}
                          placeholder="Es. COPPOLA"
                          className={cn(
                            "w-full border rounded-xl py-3 px-4 text-xs font-bold uppercase placeholder:lowercase focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all",
                            theme === 'dark' ? "bg-black/40 border-white/5 text-white" : "bg-white border-gray-200 text-gray-900"
                          )}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest block font-sans">Piede Preferito</label>
                        <select 
                          name="playerFoot"
                          defaultValue={editingPlayer ? editingPlayer.preferredFoot : 'Destro'}
                          className={cn(
                            "w-full border rounded-xl py-3 px-4 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none",
                            theme === 'dark' ? "bg-black/40 border-white/5 text-white" : "bg-white border-gray-200 text-gray-900"
                          )}
                        >
                          <option value="Destro">Destro</option>
                          <option value="Sinistro">Sinistro</option>
                          <option value="Entrambi">Entrambi</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest block font-sans">Ruolo Principale</label>
                        <select 
                          name="playerRole"
                          defaultValue={editingPlayer ? editingPlayer.role : 'Centrocampista'}
                          className={cn(
                            "w-full border rounded-xl py-3 px-4 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none",
                            theme === 'dark' ? "bg-black/40 border-white/5 text-white" : "bg-white border-gray-200 text-gray-900"
                          )}
                        >
                          <option value="Attaccante">Attaccante</option>
                          <option value="Centrocampista">Centrocampista</option>
                          <option value="Difensore">Difensore</option>
                          <option value="Portiere">Portiere</option>
                          <option value="Nessuno">Nessuno</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest block font-sans">Status Attivo</label>
                        <select 
                          name="playerActive"
                          defaultValue={editingPlayer ? (editingPlayer.active ? 'true' : 'false') : 'true'}
                          className={cn(
                            "w-full border rounded-xl py-3 px-4 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none",
                            theme === 'dark' ? "bg-black/40 border-white/5 text-white" : "bg-white border-gray-200 text-gray-900"
                          )}
                        >
                          <option value="true">Attivo (Disponibile in partita)</option>
                          <option value="false">Inattivo (Nascosto)</option>
                        </select>
                      </div>

                      <div className="flex gap-2 pt-2">
                        {editingPlayer && (
                          <button
                            type="button"
                            onClick={() => setEditingPlayer(null)}
                            className={cn(
                              "flex-1 py-3.5 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                              theme === 'dark' ? "bg-white/5 hover:bg-white/10 text-gray-400 border-white/10" : "bg-gray-105 hover:bg-gray-200 text-gray-600 border-gray-200"
                            )}
                          >
                            Annulla
                          </button>
                        )}
                        <button
                          type="submit"
                          className={cn(
                            "flex-[2] py-3.5 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            editingPlayer ? "bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg shadow-yellow-500/10" : "bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/10"
                          )}
                        >
                          {editingPlayer ? 'Salva Modifiche' : 'Salva Atleta'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Panel 2: Player List and Filtering (7 cols) */}
                <div className="md:col-span-7 flex flex-col gap-5">
                  {/* Tool bar */}
                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-between shrink-0">
                    {/* Search Field */}
                    <div className="relative w-full sm:w-64">
                      <input 
                        type="text"
                        value={squadSearch}
                        onChange={(e) => setSquadSearch(e.target.value)}
                        placeholder="Cerca atleti per nome..."
                        className={cn(
                          "w-full border rounded-2xl py-3.5 pl-10 pr-4 text-xs font-bold placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all",
                          theme === 'dark' ? "bg-[#0d0d0e] border-white/5 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                        )}
                      />
                      <Target className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      {squadSearch && (
                        <button 
                          onClick={() => setSquadSearch('')}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Role Filter Tabs */}
                    <div className={cn(
                      "flex p-1 rounded-xl border gap-1 overflow-x-auto w-full sm:w-auto",
                      theme === 'dark' ? "bg-[#0d0d0e] border-white/5" : "bg-gray-100 border-gray-200"
                    )}>
                      {['Tutti', 'Portiere', 'Difensore', 'Centrocampista', 'Attaccante'].map((roleOpt) => (
                        <button
                          key={roleOpt}
                          onClick={() => setSquadRoleFilter(roleOpt as any)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                            squadRoleFilter === roleOpt 
                              ? "bg-blue-600 text-white shadow-md shadow-blue-600/15" 
                              : (theme === 'dark' ? "text-gray-500 hover:text-white" : "text-gray-400 hover:text-gray-900")
                          )}
                        >
                          {roleOpt === 'Tutti' ? 'Tutti' : roleOpt.substring(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Player list actual container */}
                  <div className={cn(
                    "border rounded-3xl overflow-hidden flex-1 flex flex-col min-h-[300px]",
                    theme === 'dark' ? "bg-white/[0.01] border-white/5" : "bg-white border-gray-100"
                  )}>
                    <div className={cn(
                      "p-4 border-b flex items-center justify-between text-[8px] font-black text-gray-500 uppercase tracking-widest",
                      theme === 'dark' ? "border-white/5" : "border-gray-50"
                    )}>
                      <span>Dati Anagrafici Atleta</span>
                      <span>Stato / Azioni</span>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[350px] no-scrollbar divide-y divide-white/5">
                      {(() => {
                        const filtered = squadPlayers.filter(p => {
                          const matchesSearch = p.name.toUpperCase().includes(squadSearch.trim().toUpperCase());
                          const matchesRole = squadRoleFilter === 'Tutti' ? true : p.role === squadRoleFilter;
                          return matchesSearch && matchesRole;
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="py-20 text-center flex flex-col items-center justify-center">
                              <UserIcon className="w-10 h-10 text-gray-500/30 mb-3" />
                              <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Nessun atleta trovato</p>
                              <p className="text-[7.5px] text-gray-600 font-bold uppercase mt-1">Verifica i filtri o inserisci un nuovo giocatore</p>
                            </div>
                          );
                        }

                        return filtered.map((player) => (
                          <div 
                            key={player.id}
                            className={cn(
                              "p-4 flex items-center justify-between group transition-all duration-300 hover:bg-blue-500/[0.02]/20 cursor-pointer",
                              editingPlayer?.id === player.id 
                                ? (theme === 'dark' ? "bg-yellow-500/5 hover:bg-yellow-500/5 border-l-2 border-yellow-500" : "bg-yellow-500/[0.03] border-l-2 border-yellow-500") 
                                : ""
                            )}
                            onClick={() => setEditingPlayer(player)}
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              {/* Player Position Avatar Badge (instead of shirt number) */}
                              <div className={cn(
                                "w-8 h-8 rounded-xl font-sans text-[10px] font-black flex items-center justify-center border shrink-0 tracking-wider",
                                !player.active 
                                  ? "bg-gray-500/5 border-gray-500/10 text-gray-400"
                                  : player.role === 'Portiere' ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                                  : player.role === 'Difensore' ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-500"
                                  : player.role === 'Centrocampista' ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                                  : player.role === 'Attaccante' ? "bg-red-500/10 border-red-500/20 text-red-400"
                                  : "bg-gray-500/10 border-transparent text-gray-400"
                              )}>
                                {player.role === 'Portiere' ? 'GK' :
                                 player.role === 'Difensore' ? 'DF' :
                                 player.role === 'Centrocampista' ? 'MF' :
                                 player.role === 'Attaccante' ? 'FW' : <UserIcon className="w-3 h-3" />}
                              </div>

                              <div className="flex flex-col min-w-0">
                                <span className={cn("text-xs font-black uppercase leading-none truncate", player.active ? (theme === 'dark' ? "text-white" : "text-gray-900") : "text-gray-500 line-through")}>
                                  {player.name}
                                </span>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  {/* Role Pill */}
                                  <span className={cn(
                                    "text-[7px] font-black uppercase px-2 py-0.5 rounded-full border leading-none tracking-widest",
                                    player.role === 'Portiere' ? "bg-purple-500/10 border-purple-500/20 text-purple-400" :
                                    player.role === 'Difensore' ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-500" :
                                    player.role === 'Centrocampista' ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                                    player.role === 'Attaccante' ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-gray-500/10 border-transparent text-gray-400"
                                  )}>
                                    {player.role || 'Nessuno'}
                                  </span>

                                  {/* Preferred foot */}
                                  <span className="text-[7.5px] font-bold text-gray-500 uppercase tracking-widest leading-none">
                                    {player.preferredFoot || 'Destro'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Selectable toggle switch + delete buttons */}
                            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                              {/* Quick Selectable Toggle */}
                              <button
                                onClick={() => {
                                  setSquadPlayers(prev => prev.map(p => p.id === player.id ? { ...p, active: !p.active } : p));
                                  setShowToast({ 
                                    message: `${player.name} ${!player.active ? 'attivato' : 'disattivato'}`, 
                                    type: 'success' 
                                  });
                                }}
                                className={cn(
                                  "w-11 h-6 rounded-full p-0.5 transition-colors focus:outline-none flex items-center relative",
                                  player.active ? "bg-emerald-500" : (theme === 'dark' ? "bg-white/10" : "bg-gray-250")
                                )}
                              >
                                <motion.div 
                                  layout
                                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                  className="w-5 h-5 rounded-full bg-white shadow-sm"
                                  style={{ position: 'absolute', left: player.active ? '20px' : '2px' }}
                                />
                              </button>

                              {/* Delete button */}
                              <button
                                onClick={() => {
                                  if (confirm(`Rimuovere l'atleta ${player.name} dal roster?`)) {
                                    setSquadPlayers(prev => prev.filter(p => p.id !== player.id));
                                    if (editingPlayer?.id === player.id) setEditingPlayer(null);
                                    setShowToast({ message: `Atleta rimosso`, type: 'success' });
                                  }
                                }}
                                className={cn(
                                  "p-2 rounded-xl transition-all border shrink-0",
                                  theme === 'dark' ? "border-transparent bg-white/[0.01] hover:bg-red-500/10 text-gray-500 hover:text-red-400" : "border-gray-50 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-650"
                                )}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className={cn(
                "p-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 shrink-none",
                theme === 'dark' ? "border-white/[0.03] bg-white/[0.01]" : "border-gray-100 bg-gray-50/50"
              )}>
                <button
                  onClick={() => {
                    if (confirm("Sei sicuro di voler ripristinare il roster predefinito del Bologna? Tutti i giocatori personalizzati verranno rimpiazzati.")) {
                      localStorage.removeItem('squad_players');
                      setSquadPlayers(PREDEFINED_PLAYERS.map((name, index) => ({
                        id: `p-${index}`,
                        name: name,
                        role: (index === 0 || index === 8) ? 'Portiere' : (index % 3 === 0) ? 'Difensore' : (index % 3 === 1) ? 'Centrocampista' : 'Attaccante',
                        preferredFoot: index % 2 === 0 ? 'Destro' : 'Sinistro',
                        active: true
                      })));
                      setEditingPlayer(null);
                      setShowToast({ message: "Roster Bologna ripristinato con successo!", type: 'success' });
                    }
                  }}
                  className={cn(
                    "px-5 py-3 border rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-2",
                    theme === 'dark' ? "bg-white/5 hover:bg-white/10 text-gray-400 border-white/10" : "bg-white hover:bg-gray-100 text-gray-650 border-gray-200"
                  )}
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
                  Ripristina Default Bologna
                </button>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setSquadPlayers(prev => prev.map(p => ({ ...p, active: false })));
                      setShowToast({ message: "Tutti gli atleti disattivati!", type: 'success' });
                    }}
                    className={cn(
                      "px-4 py-3 border rounded-xl text-[9px] font-black uppercase tracking-wider transition-all",
                      theme === 'dark' ? "bg-white/5 hover:bg-white/10 text-gray-500 border-white/10" : "bg-white hover:bg-gray-100 text-gray-500 border-gray-200"
                    )}
                  >
                    Deseleziona Tutti
                  </button>
                  <button
                    onClick={() => {
                      setSquadPlayers(prev => prev.map(p => ({ ...p, active: true })));
                      setShowToast({ message: "Tutti gli atleti attivati!", type: 'success' });
                    }}
                    className={cn(
                      "px-4 py-3 border rounded-xl text-[9px] font-black uppercase tracking-wider transition-all",
                      theme === 'dark' ? "bg-white/5 hover:bg-white/10 text-gray-505 border-white/10" : "bg-white hover:bg-gray-150 text-gray-505 border-gray-200"
                    )}
                  >
                    Seleziona Tutti
                  </button>
                  <button
                    onClick={() => {
                      setShowSquadModal(false);
                      setEditingPlayer(null);
                    }}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-500/20"
                  >
                    Chiudi Roster
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
              className={cn(
                "absolute inset-0 backdrop-blur-md",
                theme === 'dark' ? "bg-[#070708]/90" : "bg-white/90"
              )}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "relative w-full max-w-2xl border rounded-[2.5rem] shadow-2xl overflow-hidden",
                theme === 'dark' ? "bg-[#0d0d0e] border-white/[0.05]" : "bg-white border-gray-100"
              )}
            >
              <div className={cn(
                "p-8 border-b flex items-center justify-between",
                theme === 'dark' ? "border-white/[0.03]" : "border-gray-100"
              )}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center">
                    <List className="text-blue-500 w-5 h-5" />
                  </div>
                  <div>
                    <h2 className={cn("text-lg font-black uppercase tracking-tight", theme === 'dark' ? "text-white" : "text-gray-900")}>Le Mie Partite</h2>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Archivio Analitico</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowMatchList(false)}
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all outline-none",
                    theme === 'dark' ? "bg-white/[0.03] hover:bg-white/[0.06] text-gray-500 hover:text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900"
                  )}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4 no-scrollbar">
                {matches.length === 0 ? (
                  <div className="py-24 text-center">
                    <div className="w-20 h-20 bg-gray-500/5 rounded-full flex items-center justify-center mx-auto mb-6">
                      <FileSpreadsheet className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">Nessuna partita salvata</p>
                  </div>
                ) : (
                  matches.map((match) => (
                    <div 
                      key={match.id}
                      className={cn(
                        "group border rounded-3xl p-5 flex items-center justify-between transition-all",
                        theme === 'dark' ? "bg-white/[0.01] border-white/5 hover:border-blue-500/20" : "bg-gray-50 border-gray-200 hover:border-blue-500/20 hover:shadow-sm"
                      )}
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
                            <span className={cn("text-sm font-black uppercase tracking-tight", theme === 'dark' ? "text-white" : "text-gray-900")}>{match.teamName}</span>
                            <span className="text-[9px] font-bold text-gray-500 uppercase italic">vs</span>
                            <span className={cn("text-sm font-black uppercase tracking-tight", theme === 'dark' ? "text-white" : "text-gray-900")}>{match.awayTeam || 'Avversario'}</span>
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
              className={cn(
                "relative w-full max-w-sm border rounded-3xl p-8 shadow-2xl text-center transition-colors",
                theme === 'dark' ? "bg-[#121212] border-white/10" : "bg-white border-gray-100"
              )}
            >
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="text-red-500 w-10 h-10" />
              </div>
              <h2 className={cn("text-2xl font-black mb-2", theme === 'dark' ? "text-white" : "text-gray-900")}>Elimina Partita?</h2>
              <p className="text-gray-500 text-sm mb-8 font-medium">
                Questa azione è irreversibile. Tutti i dati della partita verranno persi per sempre.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => deleteMatch(matchToDelete)}
                  className="w-full py-4 bg-red-500 hover:bg-red-400 text-white font-black rounded-2xl transition-all shadow-lg shadow-red-500/20"
                >
                  Sì, Elimina Definitivamente
                </button>
                <button 
                  onClick={() => setMatchToDelete(null)}
                  className={cn(
                    "w-full py-4 border font-bold rounded-2xl transition-all",
                    theme === 'dark' ? "bg-white/5 hover:bg-white/10 text-white border-white/10" : "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-100"
                  )}
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
              className={cn(
                "fixed bottom-12 left-1/2 z-[300] px-8 py-4 rounded-[1.5rem] flex items-center gap-4 border backdrop-blur-2xl transition-all",
                theme === 'dark' 
                  ? "bg-[#0d0d0e]/95 border-white/[0.05] shadow-[0_20px_50px_rgba(0,0,0,0.5)]" 
                  : "bg-white/95 border-gray-100 shadow-[0_10px_40px_rgba(0,0,0,0.1)]"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center",
                showToast.type === 'success' ? "bg-blue-500/10 text-blue-500" : "bg-red-500/10 text-red-500"
              )}>
                {showToast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              </div>
              <span className={cn("font-black text-[10px] uppercase tracking-widest leading-none", theme === 'dark' ? "text-white" : "text-gray-900")}>
                {showToast.message}
              </span>
            </motion.div>
        )}
      </AnimatePresence>
      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'};
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
  isReadOnly,
  theme
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
      <div className={cn(
        "flex items-center justify-between p-5 rounded-[2rem] transition-all group border",
        theme === 'dark' 
          ? "bg-white/[0.01] border-white/[0.03] hover:bg-white/[0.02]" 
          : "bg-gray-50/50 border-gray-100 hover:bg-gray-50"
      )}>
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
            theme === 'dark' ? "bg-white/[0.03] text-gray-400" : "bg-gray-100 text-gray-500",
            "group-hover:text-blue-500"
          )}>
            {icon}
          </div>
          <div>
            <div className={cn("text-[10px] font-black uppercase tracking-[0.1em]", theme === 'dark' ? "text-white" : "text-gray-900")}>{label}</div>
            <div className="text-[8px] font-bold text-gray-600 uppercase tracking-widest mt-1">PESO: {weight}</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className={cn(
            "flex items-center rounded-2xl p-1.5 border",
            theme === 'dark' ? "bg-gray-950/50 border-white/5" : "bg-white border-gray-100 shadow-sm"
          )}>
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (isReadOnly || count <= 0) return;
                setIpoEventsFn((prev: any) => ({ ...prev, [key]: prev[key] - 1 }));
                addMatchEvent({ type: 'ipo_event', description: `Rimosso ${label} (${currentTeamName})` });
              }}
              className={cn("w-10 h-10 flex items-center justify-center transition-colors", theme === 'dark' ? "text-gray-600 hover:text-white" : "text-gray-400 hover:text-gray-900")}
            >
              <Minus className="w-4 h-4" />
            </motion.button>
            <div className={cn("w-12 text-center font-black text-xl tabular-nums", theme === 'dark' ? "text-white" : "text-gray-900")}>
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
              className={cn("w-10 h-10 flex items-center justify-center transition-colors", theme === 'dark' ? "text-gray-600 hover:text-white" : "text-gray-400 hover:text-gray-900")}
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
        {[
          { 
            label: 'Goal Reali', 
            icon: Trophy, 
            color: 'yellow',
            content: (
              <div className="flex items-center justify-between w-full">
                <div className="flex flex-col">
                  <span className={cn("text-6xl font-black tabular-nums tracking-tighter", theme === 'dark' ? "text-white" : "text-gray-900")}>
                    {ipoActiveTeam === 'home' ? goals : goalsAway}
                  </span>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">GOL TOTALI</p>
                </div>
                <div className={cn("h-16 w-px mx-6", theme === 'dark' ? "bg-white/10" : "bg-gray-200")} />
                <div className="flex flex-col text-right">
                  <span className={cn("text-3xl font-black tabular-nums tracking-tight", theme === 'dark' ? "text-white" : "text-gray-900")}>
                    {ipoActiveTeam === 'home' ? teamName : awayTeam}
                  </span>
                  <div className="flex items-center gap-1.5 justify-end mt-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ipoActiveTeam === 'home' ? teamColor : awayColor }} />
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Active Team</span>
                  </div>
                </div>
              </div>
            )
          },
          { 
            label: 'Performance Index', 
            icon: Zap, 
            color: 'blue',
            content: (
              <div className="flex items-baseline gap-4 w-full">
                <span className={cn("text-6xl font-black tracking-tighter tabular-nums", theme === 'dark' ? "text-white" : "text-gray-900")}>
                  <AnimatedCounter value={ipoActiveTeam === 'home' ? ipo : ipoAway} />
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none bg-blue-500/10 px-3 py-1 rounded-full">IPO INDEX</span>
                  <span className="text-[8px] font-bold text-gray-500 uppercase tracking-[0.2em] px-1">{ipo >= ipoAway ? 'Dominio' : 'In Difesa'}</span>
                </div>
              </div>
            )
          },
          { 
            label: 'Real Efficiency', 
            icon: Activity, 
            color: 'emerald',
            content: (
              <div className="flex items-center justify-between w-full">
                <div className="flex flex-col">
                  <span className={cn("text-6xl font-black tabular-nums tracking-tighter", theme === 'dark' ? "text-white" : "text-gray-900")}>
                    {(efficiency * 100).toFixed(0)}<span className="text-2xl opacity-30">%</span>
                  </span>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">CONVERSIONE</p>
                </div>
                <div className={cn("h-16 w-px mx-6", theme === 'dark' ? "bg-white/10" : "bg-gray-200")} />
                <div className="flex-1 space-y-2">
                  <div className="h-1.5 w-full bg-gray-500/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-emerald-500" 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, efficiency * 100)}%` }}
                    />
                  </div>
                  <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Efficiency Scoring Rate</p>
                </div>
              </div>
            )
          }
        ].map((item, i) => (
          <motion.div 
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ 
              y: -4, 
              boxShadow: theme === 'dark' ? '0 15px 30px -10px rgba(59,130,246,0.08)' : '0 10px 25px -10px rgba(0,0,0,0.02)',
              borderColor: theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' 
            }}
            className={cn(
              "border rounded-[2.5rem] p-8 flex flex-col justify-between min-h-[220px] transition-all duration-500 relative overflow-hidden group",
              theme === 'dark' ? "bg-white/[0.02] border-white/[0.05]" : "bg-white border-gray-100 shadow-sm"
            )}
          >
            {/* Subtle technical corner accents */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-white/5 group-hover:border-white/20 transition-colors pointer-events-none" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-white/5 group-hover:border-white/20 transition-colors pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-white/5 group-hover:border-white/20 transition-colors pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-white/5 group-hover:border-white/20 transition-colors pointer-events-none" />

            <div className="flex items-center justify-between mb-2 relative z-10">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">{item.label}</p>
              <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 border",
                item.color === 'yellow' ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-500" :
                item.color === 'blue' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
              )}>
                <item.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="relative z-10 flex-1 flex items-center">
              {item.content}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Power Balance Gauge */}
      {(() => {
        const totalIpo = ipo + ipoAway;
        const homeRatio = totalIpo > 0 ? (ipo / totalIpo) : 0.5;
        const awayRatio = totalIpo > 0 ? (ipoAway / totalIpo) : 0.5;
        return (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={cn(
              "border rounded-[2.5rem] p-6 sm:p-8 relative overflow-hidden transition-all duration-500 shadow-lg",
              theme === 'dark' ? "bg-white/[0.01] border-white/[0.03]" : "bg-white border-gray-50 shadow-sm"
            )}
          >
            {/* Fine grids and design accents */}
            <div className="absolute top-0 left-0 w-32 h-full border-r border-gray-500/5 pointer-events-none" />
            <div className="absolute top-0 right-0 w-32 h-full border-l border-gray-500/5 pointer-events-none" />

            <div className="flex flex-col gap-5 relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-blue-500 uppercase tracking-[0.2em]">STATISTICS INSIGHTS</span>
                  <h3 className={cn("text-xs font-black uppercase tracking-tight mt-1", theme === 'dark' ? "text-white" : "text-gray-900")}>Rapporto di Forza (IPO Ratio)</h3>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[7.5px] font-black text-emerald-500 uppercase tracking-widest leading-none">Equilibrio Dinamico</span>
                </div>
              </div>

              {/* Progressive Splitter Bar */}
              <div className="space-y-3">
                <div className="h-4 w-full bg-inner-field-lines bg-gray-500/10 rounded-full overflow-hidden flex relative p-0.5 border border-white/5">
                  <motion.div 
                    className="h-full rounded-l-full bg-gradient-to-r from-blue-600 to-blue-500 relative flex items-center justify-end pr-2"
                    initial={{ width: '50%' }}
                    animate={{ width: `${homeRatio * 100}%` }}
                    transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                  >
                    {homeRatio > 0.15 && (
                      <span className="text-[8px] font-black text-white/95 font-mono tracking-widest leading-none">{Math.round(homeRatio * 100)}%</span>
                    )}
                  </motion.div>
                  <motion.div 
                    className="h-full rounded-r-full bg-gradient-to-r from-red-500 to-red-600 relative flex items-center pl-2"
                    initial={{ width: '50%' }}
                    animate={{ width: `${awayRatio * 100}%` }}
                    transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                  >
                    {awayRatio > 0.15 && (
                      <span className="text-[8px] font-black text-white/95 font-mono tracking-widest leading-none">{Math.round(awayRatio * 100)}%</span>
                    )}
                  </motion.div>
                  
                  {/* Absolute Center Indicator Mark */}
                  <div className="absolute top-0 bottom-0 left-1/2 -ml-px w-0.5 bg-white/30 z-20 pointer-events-none" />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-[9px] font-black uppercase tracking-widest font-mono p-1">
                  <div className="flex items-center gap-2 text-blue-500">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>{teamName} ({ipo.toFixed(1)})</span>
                  </div>
                  <div className="text-gray-500 text-center text-[8px] uppercase font-bold">
                    {ipo > ipoAway ? `VANTAGGIO ${teamName}` : ipoAway > ipo ? `VANTAGGIO ${awayTeam || 'AVVERSARIO'}` : 'BILANCIATO'}
                  </div>
                  <div className="flex items-center gap-2 text-red-500">
                    <span>({ipoAway.toFixed(1)}) {awayTeam || 'Avversario'}</span>
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })()}

      {/* Events Control Zone */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 flex flex-col gap-6">
           <div className={cn(
             "border rounded-[2.5rem] p-4 flex flex-col gap-2 transition-colors",
             theme === 'dark' ? "bg-[#0d0d0e] border-white/5" : "bg-white border-gray-100 shadow-sm"
           )}>
             <button
               onClick={() => setIpoActiveTeam('home')}
               className={cn(
                 "group relative py-6 px-8 rounded-[2rem] text-left transition-all duration-500 overflow-hidden",
                 ipoActiveTeam === 'home' 
                   ? (theme === 'dark' ? "bg-white/[0.03]" : "bg-blue-50") 
                   : (theme === 'dark' ? "hover:bg-white/[0.01]" : "hover:bg-gray-50")
               )}
             >
               {ipoActiveTeam === 'home' && (
                 <motion.div 
                   layoutId="ipo-active" 
                   className={cn(
                     "absolute inset-0 ring-1",
                     theme === 'dark' ? "bg-blue-500/5 ring-blue-500/20" : "bg-blue-500/10 ring-blue-500/30"
                   )} 
                 />
               )}
               <div className="relative z-10">
                 <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Squadra A</p>
                 <h4 className={cn("text-sm font-black uppercase tracking-tight", theme === 'dark' ? "text-white" : "text-gray-900")}>{teamName}</h4>
               </div>
             </button>
             <button
               onClick={() => setIpoActiveTeam('away')}
               className={cn(
                 "group relative py-6 px-8 rounded-[2rem] text-left transition-all duration-500 overflow-hidden",
                 ipoActiveTeam === 'away' 
                   ? (theme === 'dark' ? "bg-white/[0.03]" : "bg-blue-50") 
                   : (theme === 'dark' ? "hover:bg-white/[0.01]" : "hover:bg-gray-50")
               )}
             >
               {ipoActiveTeam === 'away' && (
                 <motion.div 
                   layoutId="ipo-active" 
                   className={cn(
                     "absolute inset-0 ring-1",
                     theme === 'dark' ? "bg-blue-500/5 ring-blue-500/20" : "bg-blue-500/10 ring-blue-500/30"
                   )} 
                 />
               )}
               <div className="relative z-10">
                 <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Squadra B</p>
                 <h4 className={cn("text-sm font-black uppercase tracking-tight", theme === 'dark' ? "text-white" : "text-gray-900")}>{awayTeam || 'Avversario'}</h4>
               </div>
             </button>
           </div>

           <div className={cn(
             "border rounded-[2.5rem] p-8 space-y-6 transition-colors",
             theme === 'dark' ? "bg-white/[0.01] border-white/[0.03]" : "bg-white border-gray-100 shadow-sm"
           )}>
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                    <Zap className="w-4 h-4" />
                 </div>
                 <h4 className={cn("text-[10px] font-black uppercase tracking-widest", theme === 'dark' ? "text-white" : "text-gray-900")}>Azioni Rapide</h4>
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
                    className={cn(
                      "w-full py-4 border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                      theme === 'dark' ? "bg-white/5 hover:bg-white/10 text-gray-500 border-white/10" : "bg-gray-50 hover:bg-gray-100 text-gray-500 border-gray-200"
                    )}
                 >
                    Reset Statistiche
                 </button>
              </div>
           </div>
        </div>

        <div className={cn(
          "lg:col-span-8 border rounded-[3rem] p-8 transition-colors",
          theme === 'dark' ? "bg-white/[0.01] border-white/[0.03]" : "bg-white border-gray-100 shadow-sm"
        )}>
           <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className={cn("text-xl font-black uppercase tracking-tight", theme === 'dark' ? "text-white" : "text-gray-900")}>Pannello Eventi</h3>
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

           <div className={cn(
             "mt-10 pt-8 border-t flex items-center justify-between",
             theme === 'dark' ? "border-white/[0.03]" : "border-gray-100"
           )}>
              <p className="text-[9px] font-bold text-gray-700 uppercase tracking-[0.2em]">Algoritmo IPO v3.4 Dynamic Weighting</p>
              <div className="flex items-center gap-4">
                 <span className="text-[10px] font-black text-gray-500 uppercase">Totale</span>
                 <span className={cn("text-3xl font-black", theme === 'dark' ? "text-white" : "text-gray-900")}>{(ipoActiveTeam === 'home' ? ipo : ipoAway).toFixed(1)}</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

