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
  Hash
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api';
const COMMON_EVENT_QR_PAYLOAD = 'HACKATHON-GATE-2026';

export default function App() {
  const [participants, setParticipants] = useState([]);
  const [dbStatus, setDbStatus] = useState('connecting'); // 'connecting' | 'connected' | 'offline'

  const [activeTab, setActiveTab] = useState('register'); // 'register' | 'scanner' | 'admin'

  // Registration Form State (Team Number, Name of Student, Email, Section)
  const [formData, setFormData] = useState({ teamNumber: '', name: '', email: '', section: '' });
  const [activeUser, setActiveUser] = useState(null);

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

  // Fetch all interconnected participant database rows from MongoDB API on mount
  const fetchParticipantsFromMongo = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/participants`);
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.map(p => ({
          ...p,
          id: p.userId || p._id,
          teamNumber: p.teamNumber || 'TEAM-101'
        })));
        setDbStatus('connected');
      } else {
        throw new Error('API request failed');
      }
    } catch (err) {
      console.warn('MongoDB API offline, fallback to LocalStorage:', err);
      setDbStatus('offline');
      const saved = localStorage.getItem('hackathon_team_row_backup_v11');
      if (saved) setParticipants(JSON.parse(saved));
    }
  };

  useEffect(() => {
    fetchParticipantsFromMongo();
  }, []);

  // Sync state fallback to LocalStorage
  useEffect(() => {
    if (participants.length > 0) {
      localStorage.setItem('hackathon_team_row_backup_v11', JSON.stringify(participants));
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
      'Check-In Time': p.checkInTime || 'Pending',
      'Check-Out Time': p.checkOutTime || 'Pending',
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
      { wch: 22 },
      { wch: 22 },
    ];

    XLSX.writeFile(workbook, `Hackathon_Attendance_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // Register Participant row in MongoDB
  const handleRegisterUser = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.section.trim()) {
      alert('Please fill out all required fields.');
      return;
    }

    const formattedTeamNumber = formData.teamNumber && formData.teamNumber.trim() 
      ? formData.teamNumber.trim().toUpperCase() 
      : `TEAM-${Math.floor(100 + Math.random() * 900)}`;

    try {
      const res = await fetch(`${API_BASE_URL}/participants/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamNumber: formattedTeamNumber,
          name: formData.name.trim(),
          email: formData.email.trim(),
          section: formData.section.trim()
        })
      });

      if (res.ok) {
        const newUser = await res.json();
        const formattedUser = { ...newUser, id: newUser.userId, teamNumber: newUser.teamNumber || formattedTeamNumber };
        
        setParticipants(prev => [formattedUser, ...prev]);
        setActiveUser(formattedUser);
        setFormData({ teamNumber: '', name: '', email: '', section: '' });
        
        setActiveTab('scanner');
        setScanNotice({
          type: 'info',
          title: `MongoDB Saved: Team ${formattedUser.teamNumber} - ${formattedUser.name}`,
          message: `Database row created in MongoDB! Scanner terminal active.`
        });

        confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
      } else {
        throw new Error('Registration failed');
      }
    } catch (err) {
      console.warn('Fallback offline registration:', err);
      const userId = `USER-${Math.floor(1000 + Math.random() * 9000)}`;
      const newUser = {
        id: userId,
        userId,
        teamNumber: formattedTeamNumber,
        name: formData.name.trim(),
        email: formData.email.trim(),
        section: formData.section.trim(),
        status: 'registered',
        checkInTime: null,
        checkOutTime: null,
      };

      setParticipants(prev => [newUser, ...prev]);
      setActiveUser(newUser);
      setFormData({ teamNumber: '', name: '', email: '', section: '' });
      setActiveTab('scanner');
    }
  };

  // Core MongoDB Scan Processor (1st scan = Check-In, 2nd scan = Check-Out)
  const processScanForUser = async (targetUserId) => {
    const userToUpdate = participants.find(p => p.id === targetUserId || p.userId === targetUserId) || activeUser;
    if (!userToUpdate) {
      setScanNotice({
        type: 'error',
        title: 'No User Selected',
        message: 'Please register or select a student from the dropdown first.'
      });
      return;
    }

    playBeep();

    try {
      const res = await fetch(`${API_BASE_URL}/participants/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userToUpdate.id || userToUpdate.userId })
      });

      if (res.ok) {
        const result = await res.json();
        const updatedUser = { ...result.participant, id: result.participant.userId };

        setParticipants(prev => prev.map(p => (p.id === updatedUser.id || p.userId === updatedUser.id) ? updatedUser : p));
        setActiveUser(updatedUser);

        setScanNotice({
          type: updatedUser.status === 'checked-in' ? 'check-in' : 'check-out',
          title: result.message,
          message: `Team ${updatedUser.teamNumber} database row updated in MongoDB Atlas`
        });

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
      const nowFormatted = new Date().toLocaleString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });

      let updated;
      if (userToUpdate.status === 'registered') {
        updated = { ...userToUpdate, status: 'checked-in', checkInTime: nowFormatted };
      } else if (userToUpdate.status === 'checked-in') {
        updated = { ...userToUpdate, status: 'checked-out', checkOutTime: nowFormatted };
      } else {
        updated = userToUpdate;
      }

      setParticipants(prev => prev.map(p => p.id === userToUpdate.id ? updated : p));
      setActiveUser(updated);
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
            if (now - lastScanTime < 2500) return;
            lastScanTime = now;

            if (activeUser) {
              processScanForUser(activeUser.id || activeUser.userId);
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
    if (window.confirm('Delete this database row from MongoDB?')) {
      try {
        await fetch(`${API_BASE_URL}/participants/${id}`, { method: 'DELETE' });
      } catch (e) {}

      setParticipants(prev => prev.filter(p => p.id !== id && p.userId !== id && p._id !== id));
      if (activeUser && (activeUser.id === id || activeUser.userId === id)) {
        setActiveUser(null);
      }
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
                  HACKPORTAL MongoDB Portal
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
                  {dbStatus === 'connected' ? 'MongoDB Atlas Connected' : 'Local Fallback'}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Schema: Team Number | Student Name | Check-In Time | Check-Out Time</p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav style={{ display: 'flex', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setActiveTab('register')}
              className={`btn ${activeTab === 'register' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <UserPlus size={16} /> 1. Enter Details
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
              <ShieldCheck size={16} /> 3. Admin View
            </button>
          </nav>
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

        {/* TAB 1: DETAILS ENTRY */}
        {activeTab === 'register' && (
          <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div className="glass-panel" style={{ padding: '36px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '10px', color: 'var(--primary)' }}>
                  <UserPlus size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Enter Student & Team Details</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Creates a database row in MongoDB (Team Number, Name, Check-In/Out)</p>
                </div>
              </div>

              <form onSubmit={handleRegisterUser} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Team Number (e.g. TEAM-101) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TEAM-101, TEAM-204"
                    value={formData.teamNumber}
                    onChange={e => setFormData({ ...formData, teamNumber: e.target.value })}
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

                <button type="submit" className="btn btn-primary" style={{ marginTop: '10px', padding: '14px', width: '100%', fontWeight: 700 }}>
                  <Database size={18} /> Save Row to MongoDB & Launch Camera Scanner
                </button>
              </form>
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
                Selected Student: <strong style={{ color: '#fff' }}>{activeUser ? `${activeUser.name} (${activeUser.teamNumber})` : 'Select student below'}</strong>
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
                  Select Student / Team to Process Scan:
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
                      Team {p.teamNumber} - {p.name} ({p.section}) [{p.status.toUpperCase()}]
                    </option>
                  ))}
                </select>

                {activeUser && (
                  <button
                    onClick={() => processScanForUser(activeUser.id || activeUser.userId)}
                    disabled={activeUser.status === 'checked-out'}
                    className={`btn ${activeUser.status === 'registered' ? 'btn-success' : activeUser.status === 'checked-in' ? 'btn-danger' : 'btn-secondary'}`}
                    style={{ width: '100%', padding: '12px' }}
                  >
                    {activeUser.status === 'registered' && <><LogIn size={18} /> Scan Common QR (1st Scan = Check-In)</>}
                    {activeUser.status === 'checked-in' && <><LogOut size={18} /> Scan Common QR (2nd Scan = Check-Out)</>}
                    {activeUser.status === 'checked-out' && <>✓ Attendance Completed</>}
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
                Shared by all attendees. <strong>1st Scan</strong> = Check-In | <strong>2nd Scan</strong> = Check-Out.
              </p>

              {commonQrDataUrl && (
                <div style={{ background: '#fff', padding: '14px', borderRadius: '16px', display: 'inline-block', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', marginBottom: '20px' }}>
                  <img src={commonQrDataUrl} alt="Common Master Event QR" style={{ width: '200px', height: '200px', display: 'block' }} />
                </div>
              )}

              {activeUser && (
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'left', fontSize: '0.8rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>SELECTED ROW:</div>
                  <div style={{ fontWeight: 700, color: '#fff' }}>Team {activeUser.teamNumber}: {activeUser.name} ({activeUser.section})</div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                    <span style={{ color: activeUser.checkInTime ? '#34d399' : 'var(--text-dim)' }}>
                      Check-In: {activeUser.checkInTime || 'Pending'}
                    </span>
                    <span style={{ color: activeUser.checkOutTime ? '#f87171' : 'var(--text-dim)' }}>
                      Check-Out: {activeUser.checkOutTime || 'Pending'}
                    </span>
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
                  <RefreshCw size={14} /> Refresh Rows
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
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Each row contains Team Number, Student Name, Check-In Time & Check-Out Time</p>
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
                      <th style={{ padding: '14px 16px', fontWeight: 600 }}>TEAM NUMBER</th>
                      <th style={{ padding: '14px 16px', fontWeight: 600 }}>NAME OF THE STUDENT & EMAIL</th>
                      <th style={{ padding: '14px 16px', fontWeight: 600 }}>CLASS / SECTION</th>
                      <th style={{ padding: '14px 16px', fontWeight: 600 }}>STATUS</th>
                      <th style={{ padding: '14px 16px', fontWeight: 600 }}>CHECK-IN TIME</th>
                      <th style={{ padding: '14px 16px', fontWeight: 600 }}>CHECK-OUT TIME</th>
                      <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)' }}>
                          No database rows in MongoDB.
                        </td>
                      </tr>
                    ) : (
                      filteredParticipants.map(p => (
                        <tr key={p.id || p.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#38bdf8', fontWeight: 800, background: 'rgba(56, 189, 248, 0.1)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                              {p.teamNumber || 'TEAM-101'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{p.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.email}</div>
                          </td>
                          <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{p.section}</td>
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
                          <td style={{ padding: '14px 16px', color: p.checkInTime ? 'var(--accent-emerald)' : 'var(--text-dim)', fontSize: '0.8rem', fontWeight: 600 }}>
                            {p.checkInTime || '-'}
                          </td>
                          <td style={{ padding: '14px 16px', color: p.checkOutTime ? 'var(--accent-rose)' : 'var(--text-dim)', fontSize: '0.8rem', fontWeight: 600 }}>
                            {p.checkOutTime || '-'}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => processScanForUser(p.id || p.userId)}
                                className={`btn btn-sm ${p.status === 'registered' ? 'btn-success' : 'btn-danger'}`}
                              >
                                <ScanLine size={14} /> {p.status === 'registered' ? 'Scan In' : p.status === 'checked-in' ? 'Scan Out' : 'Rescan'}
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
                      ))
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
