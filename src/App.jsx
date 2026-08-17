import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import {
  QrCode,
  UserPlus,
  Users,
  Camera,
  Download,
  Printer,
  CheckCircle2,
  LogOut,
  LogIn,
  Search,
  FileSpreadsheet,
  Trash2,
  Sparkles,
  Clock,
  RefreshCw,
  AlertCircle,
  Volume2,
  StopCircle,
  ScanLine
} from 'lucide-react';

const INITIAL_PARTICIPANTS = [
  {
    id: 'HACK-1001',
    name: 'Aarav Sharma',
    email: 'aarav.s@example.com',
    section: 'CSE-A',
    status: 'checked-in',
    checkInTime: '17/08/2026, 09:15 AM',
    checkOutTime: null,
  },
  {
    id: 'HACK-1002',
    name: 'Ananya Patel',
    email: 'ananya.p@example.com',
    section: 'ECE-B',
    status: 'checked-out',
    checkInTime: '17/08/2026, 09:30 AM',
    checkOutTime: '17/08/2026, 12:00 PM',
  },
  {
    id: 'HACK-1003',
    name: 'Rohan Verma',
    email: 'rohan.v@example.com',
    section: 'IT-C',
    status: 'registered',
    checkInTime: null,
    checkOutTime: null,
  }
];

