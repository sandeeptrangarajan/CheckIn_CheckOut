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
  ArrowRight,
  ShieldCheck
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
  }
];

export default function App() {
  const [participants, setParticipants] = useState(() => {
    const saved = localStorage.getItem('hackathon_step_flow_participants_v4');
    return saved ? JSON.parse(saved) : INITIAL_PARTICIPANTS;
  });

  // Registration & Active User State
  const [formData, setFormData] = useState({ name: '', email: '', section: '' });
  const [activeParticipant, setActiveParticipant] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(null);
  const [scanMessage, setScanMessage] = useState(null);

  // Real Camera Scanner State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const html5QrCodeRef = useRef(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Auto-sync state to localStorage
  useEffect(() => {
    localStorage.setItem('hackathon_step_flow_participants_v4', JSON.stringify(participants));
  }, [participants]);

  // Clean up camera scanner
  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, []);

  // Audio Beep Effect
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  };

  // STEP 1: Enter Details & Generate Particular QR Code
  const handleRegisterAndGenerateQR = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.section.trim()) {
      alert('Please fill in all details (Name, Email, Section).');
      return;
    }

    const userId = `HACK-${Math.floor(100000 + Math.random() * 900000)}`;
    const newParticipant = {
      id: userId,
      name: formData.name.trim(),
      email: formData.email.trim(),
      section: formData.section.trim(),
      status: 'registered', // 'registered' -> 1st scan 'checked-in' -> 2nd scan 'checked-out'
      checkInTime: null,
      checkOutTime: null,
    };

    // Generate particular QR code for this participant
    try {
      const qrPayload = JSON.stringify({
        id: userId,
        name: newParticipant.name,
        section: newParticipant.section
      });

      const dataUrl = await QRCode.toDataURL(qrPayload, {
        width: 250,
        margin: 2,
        color: { dark: '#090d16', light: '#ffffff' },
        errorCorrectionLevel: 'H'
      });

      setParticipants(prev => [newParticipant, ...prev]);
      setActiveParticipant(newParticipant);
      setQrCodeDataUrl(dataUrl);
      setFormData({ name: '', email: '', section: '' });
      setScanMessage({
        type: 'info',
        text: `Particular QR Pass generated for ${newParticipant.name}. Ready for 1st Scan (Check-In).`
      });

      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
    } catch (err) {
      console.error('Failed to generate QR:', err);
      alert('Error generating QR code.');
    }
  };

  // STEP 2: Scan Logic (1st Scan = Check-In, 2nd Scan = Check-Out)
  const processScanLogic = (scannedId) => {
    let targetId = scannedId.trim();
    try {
      if (scannedId.startsWith('{')) {
        const parsed = JSON.parse(scannedId);
        targetId = parsed.id || scannedId;
      }
    } catch (e) {}

    const participant = participants.find(p => p.id.toUpperCase() === targetId.toUpperCase());

    if (!participant) {
      setScanMessage({
        type: 'error',
        text: `Participant ID "${targetId}" not found.`
      });
      return;
    }

    const nowFormatted = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    playBeep();

    if (participant.status === 'registered') {
      // FIRST SCAN -> MARK AS CHECKED-IN
      const updatedParticipant = {
        ...participant,
        status: 'checked-in',
        checkInTime: nowFormatted,
      };

      setParticipants(prev => prev.map(p => p.id === participant.id ? updatedParticipant : p));
      if (activeParticipant && activeParticipant.id === participant.id) {
        setActiveParticipant(updatedParticipant);
      }

      setScanMessage({
        type: 'check-in',
        text: `✓ 1st Scan Detected: ${participant.name} is now CHECKED-IN at ${nowFormatted}`
      });

      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });

    } else if (participant.status === 'checked-in') {
      // SECOND SCAN -> MARK AS CHECKED-OUT
      const updatedParticipant = {
        ...participant,
        status: 'checked-out',
        checkOutTime: nowFormatted,
      };

      setParticipants(prev => prev.map(p => p.id === participant.id ? updatedParticipant : p));
      if (activeParticipant && activeParticipant.id === participant.id) {
        setActiveParticipant(updatedParticipant);
      }

      setScanMessage({
        type: 'check-out',
        text: `✓✓ 2nd Scan Detected: ${participant.name} is now CHECKED-OUT at ${nowFormatted}`
      });

    } else if (participant.status === 'checked-out') {
      // ALREADY COMPLETED
      setScanMessage({
        type: 'warning',
        text: `ℹ ${participant.name} has already completed both Check-In (${participant.checkInTime}) & Check-Out (${participant.checkOutTime}).`
      });
    }
  };

  // Real Camera Scanner Controls
  const startCameraScanner = async () => {
    setIsCameraActive(true);
    setTimeout(async () => {
      try {
        if (!document.getElementById('real-camera-scanner-view')) return;
        const html5QrCode = new Html5Qrcode('real-camera-scanner-view');
        html5QrCodeRef.current = html5QrCode;

        let lastScanned = '';
        let lastTime = 0;

        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            const now = Date.now();
            if (decodedText === lastScanned && now - lastTime < 3000) return;
            lastScanned = decodedText;
            lastTime = now;
            processScanLogic(decodedText);
          },
          (err) => {}
        );
      } catch (err) {
        console.error('Camera failed to start:', err);
        setIsCameraActive(false);
      }
    }, 200);
  };

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (err) {}
    }
    setIsCameraActive(false);
  };

  // STEP 3: Export Attendance to Excel (.xlsx)
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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Records');

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

  const handleDelete = (id) => {
    if (window.confirm('Delete this record?')) {
      setParticipants(prev => prev.filter(p => p.id !== id));
      if (activeParticipant && activeParticipant.id === id) {
        setActiveParticipant(null);
        setQrCodeDataUrl(null);
      }
    }
  };

  const filteredParticipants = participants.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.section.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#090d16', color: '#f8fafc', fontFamily: 'var(--font-sans)' }}>
      
      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', padding: '28px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, background: 'linear-gradient(90deg, #fff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
          🚀 Hackathon Check-In & Check-Out Portal
        </h1>
        <p style={{ fontSize: '0.88rem', color: '#a5b4fc', marginTop: '6px' }}>
          Step-by-Step Details Registration ➔ Particular QR Pass ➔ 1st Scan Check-In ➔ 2nd Scan Check-Out
        </p>
      </header>

      <main style={{ maxWidth: '1140px', margin: '0 auto', padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* SECTION 1: STEP 1 - ENTER DETAILS */}
        <section className="glass-panel" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderRadius: '20px', fontWeight: 800, fontSize: '0.85rem' }}>
              STEP 1
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Enter Participant Details</h2>
          </div>

          <form onSubmit={handleRegisterAndGenerateQR} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Aarav Sharma"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Email Address *</label>
              <input
                type="email"
                required
                placeholder="aarav@university.edu"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Class / Section *</label>
              <input
                type="text"
                required
                placeholder="e.g. CSE-A, ECE-2"
                value={formData.section}
                onChange={e => setFormData({ ...formData, section: e.target.value })}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ height: '44px', fontWeight: 700 }}>
              Generate Particular QR Code <ArrowRight size={18} />
            </button>
          </form>
        </section>

        {/* SECTION 2: STEP 2 - PARTICULAR QR PASS CARD & SCANNER */}
        {activeParticipant && qrCodeDataUrl && (
          <section className="glass-panel glass-panel-glow animate-fade-in" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '20px', fontWeight: 800, fontSize: '0.85rem', color: '#fff' }}>
                STEP 2
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Particular QR Pass & Gate Scanner</h2>
            </div>

            {/* Notification Banner */}
            {scanMessage && (
              <div style={{
                padding: '14px 20px',
                borderRadius: '12px',
                marginBottom: '24px',
                fontWeight: 700,
                fontSize: '0.9rem',
                background: scanMessage.type === 'check-in' ? 'rgba(16, 185, 129, 0.2)' :
                            scanMessage.type === 'check-out' ? 'rgba(244, 63, 94, 0.2)' :
                            scanMessage.type === 'error' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                color: scanMessage.type === 'check-in' ? '#10b981' :
                       scanMessage.type === 'check-out' ? '#f43f5e' :
                       scanMessage.type === 'error' ? '#f43f5e' : '#818cf8',
                border: `1px solid ${scanMessage.type === 'check-in' ? 'rgba(16, 185, 129, 0.4)' :
                                     scanMessage.type === 'check-out' ? 'rgba(244, 63, 94, 0.4)' : 'rgba(99, 102, 241, 0.4)'}`
              }}>
                {scanMessage.text}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px', alignItems: 'center' }}>
              
              {/* Particular Generated QR Pass */}
              <div style={{ backgroundColor: '#090d16', padding: '24px', borderRadius: '16px', border: '2px solid var(--border-color)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)', letterSpacing: '1px' }}>
                  PARTICULAR PASS FOR
                </span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: '4px 0 2px 0' }}>{activeParticipant.name}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  ID: <strong style={{ color: '#38bdf8' }}>{activeParticipant.id}</strong> | Section: <strong>{activeParticipant.section}</strong>
                </p>

                {/* Status Indicator */}
                <div style={{ marginBottom: '20px' }}>
                  <span style={{
                    padding: '6px 16px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    background: activeParticipant.status === 'registered' ? 'rgba(245, 158, 11, 0.2)' :
                                activeParticipant.status === 'checked-in' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                    color: activeParticipant.status === 'registered' ? '#f59e0b' :
                           activeParticipant.status === 'checked-in' ? '#10b981' : '#f43f5e',
                    border: `1px solid ${activeParticipant.status === 'registered' ? 'rgba(245, 158, 11, 0.4)' :
                                         activeParticipant.status === 'checked-in' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`
                  }}>
                    {activeParticipant.status === 'registered' && '⏳ Status: Registered (Ready for 1st Scan)'}
                    {activeParticipant.status === 'checked-in' && '✓ Status: CHECKED-IN (Ready for 2nd Scan)'}
                    {activeParticipant.status === 'checked-out' && '✓✓ Status: CHECKED-OUT (Completed)'}
                  </span>
                </div>

                {/* QR Code Graphic */}
                <div style={{ background: '#fff', padding: '14px', borderRadius: '14px', display: 'inline-block', marginBottom: '20px' }}>
                  <img src={qrCodeDataUrl} alt="Particular Participant QR" style={{ width: '200px', height: '200px', display: 'block' }} />
                </div>

                {/* Scan Button (Simulates Scanning 1st for Check-In, 2nd for Check-Out) */}
                <button
                  onClick={() => processScanLogic(activeParticipant.id)}
                  disabled={activeParticipant.status === 'checked-out'}
                  className={`btn ${activeParticipant.status === 'registered' ? 'btn-success' : activeParticipant.status === 'checked-in' ? 'btn-danger' : 'btn-secondary'}`}
                  style={{ width: '100%', padding: '12px 20px' }}
                >
                  {activeParticipant.status === 'registered' && <><LogIn size={18} /> Scan QR Pass (1st Scan = Check-In)</>}
                  {activeParticipant.status === 'checked-in' && <><LogOut size={18} /> Scan QR Pass (2nd Scan = Check-Out)</>}
                  {activeParticipant.status === 'checked-out' && <>✓ Both Scans Completed</>}
                </button>

                {/* Timestamps */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '20px', textAlign: 'left', fontSize: '0.78rem' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <div style={{ fontWeight: 700, color: '#10b981', marginBottom: '2px' }}>IN TIME</div>
                    <div style={{ color: activeParticipant.checkInTime ? '#34d399' : 'var(--text-dim)' }}>
                      {activeParticipant.checkInTime || 'Pending 1st Scan'}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(244, 63, 94, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                    <div style={{ fontWeight: 700, color: '#f43f5e', marginBottom: '2px' }}>OUT TIME</div>
                    <div style={{ color: activeParticipant.checkOutTime ? '#f87171' : 'var(--text-dim)' }}>
                      {activeParticipant.checkOutTime || 'Pending 2nd Scan'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Real Camera Scanner Box */}
              <div style={{ backgroundColor: '#090d16', padding: '24px', borderRadius: '16px', border: '2px solid var(--border-color)', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>📷 Live Camera Gate Scanner</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  Point physical or mobile phone QR passes to the camera
                </p>

                {!isCameraActive ? (
                  <div style={{ padding: '36px 20px', border: '2px dashed var(--border-color)', borderRadius: '12px' }}>
                    <Camera size={44} style={{ color: 'var(--text-dim)', marginBottom: '12px' }} />
                    <button onClick={startCameraScanner} className="btn btn-primary" style={{ width: '100%' }}>
                      <Camera size={18} /> Start Real Camera
                    </button>
                  </div>
                ) : (
                  <div>
                    <button onClick={stopCameraScanner} className="btn btn-danger btn-sm" style={{ marginBottom: '14px' }}>
                      <StopCircle size={14} /> Stop Camera
                    </button>
                    <div id="real-camera-scanner-view" style={{ width: '100%', maxWidth: '360px', margin: '0 auto', borderRadius: '12px', border: '2px solid var(--primary)' }}></div>
                  </div>
                )}
              </div>

            </div>
          </section>
        )}

        {/* SECTION 3: STEP 3 - ATTENDANCE TRACKING & EXCEL EXPORT */}
        <section className="glass-panel" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', borderRadius: '20px', fontWeight: 800, fontSize: '0.85rem', color: '#fff' }}>
                STEP 3
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Live Attendance Tracking Roster</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Total: {participants.length} | In: <strong style={{ color: '#10b981' }}>{participants.filter(p => p.status === 'checked-in').length}</strong> | Out: <strong style={{ color: '#f43f5e' }}>{participants.filter(p => p.status === 'checked-out').length}</strong>
                </p>
              </div>
            </div>

            <button onClick={exportToExcel} className="btn btn-success" style={{ height: '42px', fontWeight: 700 }}>
              <FileSpreadsheet size={18} /> Export to Excel (.xlsx)
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '14px 16px', fontWeight: 600 }}>ID</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600 }}>NAME</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600 }}>SECTION</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600 }}>STATUS</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600 }}>1ST SCAN (IN)</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600 }}>2ND SCAN (OUT)</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
                      No participants in system yet.
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
                      <td style={{ padding: '14px 16px', color: p.checkInTime ? '#34d399' : 'var(--text-dim)', fontSize: '0.8rem' }}>
                        {p.checkInTime || 'Pending'}
                      </td>
                      <td style={{ padding: '14px 16px', color: p.checkOutTime ? '#f87171' : 'var(--text-dim)', fontSize: '0.8rem' }}>
                        {p.checkOutTime || 'Pending'}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          {p.status !== 'checked-out' && (
                            <button
                              onClick={() => processScanLogic(p.id)}
                              className={`btn btn-sm ${p.status === 'registered' ? 'btn-success' : 'btn-danger'}`}
                            >
                              {p.status === 'registered' ? 'Scan In' : 'Scan Out'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(p.id)}
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
        </section>

      </main>
    </div>
  );
}
