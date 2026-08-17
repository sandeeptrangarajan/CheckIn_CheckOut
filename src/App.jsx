import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import {
  UserPlus,
  Users,
  Camera,
  Download,
  Printer,
  CheckCircle2,
  FileSpreadsheet,
  Trash2,
  Sparkles,
  Clock,
  ScanLine,
  StopCircle,
  LogIn,
  LogOut,
  Search,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Database,
  Hash,
  KeyRound,
  HelpCircle,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  History
} from 'lucide-react';

const COMMON_EVENT_QR_PAYLOAD = 'HACKATHON-GATE-2026';

// Dynamic API Base URL resolution with multi-host fallback
const getApiBaseUrl = () => {
  const host = (window && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
  return `http://${host}:5000/api`;
};

// Resilient Fetch Helper with automatic fallback between hostname, 127.0.0.1, and localhost
async function resilientFetch(endpoint, options = {}) {
  const primaryHost = (window && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
  const candidateUrls = [
    `http://${primaryHost}:5000/api${endpoint}`,
    `http://localhost:5000/api${endpoint}`,
    `http://127.0.0.1:5000/api${endpoint}`
  ];

  let lastError;
  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Failed to connect to MongoDB Atlas Express server on port 5000.');
}

export default function App() {
  const [participants, setParticipants] = useState([]);
  const [dbStatus, setDbStatus] = useState('connecting');

  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'scanner' | 'admin'
  const [loginMode, setLoginMode] = useState('register'); // 'register' | 'existing_login'

  // Login / Registration Form State
  const [formData, setFormData] = useState({ teamNumber: '', name: '', email: '', section: '' });
  const [loginTeamInput, setLoginTeamInput] = useState('');
  const [activeUser, setActiveUser] = useState(null);

  // Expanded History Row IDs for Admin
  const [expandedRows, setExpandedRows] = useState({});

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState(null);

  // Common Master QR Code Data URL
  const [commonQrDataUrl, setCommonQrDataUrl] = useState('');

  // Camera & Scan Notice State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scanNotice, setScanNotice] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const html5QrCodeRef = useRef(null);

  // Admin Dashboard Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch all interconnected participant database rows directly from MongoDB API
  const fetchParticipantsFromMongo = async () => {
    try {
      const res = await resilientFetch('/participants');
      if (res.ok) {
        const data = await res.json();
        const formatted = data.map(p => ({
          ...p,
          id: p.userId || p._id,
          teamNumber: p.teamNumber || 'TEAM-101',
          sessionCount: p.sessionCount || 0
        }));
        setParticipants(formatted);
        setDbStatus('connected');

        // Update activeUser if selected
        if (activeUser) {
          const updatedActive = formatted.find(p => p.id === activeUser.id || p.userId === activeUser.id);
          if (updatedActive) setActiveUser(updatedActive);
        }
      } else {
        throw new Error('API request failed');
      }
    } catch (err) {
      console.warn('MongoDB API offline, fallback to LocalStorage:', err);
      setDbStatus('offline');
      const saved = localStorage.getItem('hackathon_multicycle_backup_v13');
      if (saved) setParticipants(JSON.parse(saved));
    }
  };

  // Poll MongoDB Atlas API every 3 seconds for real-time live synchronization
  useEffect(() => {
    fetchParticipantsFromMongo();
    const interval = setInterval(() => {
      fetchParticipantsFromMongo();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Sync state fallback to LocalStorage
  useEffect(() => {
    if (participants.length > 0) {
      localStorage.setItem('hackathon_multicycle_backup_v13', JSON.stringify(participants));
    }
  }, [participants]);

  // Generate Common Static Master QR Code
  useEffect(() => {
    QRCode.toDataURL(COMMON_EVENT_QR_PAYLOAD, { width: 240, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(url => setCommonQrDataUrl(url))
      .catch(err => console.error('Error generating common QR:', err));
  }, []);

  // Notice Auto-Dismiss after 5 seconds
  useEffect(() => {
    if (scanNotice) {
      const timer = setTimeout(() => setScanNotice(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [scanNotice]);

  // Cleanup camera on unmount or tab change
  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, [activeTab]);

  // Audio Beep Effect
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  };

  const toggleRowExpansion = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Manual Export to Excel
  const exportToExcelManual = () => {
    if (participants.length === 0) {
      alert('No participant database rows to export.');
      return;
    }

    const exportData = participants.map((p, idx) => ({
      'S.No': idx + 1,
      'Team Number': p.teamNumber || 'TEAM-101',
      'User ID': p.id || p.userId,
      'Name of Student': p.name,
      'Email Address': p.email,
      'Class/Section': p.section,
      'Status': p.status.toUpperCase(),
      'Sessions Count': p.sessionCount || (p.checkInTime ? 1 : 0),
      'Latest Check-In': p.checkInTime || 'Pending',
      'Latest Check-Out': p.checkOutTime || 'Pending',
      'Total Cumulative In-Between Time': p.duration || 'Pending',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Roster');

    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 15 },
      { wch: 22 },
      { wch: 26 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 22 },
      { wch: 22 },
      { wch: 30 },
    ];

    XLSX.writeFile(workbook, `MongoDB_Hackathon_Attendance_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // Login via Existing Team Number (Redirects Returning Users Directly to Scanner)
  const handleExistingTeamLogin = async (e) => {
    e.preventDefault();
    if (!loginTeamInput.trim()) {
      alert('Please enter a Team Number.');
      return;
    }

    const searchStr = loginTeamInput.trim();

    try {
      const res = await resilientFetch('/participants/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamNumber: searchStr })
      });

      if (res.ok) {
        const foundUser = await res.json();
        const formattedUser = { ...foundUser, id: foundUser.userId, teamNumber: foundUser.teamNumber || searchStr };
        
        setActiveUser(formattedUser);
        setActiveTab('scanner'); // DIRECT REDIRECT TO SCANNER SECTION
        
        setScanNotice({
          type: 'success',
          title: `Welcome back Team ${formattedUser.teamNumber}!`,
          message: `Logged in as ${formattedUser.name} (${formattedUser.section}). Direct redirect to Scanner.`
        });

        fetchParticipantsFromMongo();
        confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
      } else {
        const errData = await res.json();
        alert(`Team Lookup Notice: ${errData.error || 'Team not found'}. Redirecting to New Registration...`);
        setFormData(prev => ({ ...prev, teamNumber: searchStr.toUpperCase() }));
        setLoginMode('register');
      }
    } catch (err) {
      console.warn('Login fetch error:', err);
      setFormData(prev => ({ ...prev, teamNumber: searchStr.toUpperCase() }));
      setLoginMode('register');
    }
  };

  // First Time Registration -> SAVES PROPERLY FORMATTED DATA TO MONGODB ATLAS & REDIRECTS DIRECTLY TO SCANNER
  const handleRegisterUser = async (e) => {
    e.preventDefault();
    if (!formData.teamNumber.trim() || !formData.name.trim() || !formData.email.trim() || !formData.section.trim()) {
      alert('Please fill out all fields including Team Number.');
      return;
    }

    try {
      const res = await resilientFetch('/participants/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamNumber: formData.teamNumber.trim(),
          name: formData.name.trim(),
          email: formData.email.trim(),
          section: formData.section.trim()
        })
      });

      if (res.ok) {
        const newUser = await res.json();
        console.log('✓ Clean Document Saved to MongoDB Atlas:', newUser);
        const formattedUser = { ...newUser, id: newUser.userId, teamNumber: newUser.teamNumber, sessionCount: 0 };
        
        setParticipants(prev => [formattedUser, ...prev]);
        setActiveUser(formattedUser);
        setFormData({ teamNumber: '', name: '', email: '', section: '' });
        
        setActiveTab('scanner'); // DIRECT REDIRECT TO SCANNER SECTION
        setScanNotice({
          type: 'info',
          title: `✓ Clean Row Saved to MongoDB Atlas!`,
          message: `Team ${formattedUser.teamNumber} (${formattedUser.name}) inserted into MongoDB Atlas (ID: ${formattedUser.userId}). Ready to scan!`
        });

        await fetchParticipantsFromMongo();
        confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
      } else {
        const errData = await res.json();
        alert(`MongoDB Registration Error: ${errData.error || 'Server rejected registration'}`);
      }
    } catch (err) {
      console.error('Registration fetch error:', err);
      alert(`MongoDB Server Connection Error: ${err.message}. Server restarted automatically.`);
    }
  };

  // Step A: Initiate Scan Process Modal Prompt
  const initiateScanProcess = (targetUserId) => {
    const userToUpdate = participants.find(p => p.id === targetUserId || p.userId === targetUserId) || activeUser;
    if (!userToUpdate) {
      setScanNotice({
        type: 'error',
        title: 'No Student Selected',
        message: 'Please login or select a team number first.'
      });
      return;
    }

    if (userToUpdate.status === 'registered') {
      setConfirmModal({ user: userToUpdate, actionType: 'check-in' });
    } else if (userToUpdate.status === 'checked-in') {
      setConfirmModal({ user: userToUpdate, actionType: 'check-out' });
    } else if (userToUpdate.status === 'checked-out') {
      setConfirmModal({ user: userToUpdate, actionType: 're-check-in' });
    }
  };

  // Step B: Execute Confirmed Scan (Updates MongoDB Atlas directly)
  const executeConfirmedScan = async () => {
    if (!confirmModal || !confirmModal.user) return;
    const userToUpdate = confirmModal.user;
    setConfirmModal(null);

    playBeep();

    try {
      const res = await resilientFetch('/participants/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userToUpdate.id || userToUpdate.userId })
      });

      if (res.ok) {
        const result = await res.json();
        const updatedUser = { 
          ...result.participant, 
          id: result.participant.userId
        };

        setParticipants(prev => prev.map(p => (p.id === updatedUser.id || p.userId === updatedUser.id) ? updatedUser : p));
        setActiveUser(updatedUser);

        setScanNotice({
          type: updatedUser.status === 'checked-in' ? 'check-in' : 'check-out',
          title: result.message,
          message: updatedUser.status === 'checked-out' 
            ? `Cumulative duration updated in MongoDB Atlas: ${updatedUser.duration}` 
            : `Session Check-In saved in MongoDB Atlas.`
        });

        await fetchParticipantsFromMongo();

        if (updatedUser.status === 'checked-in') {
          confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
        }
      } else {
        const errData = await res.json();
        setScanNotice({
          type: 'warning',
          title: 'MongoDB Scan Notice',
          message: errData.message || errData.error
        });
      }
    } catch (err) {
      console.warn('Fallback offline scan:', err);
    }
  };

  // Camera Reader Startup
  const startCameraScanner = async () => {
    setCameraError(null);
    setIsCameraActive(true);

    setTimeout(async () => {
      try {
        const container = document.getElementById('camera-stream-div');
        if (!container) return;

        if (html5QrCodeRef.current) {
          try { await html5QrCodeRef.current.stop(); } catch (e) {}
        }

        const html5QrCode = new Html5Qrcode('camera-stream-div');
        html5QrCodeRef.current = html5QrCode;

        let lastScanTime = 0;

        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            const now = Date.now();
            if (now - lastScanTime < 3000) return;
            lastScanTime = now;

            if (activeUser) {
              initiateScanProcess(activeUser.id || activeUser.userId);
            }
          },
          (err) => {}
        );
      } catch (err) {
        console.error('Camera initialization failed:', err);
        setCameraError(err.message || 'Camera access error');
        setIsCameraActive(false);
      }
    }, 200);
  };

  // Stop Camera
  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
      } catch (err) {}
      html5QrCodeRef.current = null;
    }
    setIsCameraActive(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this database row from MongoDB Atlas?')) {
      try {
        await resilientFetch(`/participants/${id}`, { method: 'DELETE' });
      } catch (e) {}

      setParticipants(prev => prev.filter(p => p.id !== id && p.userId !== id && p._id !== id));
      if (activeUser && (activeUser.id === id || activeUser.userId === id)) {
        setActiveUser(null);
      }
      fetchParticipantsFromMongo();
    }
  };

  // Stats Counters
  const stats = {
    total: participants.length,
    checkedIn: participants.filter(p => p.status === 'checked-in').length,
    checkedOut: participants.filter(p => p.status === 'checked-out').length,
    registered: participants.filter(p => p.status === 'registered').length,
  };

  // Filtered Roster for Admin
  const filteredParticipants = participants.filter(p => {
    const matchesSearch = (p.teamNumber && p.teamNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.id && p.id.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          p.section.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#090d16', color: '#f8fafc' }}>

      {/* REPEATABLE SCAN CONFIRMATION PROMPT MODAL */}
      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel animate-fade-in" style={{ maxWidth: '460px', width: '100%', padding: '28px', textAlign: 'center', border: '1px solid var(--primary)', boxShadow: '0 0 40px rgba(99, 102, 241, 0.3)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: confirmModal.actionType === 'check-out' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', color: confirmModal.actionType === 'check-out' ? '#f43f5e' : '#10b981' }}>
              <HelpCircle size={32} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px' }}>
              Confirm {confirmModal.actionType === 'check-in' ? 'Check-In' : confirmModal.actionType === 'check-out' ? 'Check-Out' : 'New Session Re-Check-In'}?
            </h3>
            
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              {confirmModal.actionType === 'check-out' && 'Calculates in-between duration & updates MongoDB Atlas automatically.'}
              {confirmModal.actionType === 're-check-in' && 'Starts a new attendance session cycle for this team.'}
              {confirmModal.actionType === 'check-in' && 'Records session Check-In timestamp in MongoDB Atlas.'}
              <br/>
              <strong style={{ color: '#fff', fontSize: '1rem', display: 'inline-block', marginTop: '8px' }}>
                Team {confirmModal.user.teamNumber} — {confirmModal.user.name}
              </strong>
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setConfirmModal(null)}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '12px' }}
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmedScan}
                className={`btn ${confirmModal.actionType === 'check-out' ? 'btn-danger' : 'btn-success'}`}
                style={{ flex: 1, padding: '12px', fontWeight: 700 }}
              >
                Confirm {confirmModal.actionType === 'check-out' ? 'Check-Out' : 'Check-In'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <header className="glass-panel" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0, padding: '16px 32px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)' }}>
              <Database style={{ width: '24px', height: '24px', color: '#fff' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 800, background: 'linear-gradient(90deg, #fff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  HACKPORTAL MongoDB System
                </h1>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  background: dbStatus === 'connected' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  color: dbStatus === 'connected' ? '#10b981' : '#f59e0b',
                  border: `1px solid ${dbStatus === 'connected' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
                }}>
                  {dbStatus === 'connected' ? '✓ MongoDB Atlas Live' : 'Local Fallback'}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Database: cse_hackathon | Active Rows: {participants.length}</p>
            </div>
          </div>

          {/* Nav Tabs & Direct MongoDB Sync Button */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button onClick={fetchParticipantsFromMongo} className="btn btn-secondary btn-sm" title="Sync live data directly from MongoDB Atlas">
              <RefreshCw size={14} /> Sync MongoDB Atlas ({participants.length})
            </button>

            <nav style={{ display: 'flex', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <button
                onClick={() => setActiveTab('login')}
                className={`btn ${activeTab === 'login' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                <LogIn size={16} /> 1. Team Login / Register
              </button>
              <button
                onClick={() => setActiveTab('scanner')}
                className={`btn ${activeTab === 'scanner' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                <Camera size={16} /> 2. Camera Scanner
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`btn ${activeTab === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                <ShieldCheck size={16} /> 3. Admin View ({participants.length})
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '32px 20px' }}>

        {/* Global Scan Banner */}
        {scanNotice && (
          <div className="animate-fade-in" style={{
            padding: '16px 20px',
            borderRadius: '14px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            background: scanNotice.type === 'check-in' ? 'rgba(16, 185, 129, 0.18)' :
                        scanNotice.type === 'check-out' ? 'rgba(244, 63, 94, 0.18)' :
                        scanNotice.type === 'error' ? 'rgba(244, 63, 94, 0.18)' : 'rgba(99, 102, 241, 0.18)',
            border: `1px solid ${scanNotice.type === 'check-in' ? 'rgba(16, 185, 129, 0.4)' :
                                 scanNotice.type === 'check-out' ? 'rgba(244, 63, 94, 0.4)' : 'rgba(99, 102, 241, 0.4)'}`,
            color: scanNotice.type === 'check-in' ? '#10b981' :
                   scanNotice.type === 'check-out' ? '#f43f5e' : '#818cf8'
          }}>
            <CheckCircle2 size={24} style={{ flexShrink: 0 }} />
            <div>
              <h4 style={{ fontWeight: 800, fontSize: '0.95rem' }}>{scanNotice.title}</h4>
              <p style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '2px' }}>{scanNotice.message}</p>
            </div>
          </div>
        )}

        {/* TAB 1: LOGIN / REGISTER */}
        {activeTab === 'login' && (
          <div className="animate-fade-in" style={{ maxWidth: '540px', margin: '0 auto' }}>
            <div className="glass-panel" style={{ padding: '36px' }}>

              {/* Toggle Header */}
              <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '28px' }}>
                <button
                  onClick={() => setLoginMode('register')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    background: loginMode === 'register' ? 'var(--primary)' : 'transparent',
                    color: loginMode === 'register' ? '#fff' : 'var(--text-muted)'
                  }}
                >
                  <UserPlus size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  New Registration
                </button>
                <button
                  onClick={() => setLoginMode('existing_login')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    background: loginMode === 'existing_login' ? 'var(--primary)' : 'transparent',
                    color: loginMode === 'existing_login' ? '#fff' : 'var(--text-muted)'
                  }}
                >
                  <KeyRound size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Login with Team #
                </button>
              </div>

              {/* MODE A: LOGIN WITH EXISTING TEAM NUMBER */}
              {loginMode === 'existing_login' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '10px', color: 'var(--primary)' }}>
                      <KeyRound size={24} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Team Portal Login</h2>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Enter your Team Number to launch scanner directly</p>
                    </div>
                  </div>

                  <form onSubmit={handleExistingTeamLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                        <Hash size={15} style={{ display: 'inline', color: 'var(--primary)', verticalAlign: 'middle' }} /> Enter Team Number *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. TEAM-101, TEAM-102"
                        value={loginTeamInput}
                        onChange={e => setLoginTeamInput(e.target.value)}
                        style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '0.5px' }}
                      />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ padding: '14px', width: '100%', fontWeight: 700 }}>
                      <LogIn size={18} /> Login & Redirect to Scanner ➔
                    </button>
                  </form>
                </div>
              )}

              {/* MODE B: NEW REGISTRATION FORM */}
              {loginMode === 'register' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '10px', color: 'var(--primary)' }}>
                      <UserPlus size={24} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Participant Registration</h2>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Saves directly to MongoDB & redirects to Scanner</p>
                    </div>
                  </div>

                  <form onSubmit={handleRegisterUser} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                        <Hash size={14} style={{ display: 'inline', color: 'var(--primary)', verticalAlign: 'middle' }} /> Team Number *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. TEAM-105"
                        value={formData.teamNumber}
                        onChange={e => setFormData({ ...formData, teamNumber: e.target.value })}
                        style={{ fontWeight: 700 }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Name of the Student *</label>
                      <input
                        type="text"
                        required
                        placeholder="Enter student full name"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Email Address *</label>
                      <input
                        type="email"
                        required
                        placeholder="student.email@domain.com"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Class / Section *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. CSE-A, ECE-B"
                        value={formData.section}
                        onChange={e => setFormData({ ...formData, section: e.target.value })}
                      />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ marginTop: '6px', padding: '14px', width: '100%', fontWeight: 700 }}>
                      <Database size={18} /> Register & Save to MongoDB Atlas ➔
                    </button>
                  </form>
                </div>
              )}

            </div>
          </div>
        )}

        {/* TAB 2: LIVE CAMERA SCANNER & COMMON QR CODE */}
        {activeTab === 'scanner' && (
          <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', maxWidth: '1100px', margin: '0 auto' }}>

            {/* Camera Scanner Container */}
            <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', padding: '10px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '50%', color: 'var(--primary)', marginBottom: '12px' }}>
                <Camera size={28} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '4px' }}>Real Camera Scanner</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                Active Student: <strong style={{ color: '#fff' }}>{activeUser ? `${activeUser.name} (${activeUser.teamNumber})` : 'Select student below'}</strong>
              </p>

              {/* Webcam Viewport */}
              {!isCameraActive ? (
                <div style={{ padding: '32px 16px', border: '2px dashed var(--border-color)', borderRadius: '16px', background: 'rgba(15, 23, 42, 0.4)', marginBottom: '20px' }}>
                  <Camera size={44} style={{ color: 'var(--text-dim)', marginBottom: '12px' }} />
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Click below to open webcam and scan the Common Event QR code
                  </p>
                  <button onClick={startCameraScanner} className="btn btn-primary" style={{ width: '100%' }}>
                    <Camera size={18} /> Start Camera Scanner
                  </button>

                  {cameraError && (
                    <p style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '12px' }}>
                      ⚠ {cameraError}
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ marginBottom: '20px' }}>
                  <button onClick={stopCameraScanner} className="btn btn-danger btn-sm" style={{ marginBottom: '12px' }}>
                    <StopCircle size={14} /> Stop Camera
                  </button>
                  <div id="camera-stream-div" style={{ width: '100%', maxWidth: '380px', margin: '0 auto', minHeight: '260px', borderRadius: '14px', border: '2px solid var(--primary)', overflow: 'hidden' }}></div>
                </div>
              )}

              {/* User Selection & Scan Button Simulator */}
              <div style={{ textAlign: 'left', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Select Active Student / Team ({participants.length} in MongoDB):
                </label>

                <select
                  value={activeUser ? (activeUser.id || activeUser.userId) : ''}
                  onChange={e => {
                    const found = participants.find(p => p.id === e.target.value || p.userId === e.target.value);
                    if (found) setActiveUser(found);
                  }}
                  style={{ marginBottom: '12px' }}
                >
                  {participants.map(p => (
                    <option key={p.id || p.userId} value={p.id || p.userId}>
                      {p.teamNumber || 'TEAM-101'} - {p.name} ({p.section}) [{p.status.toUpperCase()}]
                    </option>
                  ))}
                </select>

                {activeUser && (
                  <button
                    onClick={() => initiateScanProcess(activeUser.id || activeUser.userId)}
                    className={`btn ${activeUser.status === 'registered' ? 'btn-success' : activeUser.status === 'checked-in' ? 'btn-danger' : 'btn-primary'}`}
                    style={{ width: '100%', padding: '12px' }}
                  >
                    {activeUser.status === 'registered' && <><LogIn size={18} /> Scan Common QR (1st Scan = Check-In)</>}
                    {activeUser.status === 'checked-in' && <><LogOut size={18} /> Scan Common QR (2nd Scan = Check-Out & Auto Duration)</>}
                    {activeUser.status === 'checked-out' && <><RotateCcw size={18} /> Scan Common QR (Repeat Cycle = Re-Check-In)</>}
                  </button>
                )}
              </div>
            </div>

            {/* Common Static Master QR Display */}
            <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', background: 'linear-gradient(180deg, rgba(18, 26, 43, 0.95) 0%, rgba(9, 13, 22, 0.95) 100%)' }}>
              <div style={{ display: 'inline-flex', padding: '6px 14px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '16px' }}>
                COMMON MASTER QR CODE
              </div>

              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Event Gate Master QR</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                Shared by all attendees. <strong>1st Scan</strong> = Check-In | <strong>2nd Scan</strong> = Check-Out | <strong>Repeats Allowed</strong>
              </p>

              {commonQrDataUrl && (
                <div style={{ background: '#fff', padding: '14px', borderRadius: '16px', display: 'inline-block', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', marginBottom: '20px' }}>
                  <img src={commonQrDataUrl} alt="Common Master Event QR" style={{ width: '200px', height: '200px', display: 'block' }} />
                </div>
              )}

              {activeUser && (
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'left', fontSize: '0.8rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>ACTIVE MONGODB ROW:</div>
                  <div style={{ fontWeight: 700, color: '#fff' }}>Team {activeUser.teamNumber}: {activeUser.name} ({activeUser.section})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                    <div style={{ color: activeUser.checkInTime ? '#34d399' : 'var(--text-dim)' }}>
                      <strong>Latest Check-In:</strong> {activeUser.checkInTime || 'Pending'}
                    </div>
                    <div style={{ color: activeUser.checkOutTime ? '#f87171' : 'var(--text-dim)' }}>
                      <strong>Latest Check-Out:</strong> {activeUser.checkOutTime || 'Pending'}
                    </div>
                    {activeUser.duration && (
                      <div style={{ color: '#38bdf8', fontWeight: 700, marginTop: '4px' }}>
                        ⏱ <strong>Cumulative Duration:</strong> {activeUser.duration} (Sessions: {activeUser.sessionCount || 1})
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 3: ADMIN DASHBOARD */}
        {activeTab === 'admin' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

            {/* Top Bar */}
            <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Admin MongoDB Master Control</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Database rows in MongoDB Atlas database (<strong style={{ color: '#10b981' }}>cse_hackathon</strong>)
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={fetchParticipantsFromMongo} className="btn btn-secondary btn-sm">
                  <RefreshCw size={14} /> Refresh Rows ({participants.length})
                </button>
                <button onClick={exportToExcelManual} className="btn btn-success" style={{ height: '42px', fontWeight: 700 }}>
                  <FileSpreadsheet size={18} /> Export to Excel (.xlsx)
                </button>
              </div>
            </div>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ padding: '12px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '12px', color: 'var(--primary)' }}>
                  <Users size={24} />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL STUDENTS</p>
                  <h3 style={{ fontSize: '1.6rem', fontWeight: 800 }}>{stats.total}</h3>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '12px', color: 'var(--accent-emerald)' }}>
                  <LogIn size={24} />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>CHECKED IN</p>
                  <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>{stats.checkedIn}</h3>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ padding: '12px', background: 'rgba(244, 63, 94, 0.15)', borderRadius: '12px', color: 'var(--accent-rose)' }}>
                  <LogOut size={24} />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>CHECKED OUT</p>
                  <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-rose)' }}>{stats.checkedOut}</h3>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '12px', color: 'var(--accent-amber)' }}>
                  <Clock size={24} />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ATTENDANCE RATE</p>
                  <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-amber)' }}>
                    {stats.total > 0 ? Math.round(((stats.checkedIn + stats.checkedOut) / stats.total) * 100) : 0}%
                  </h3>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="glass-panel" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>MongoDB Attendance Master Roster</h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Database rows with Team Number, Student Name, Sessions, Check-In, Check-Out & Cumulative Time</p>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ position: 'relative', minWidth: '220px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                    <input
                      type="text"
                      placeholder="Search team, student, section..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{ paddingLeft: '36px', height: '40px', fontSize: '0.85rem' }}
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    style={{ width: 'auto', height: '40px', fontSize: '0.85rem' }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="registered">Registered</option>
                    <option value="checked-in">Checked In</option>
                    <option value="checked-out">Checked Out</option>
                  </select>
                </div>
              </div>

              <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '14px 16px', width: '40px' }}></th>
                      <th style={{ padding: '14px 16px', fontWeight: 600 }}>TEAM NUMBER</th>
                      <th style={{ padding: '14px 16px', fontWeight: 600 }}>STUDENT NAME & EMAIL</th>
                      <th style={{ padding: '14px 16px', fontWeight: 600 }}>SECTION</th>
                      <th style={{ padding: '14px 16px', fontWeight: 600 }}>STATUS</th>
                      <th style={{ padding: '14px 16px', fontWeight: 600 }}>SESSIONS</th>
                      <th style={{ padding: '14px 16px', fontWeight: 600 }}>CHECK-IN TIME</th>
                      <th style={{ padding: '14px 16px', fontWeight: 600 }}>CHECK-OUT TIME</th>
                      <th style={{ padding: '14px 16px', fontWeight: 600 }}>CUMULATIVE DURATION</th>
                      <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)' }}>
                          No database rows in MongoDB.
                        </td>
                      </tr>
                    ) : (
                      filteredParticipants.map(p => {
                        const isExpanded = !!expandedRows[p.id || p._id];
                        const logs = p.scanLogs || [];

                        return (
                          <React.Fragment key={p.id || p.userId || p._id}>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isExpanded ? 'rgba(30, 41, 59, 0.4)' : 'transparent' }}>
                              <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                <button
                                  onClick={() => toggleRowExpansion(p.id || p._id)}
                                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                  title="Expand Audit Scan Logs"
                                >
                                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                </button>
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#38bdf8', fontWeight: 800, background: 'rgba(56, 189, 248, 0.1)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                                  {p.teamNumber || 'TEAM-101'}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{p.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.email}</div>
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '6px' }}>
                                  {p.section}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '4px 10px',
                                  borderRadius: '20px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  background: p.status === 'registered' ? 'rgba(245, 158, 11, 0.15)' :
                                              p.status === 'checked-in' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                                  color: p.status === 'registered' ? '#f59e0b' :
                                         p.status === 'checked-in' ? '#10b981' : '#f43f5e',
                                  border: `1px solid ${p.status === 'registered' ? 'rgba(245, 158, 11, 0.3)' :
                                                       p.status === 'checked-in' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`
                                }}>
                                  {p.status === 'registered' && '⏳ Registered'}
                                  {p.status === 'checked-in' && '✓ Checked-In'}
                                  {p.status === 'checked-out' && '✓✓ Checked-Out'}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                                #{p.sessionCount || 0}
                              </td>
                              <td style={{ padding: '14px 16px', color: p.checkInTime ? 'var(--accent-emerald)' : 'var(--text-dim)', fontSize: '0.8rem', fontWeight: 600 }}>
                                {p.checkInTime || '-'}
                              </td>
                              <td style={{ padding: '14px 16px', color: p.checkOutTime ? 'var(--accent-rose)' : 'var(--text-dim)', fontSize: '0.8rem', fontWeight: 600 }}>
                                {p.checkOutTime || '-'}
                              </td>
                              <td style={{ padding: '14px 16px', color: p.duration ? '#38bdf8' : 'var(--text-dim)', fontSize: '0.8rem', fontWeight: 700 }}>
                                {p.duration || '-'}
                              </td>
                              <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={() => initiateScanProcess(p.id || p.userId)}
                                    className={`btn btn-sm ${p.status === 'registered' ? 'btn-success' : p.status === 'checked-in' ? 'btn-danger' : 'btn-primary'}`}
                                  >
                                    <ScanLine size={14} /> {p.status === 'registered' ? 'Scan In' : p.status === 'checked-in' ? 'Scan Out' : 'Scan Again'}
                                  </button>
                                  <button
                                    onClick={() => handleDelete(p.id || p._id || p.userId)}
                                    className="btn btn-danger btn-sm"
                                    style={{ padding: '6px 8px' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expandable Audit Log Details Row */}
                            {isExpanded && (
                              <tr style={{ background: 'rgba(15, 23, 42, 0.95)' }}>
                                <td colSpan={10} style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '12px' }}>
                                    <History size={16} /> Audit Scan Logs History for Team {p.teamNumber} ({p.name})
                                  </div>

                                  {logs.length === 0 ? (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>No scan logs recorded yet for this team.</p>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      {logs.map((log, lIdx) => (
                                        <div key={log._id || lIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'rgba(30, 41, 59, 0.6)', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{
                                              padding: '2px 8px',
                                              borderRadius: '12px',
                                              fontSize: '0.7rem',
                                              fontWeight: 800,
                                              background: log.scanType === 'check-in' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                                              color: log.scanType === 'check-in' ? '#10b981' : '#f43f5e'
                                            }}>
                                              {log.scanType.toUpperCase()}
                                            </span>
                                            <span style={{ color: '#fff', fontWeight: 600 }}>Timestamp: {log.timestamp}</span>
                                          </div>
                                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                            Logged ID: {log.userId || p.userId}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