export default function App() {
  const [participants, setParticipants] = useState(() => {
    const saved = localStorage.getItem('hackathon_unified_participants_v3');
    return saved ? JSON.parse(saved) : INITIAL_PARTICIPANTS;
  });

  const [activeTab, setActiveTab] = useState('registration'); // 'registration' | 'scanner' | 'dashboard'
  
  // Registration Form State
  const [formData, setFormData] = useState({ name: '', email: '', section: '' });
  const [registeredUser, setRegisteredUser] = useState(null);
  const [singleQrDataUrl, setSingleQrDataUrl] = useState(null);
  
  // Real Camera Scanner State
  const [isCameraRunning, setIsCameraRunning] = useState(false);
  const [cameraScanResult, setCameraScanResult] = useState(null);
  const [manualScanId, setManualScanId] = useState('');
  const html5QrCodeRef = useRef(null);

  // Dashboard Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Auto-sync state to localStorage
  useEffect(() => {
    localStorage.setItem('hackathon_unified_participants_v3', JSON.stringify(participants));
  }, [participants]);

  // Clean up camera scanner when switching tabs or unmounting
  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, [activeTab]);

  // Audio Beep Effect for Successful Scans
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.log('Audio not supported or blocked:', e);
    }
  };

  // Generate Single Unified QR Code for Participant
  const generateUnifiedQR = async (participantId, participantName) => {
    try {
      const payload = JSON.stringify({
        id: participantId,
        name: participantName,
        event: 'Hackathon-2026'
      });

      const qrData = await QRCode.toDataURL(payload, {
        width: 260,
        margin: 2,
        color: { dark: '#090d16', light: '#ffffff' },
        errorCorrectionLevel: 'H'
      });
      return qrData;
    } catch (err) {
      console.error('Failed to generate single QR:', err);
      return null;
    }
  };

  // Register New Participant
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.section.trim()) {
      alert('Please fill out all required fields.');
      return;
    }

    const newId = `HACK-${Math.floor(100000 + Math.random() * 900000)}`;
    const newParticipant = {
      id: newId,
      name: formData.name.trim(),
      email: formData.email.trim(),
      section: formData.section.trim(),
      status: 'registered',
      checkInTime: null,
      checkOutTime: null,
    };

    const qrUrl = await generateUnifiedQR(newId, newParticipant.name);
    
    setParticipants(prev => [newParticipant, ...prev]);
    setRegisteredUser(newParticipant);
    setSingleQrDataUrl(qrUrl);
    setFormData({ name: '', email: '', section: '' });

    // Celebration Confetti
    confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
  };

  // Smart Universal Attendance Scan Processor
  const processUniversalScan = (scannedText) => {
    let targetId = scannedText.trim();

    // Try parsing JSON payload if QR contains JSON
    try {
      if (scannedText.startsWith('{')) {
        const parsed = JSON.parse(scannedText);
        if (parsed.id) targetId = parsed.id;
      }
    } catch (e) {
      // Use raw text as fallback ID
    }

    const participant = participants.find(p => p.id.toUpperCase() === targetId.toUpperCase());

    if (!participant) {
      setCameraScanResult({
        type: 'error',
        title: 'Unknown QR Pass',
        message: `ID "${targetId}" was not found in the Hackathon database.`
      });
      return false;
    }

    const nowFormatted = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    playBeep();

    // Smart Access Control & State Transitions
    if (participant.status === 'registered') {
      // 1st Scan -> Check-In
      setParticipants(prev => prev.map(p => {
        if (p.id === participant.id) {
          return { ...p, status: 'checked-in', checkInTime: nowFormatted };
        }
        return p;
      }));

      setCameraScanResult({
        type: 'success',
        title: `✓ Checked-In: ${participant.name}`,
        message: `Section: ${participant.section} | Time: ${nowFormatted}`
      });

      confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
      return true;

    } else if (participant.status === 'checked-in') {
      // 2nd Scan -> Check-Out
      setParticipants(prev => prev.map(p => {
        if (p.id === participant.id) {
          return { ...p, status: 'checked-out', checkOutTime: nowFormatted };
        }
        return p;
      }));

      setCameraScanResult({
        type: 'success',
        title: `✓✓ Checked-Out: ${participant.name}`,
        message: `Attendance completed at ${nowFormatted}`
      });

      return true;

    } else if (participant.status === 'checked-out') {
      // Already completed
      setCameraScanResult({
        type: 'info',
        title: `Completed: ${participant.name}`,
        message: `Participant has already completed Check-In (${participant.checkInTime}) & Check-Out (${participant.checkOutTime}).`
      });
      return false;
    }
  };

  // Real Camera Scanner Controls
  const startCameraScanner = async () => {
    setCameraScanResult(null);
    setIsCameraRunning(true);

    setTimeout(async () => {
      try {
        if (!document.getElementById('camera-reader-element')) return;

        const html5QrCode = new Html5Qrcode('camera-reader-element');
        html5QrCodeRef.current = html5QrCode;

        let lastScannedText = '';
        let lastScanTime = 0;

        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            const now = Date.now();
            // Prevent rapid multi-scans of the same QR code within 3 seconds
            if (decodedText === lastScannedText && now - lastScanTime < 3000) {
              return;
            }
            lastScannedText = decodedText;
            lastScanTime = now;
            processUniversalScan(decodedText);
          },
          (errorMessage) => {
            // Ignore frame scan failures
          }
        );
      } catch (err) {
        console.error('Camera startup error:', err);
        setCameraScanResult({
          type: 'error',
          title: 'Camera Access Warning',
          message: 'Could not launch camera scanner. Ensure webcam permissions are granted or use the Simulator below.'
        });
        setIsCameraRunning(false);
      }
    }, 200);
  };

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (err) {
        console.error('Failed to stop camera scanner:', err);
      }
    }
    setIsCameraRunning(false);
  };

  // Export Attendance Roster to Excel
  const exportToExcel = () => {
    if (participants.length === 0) {
      alert('No attendance data available to export.');
      return;
    }

    const exportData = participants.map((p, idx) => ({
      'S.No': idx + 1,
      'Participant ID': p.id,
      'Full Name': p.name,
      'Email Address': p.email,
      'Class/Section': p.section,
      'Status': p.status.toUpperCase(),
      'Check-In Time': p.checkInTime || '-',
      'Check-Out Time': p.checkOutTime || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Roster');
    
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 15 },
      { wch: 22 },
      { wch: 26 },
      { wch: 16 },
      { wch: 14 },
      { wch: 22 },
      { wch: 22 },
    ];

    XLSX.writeFile(workbook, `Hackathon_Attendance_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // Manual Status Toggle in Admin Dashboard
  const toggleParticipantStatus = (participant) => {
    const nowFormatted = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    let newStatus, newCheckIn = participant.checkInTime, newCheckOut = participant.checkOutTime;

    if (participant.status === 'registered') {
      newStatus = 'checked-in';
      newCheckIn = nowFormatted;
    } else if (participant.status === 'checked-in') {
      newStatus = 'checked-out';
      newCheckOut = nowFormatted;
    } else {
      newStatus = 'registered';
      newCheckIn = null;
      newCheckOut = null;
    }

    setParticipants(prev => prev.map(p => {
      if (p.id === participant.id) {
        return { ...p, status: newStatus, checkInTime: newCheckIn, checkOutTime: newCheckOut };
      }
      return p;
    }));
  };

  const handleDeleteParticipant = (id) => {
    if (window.confirm('Delete this participant from the system?')) {
      setParticipants(prev => prev.filter(p => p.id !== id));
    }
  };

  // Stats Counters
  const stats = {
    total: participants.length,
    checkedIn: participants.filter(p => p.status === 'checked-in').length,
    checkedOut: participants.filter(p => p.status === 'checked-out').length,
    registered: participants.filter(p => p.status === 'registered').length,
  };

  // Filtered Roster for Dashboard
  const filteredParticipants = participants.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.section.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#090d16', color: '#f8fafc' }}>
      
      {/* Navbar Header */}
      <header className="glass-panel" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0, padding: '16px 32px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)' }}>
              <ScanLine style={{ width: '24px', height: '24px', color: '#fff' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 800, background: 'linear-gradient(90deg, #fff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                HACKPORTAL Universal
              </h1>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Single QR Pass & Real-Time Camera Gatekeeper</p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav style={{ display: 'flex', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setActiveTab('registration')}
              className={`btn ${activeTab === 'registration' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <UserPlus size={16} /> Issue QR Pass
            </button>
            <button
              onClick={() => setActiveTab('scanner')}
              className={`btn ${activeTab === 'scanner' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <Camera size={16} /> Real Camera Scanner
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <Users size={16} /> Attendance Roster
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '32px 20px' }}>

        {/* TAB 1: ISSUE SINGLE UNIFIED QR PASS */}
        {activeTab === 'registration' && (
          <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: registeredUser ? '1fr 1fr' : '1fr', gap: '32px', maxWidth: registeredUser ? '1100px' : '600px', margin: '0 auto' }}>
            
            {/* Registration Form */}
            <div className="glass-panel" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '10px', color: 'var(--primary)' }}>
                  <UserPlus size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Participant Registration</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Generate one common QR pass for Check-In & Check-Out</p>
                </div>
              </div>

              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter full name"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="your.email@domain.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Class / Section *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., CSE-A, ECE-B"
                    value={formData.section}
                    onChange={e => setFormData({ ...formData, section: e.target.value })}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '10px', width: '100%' }}>
                  <Sparkles size={18} /> Generate Universal QR Pass
                </button>
              </form>
            </div>

            {/* Generated Single QR Badge Card */}
            {registeredUser && singleQrDataUrl && (
              <div className="glass-panel glass-panel-glow print-area animate-fade-in" style={{ padding: '32px', textAlign: 'center', background: 'linear-gradient(180deg, rgba(18, 26, 43, 0.95) 0%, rgba(9, 13, 22, 0.95) 100%)' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '16px' }}>
                  <CheckCircle2 size={14} /> UNIVERSAL HACKATHON TICKET
                </div>

                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>{registeredUser.name}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 600, marginBottom: '4px' }}>Section: {registeredUser.section}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: '20px' }}>ID: {registeredUser.id}</p>

                {/* Single Common QR Code Image */}
                <div style={{ background: '#fff', padding: '16px', borderRadius: '16px', display: 'inline-block', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', marginBottom: '20px' }}>
                  <img src={singleQrDataUrl} alt="Common Participant QR Pass" style={{ width: '200px', height: '200px', display: 'block' }} />
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
                  This single QR pass handles both <strong>Check-In</strong> (1st scan) and <strong>Check-Out</strong> (2nd scan).
                </p>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <a
                    href={singleQrDataUrl}
                    download={`${registeredUser.name.replace(/\s+/g, '_')}_Hackathon_Pass.png`}
                    className="btn btn-secondary btn-sm"
                  >
                    <Download size={14} /> Save QR PNG
                  </a>
                  <button onClick={() => window.print()} className="btn btn-secondary btn-sm">
                    <Printer size={14} /> Print Badge
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: REAL CAMERA WEBCAM GATE SCANNER */}
        {activeTab === 'scanner' && (
          <div className="animate-fade-in" style={{ maxWidth: '750px', margin: '0 auto' }}>
            
            {/* Header Banner */}
            <div className="glass-panel" style={{ padding: '24px 32px', marginBottom: '24px', textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '50%', color: 'var(--primary)', marginBottom: '12px' }}>
                <Camera size={32} />
              </div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Real-Time Camera Gate Terminal</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Point any participant's single QR pass at the camera to automatically Check-In or Check-Out!
              </p>
            </div>

            {/* Real-time Scan Result Notification Card */}
            {cameraScanResult && (
              <div className="animate-fade-in" style={{
                padding: '16px 20px',
                borderRadius: '14px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                background: cameraScanResult.type === 'success' ? 'rgba(16, 185, 129, 0.15)' :
                            cameraScanResult.type === 'info' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                border: `1px solid ${cameraScanResult.type === 'success' ? 'rgba(16, 185, 129, 0.4)' :
                                     cameraScanResult.type === 'info' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`,
                color: cameraScanResult.type === 'success' ? '#10b981' :
                       cameraScanResult.type === 'info' ? '#60a5fa' : '#f43f5e'
              }}>
                <CheckCircle2 size={24} style={{ flexShrink: 0 }} />
                <div>
                  <h4 style={{ fontWeight: 800, fontSize: '0.95rem' }}>{cameraScanResult.title}</h4>
                  <p style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '2px' }}>{cameraScanResult.message}</p>
                </div>
              </div>
            )}

            {/* Live Camera Scanner Box */}
            <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', marginBottom: '24px' }}>
              {!isCameraRunning ? (
                <div style={{ padding: '40px 20px', border: '2px dashed var(--border-color)', borderRadius: '16px', background: 'rgba(15, 23, 42, 0.4)' }}>
                  <Camera size={52} style={{ color: 'var(--text-dim)', marginBottom: '14px' }} />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>Ready to Scan QR Passes</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                    Click below to open your device camera and scan physical/mobile QR passes
                  </p>
                  <button onClick={startCameraScanner} className="btn btn-primary btn-lg" style={{ padding: '14px 28px' }}>
                    <Camera size={20} /> Open Device Camera
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="pulse-glow" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span> Live Video Stream Active
                    </span>
                    <button onClick={stopCameraScanner} className="btn btn-danger btn-sm">
                      <StopCircle size={14} /> Stop Camera
                    </button>
                  </div>

                  <div id="camera-reader-element" style={{ width: '100%', maxWidth: '420px', margin: '0 auto', overflow: 'hidden', borderRadius: '16px', border: '2px solid var(--primary)', boxShadow: '0 0 25px rgba(99, 102, 241, 0.3)' }}></div>
                </div>
              )}
            </div>

            {/* Fallback Simulator */}
            <div className="glass-panel" style={{ padding: '24px 32px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                ⚡ Manual ID Scanner (Test Simulator)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Select a registered participant to simulate scanning their common QR pass:
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualScanId) {
                    processUniversalScan(manualScanId);
                    setManualScanId('');
                  }
                }}
                style={{ display: 'flex', gap: '12px' }}
              >
                <select
                  value={manualScanId}
                  onChange={e => setManualScanId(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">-- Select Participant from DB --</option>
                  {participants.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.id} - {p.name} ({p.status.toUpperCase()})
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={!manualScanId}
                  className="btn btn-primary"
                >
                  <ScanLine size={18} /> Simulate Scan
                </button>
              </form>
            </div>

          </div>
        )}

        {/* TAB 3: ORGANIZER DASHBOARD & ATTENDANCE ROSTER */}
        {activeTab === 'dashboard' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* Live Metrics Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              
              <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ padding: '12px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '12px', color: 'var(--primary)' }}>
                  <Users size={24} />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL PARTICIPANTS</p>
                  <h3 style={{ fontSize: '1.6rem', fontWeight: 800 }}>{stats.total}</h3>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '12px', color: 'var(--accent-emerald)' }}>
                  <LogIn size={24} />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>CURRENTLY CHECKED IN</p>
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

            {/* Attendance Roster Table */}
            <div className="glass-panel" style={{ padding: '28px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Live Attendance Roster</h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Real-time gate timestamps stored in application database</p>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Search input */}
                  <div style={{ position: 'relative', minWidth: '220px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                    <input
                      type="text"
                      placeholder="Search ID, name, section..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{ paddingLeft: '36px', height: '40px', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Status filter */}
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

                  {/* Excel Export Button */}
                  <button onClick={exportToExcel} className="btn btn-success btn-sm" style={{ height: '40px' }}>
                    <FileSpreadsheet size={16} /> Export to Excel (.xlsx)
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '14px 16px', fontWeight: '600' }}>ID</th>
                      <th style={{ padding: '14px 16px', fontWeight: '600' }}>PARTICIPANT</th>
                      <th style={{ padding: '14px 16px', fontWeight: '600' }}>SECTION</th>
                      <th style={{ padding: '14px 16px', fontWeight: '600' }}>STATUS</th>
                      <th style={{ padding: '14px 16px', fontWeight: '600' }}>CHECK-IN TIME</th>
                      <th style={{ padding: '14px 16px', fontWeight: '600' }}>CHECK-OUT TIME</th>
                      <th style={{ padding: '14px 16px', fontWeight: '600', textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)' }}>
                          No participant records found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredParticipants.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                            {p.id}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.name}</div>
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
                          <td style={{ padding: '14px 16px', color: p.checkInTime ? 'var(--accent-emerald)' : 'var(--text-dim)', fontSize: '0.8rem' }}>
                            {p.checkInTime || '-'}
                          </td>
                          <td style={{ padding: '14px 16px', color: p.checkOutTime ? 'var(--accent-rose)' : 'var(--text-dim)', fontSize: '0.8rem' }}>
                            {p.checkOutTime || '-'}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => processUniversalScan(p.id)}
                                className="btn btn-primary btn-sm"
                                title="Simulate Camera Scan"
                              >
                                <ScanLine size={14} /> Scan Pass
                              </button>
                              <button
                                onClick={() => toggleParticipantStatus(p)}
                                className="btn btn-secondary btn-sm"
                                title="Toggle Status"
                              >
                                <RefreshCw size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteParticipant(p.id)}
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
