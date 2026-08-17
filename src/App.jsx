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
  ShieldCheck,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

const INITIAL_PARTICIPANTS = [
  {
    id: 'PART-1001',
    name: 'Aarav Sharma',
    email: 'aarav.s@example.com',
    section: 'CSE-A',
    role: 'Full-Stack Developer',
    status: 'checked-in',
    checkInTime: '17/08/2026, 09:15 AM',
    checkOutTime: null,
  },
  {
    id: 'PART-1002',
    name: 'Ananya Patel',
    email: 'ananya.p@example.com',
    section: 'ECE-B',
    role: 'AI / ML Engineer',
    status: 'checked-out',
    checkInTime: '17/08/2026, 09:30 AM',
    checkOutTime: '17/08/2026, 12:00 PM',
  },
  {
    id: 'PART-1003',
    name: 'Rohan Verma',
    email: 'rohan.v@example.com',
    section: 'IT-C',
    role: 'UI/UX Designer',
    status: 'registered',
    checkInTime: null,
    checkOutTime: null,
  }
];

export default function App() {
  const [participants, setParticipants] = useState(() => {
    const saved = localStorage.getItem('hackathon_participants_v2');
    return saved ? JSON.parse(saved) : INITIAL_PARTICIPANTS;
  });

  const [activeTab, setActiveTab] = useState('registration'); // 'registration' | 'scanner' | 'dashboard'
  
  // Registration State
  const [formData, setFormData] = useState({ name: '', email: '', section: '', role: 'Developer' });
  const [registeredUser, setRegisteredUser] = useState(null);
  const [qrBadgeData, setQrBadgeData] = useState(null);
  
  // Scanner State
  const [scanType, setScanType] = useState('check-in'); // 'check-in' | 'check-out'
  const [manualInputId, setManualInputId] = useState('');
  const [scanNotification, setScanNotification] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const qrReaderRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // Dashboard Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('hackathon_participants_v2', JSON.stringify(participants));
  }, [participants]);

  // Clean up camera scanner on unmount or tab change
  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, [activeTab]);

  // Generate QR Code Data URLs
  const generateParticipantQRs = async (participantId) => {
    try {
      const payload = JSON.stringify({ id: participantId, app: 'HackathonPortal' });
      const qrDataUrl = await QRCode.toDataURL(payload, {
        width: 260,
        margin: 2,
        color: { dark: '#090d16', light: '#ffffff' },
        errorCorrectionLevel: 'H'
      });
      return qrDataUrl;
    } catch (err) {
      console.error('Failed to generate QR:', err);
      return null;
    }
  };

  // Handle Form Registration
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.section.trim()) {
      alert('Please fill out all required fields.');
      return;
    }

    const newId = `PART-${Math.floor(1000 + Math.random() * 9000)}`;
    const newParticipant = {
      id: newId,
      name: formData.name.trim(),
      email: formData.email.trim(),
      section: formData.section.trim(),
      role: formData.role,
      status: 'registered',
      checkInTime: null,
      checkOutTime: null,
    };

    const qrUrl = await generateParticipantQRs(newId);
    
    setParticipants(prev => [newParticipant, ...prev]);
    setRegisteredUser(newParticipant);
    setQrBadgeData(qrUrl);
    setFormData({ name: '', email: '', section: '', role: 'Developer' });

    // Trigger celebratory confetti
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  // Check-In / Check-Out Logic
  const processAttendanceScan = (participantId, actionType) => {
    const participant = participants.find(p => p.id.toUpperCase() === participantId.trim().toUpperCase());
    
    if (!participant) {
      setScanNotification({
        type: 'error',
        message: `Participant ID "${participantId}" not found in database.`
      });
      return false;
    }

    const nowFormatted = new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    if (actionType === 'check-in') {
      if (participant.status === 'checked-in') {
        setScanNotification({
          type: 'warning',
          message: `${participant.name} is ALREADY checked in! (Check-in time: ${participant.checkInTime})`
        });
        return false;
      }

      setParticipants(prev => prev.map(p => {
        if (p.id === participant.id) {
          return { ...p, status: 'checked-in', checkInTime: nowFormatted };
        }
        return p;
      }));

      setScanNotification({
        type: 'success',
        message: `✓ Check-In SUCCESSFUL for ${participant.name} (${participant.section}) at ${nowFormatted}`
      });

      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      return true;

    } else if (actionType === 'check-out') {
      if (participant.status !== 'checked-in') {
        setScanNotification({
          type: 'warning',
          message: `Cannot check out! ${participant.name} has not checked in yet.`
        });
        return false;
      }

      setParticipants(prev => prev.map(p => {
        if (p.id === participant.id) {
          return { ...p, status: 'checked-out', checkOutTime: nowFormatted };
        }
        return p;
      }));

      setScanNotification({
        type: 'success',
        message: `✓ Check-Out SUCCESSFUL for ${participant.name} at ${nowFormatted}`
      });
      return true;
    }
  };

  // Camera QR Scanner Controls
  const startCameraScanner = async () => {
    setScanNotification(null);
    setIsCameraActive(true);
    
    setTimeout(async () => {
      try {
        if (!document.getElementById('qr-reader-container')) return;
        
        const html5QrCode = new Html5Qrcode('qr-reader-container');
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            try {
              let parsedId = decodedText;
              if (decodedText.startsWith('{')) {
                const parsed = JSON.parse(decodedText);
                parsedId = parsed.id || decodedText;
              }
              processAttendanceScan(parsedId, scanType);
            } catch (err) {
              processAttendanceScan(decodedText, scanType);
            }
          },
          (errorMessage) => {
            // Ignore scan attempt warnings
          }
        );
      } catch (err) {
        console.error('Camera access error:', err);
        setScanNotification({
          type: 'error',
          message: 'Unable to access camera. Please use the Manual ID Scan simulator below or grant camera permissions.'
        });
        setIsCameraActive(false);
      }
    }, 200);
  };

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (err) {
        console.error('Failed to stop camera:', err);
      }
    }
    setIsCameraActive(false);
  };

  // Export Data to Excel
  const exportToExcel = () => {
    if (participants.length === 0) {
      alert('No participant records to export.');
      return;
    }

    const data = participants.map((p, index) => ({
      'S.No': index + 1,
      'Participant ID': p.id,
      'Full Name': p.name,
      'Email Address': p.email,
      'Class/Section': p.section,
      'Role': p.role || 'Participant',
      'Status': p.status.toUpperCase(),
      'Check-In Time': p.checkInTime || 'N/A',
      'Check-Out Time': p.checkOutTime || 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Records');

    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 15 },
      { wch: 22 },
      { wch: 26 },
      { wch: 15 },
      { wch: 18 },
      { wch: 14 },
      { wch: 22 },
      { wch: 22 },
    ];

    XLSX.writeFile(workbook, `Hackathon_Attendance_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // Delete participant
  const handleDeleteParticipant = (id) => {
    if (window.confirm('Are you sure you want to delete this participant?')) {
      setParticipants(prev => prev.filter(p => p.id !== id));
    }
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

  // Stats Counters
  const stats = {
    total: participants.length,
    checkedIn: participants.filter(p => p.status === 'checked-in').length,
    checkedOut: participants.filter(p => p.status === 'checked-out').length,
    registered: participants.filter(p => p.status === 'registered').length,
  };

  // Filtered Participants List for Dashboard
  const filteredParticipants = participants.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.section.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header className="glass-panel" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0, padding: '16px 32px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)' }}>
              <Sparkles style={{ width: '24px', height: '24px', color: '#fff' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, background: 'linear-gradient(90deg, #fff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em' }}>
                HACKPORTAL Pro
              </h1>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Smart Attendance & Digital Gatekeeping System
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav style={{ display: 'flex', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setActiveTab('registration')}
              className={`btn ${activeTab === 'registration' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <UserPlus size={16} /> Register Participant
            </button>
            <button
              onClick={() => setActiveTab('scanner')}
              className={`btn ${activeTab === 'scanner' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <Camera size={16} /> Live Gate Scanner
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <Users size={16} /> Organizer Dashboard
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '32px 20px' }}>
        
        {/* TAB 1: REGISTRATION */}
        {activeTab === 'registration' && (
          <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: registeredUser ? '1fr 1fr' : '1fr', gap: '32px', maxWidth: registeredUser ? '1100px' : '620px', margin: '0 auto' }}>
            
            {/* Registration Form */}
            <div className="glass-panel" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '10px', color: 'var(--primary)' }}>
                  <UserPlus size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Participant Registration</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Generate instant QR Event Pass with digital badge</p>
                </div>
              </div>

              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Morgan"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="alex@university.edu"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Class / Section *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CSE-A, ECE-3"
                      value={formData.section}
                      onChange={e => setFormData({ ...formData, section: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Hackathon Role</label>
                    <select
                      value={formData.role}
                      onChange={e => setFormData({ ...formData, role: e.target.value })}
                    >
                      <option value="Developer">Full-Stack Dev</option>
                      <option value="AI Engineer">AI / ML Engineer</option>
                      <option value="UI/UX Designer">UI/UX Designer</option>
                      <option value="Cybersecurity">Cybersecurity</option>
                      <option value="Data Scientist">Data Scientist</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '12px', width: '100%' }}>
                  <Sparkles size={18} /> Issue Digital QR Event Pass
                </button>
              </form>
            </div>

            {/* Generated QR Pass Preview Card */}
            {registeredUser && qrBadgeData && (
              <div className="glass-panel glass-panel-glow print-area animate-fade-in" style={{ padding: '32px', textAlign: 'center', background: 'linear-gradient(180deg, rgba(18, 26, 43, 0.95) 0%, rgba(9, 13, 22, 0.95) 100%)' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '16px' }}>
                  <CheckCircle2 size={14} /> REGISTRATION CONFIRMED
                </div>

                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>{registeredUser.name}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 600, marginBottom: '4px' }}>{registeredUser.role} • {registeredUser.section}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: '20px' }}>ID: {registeredUser.id}</p>

                {/* QR Code Container */}
                <div style={{ background: '#fff', padding: '16px', borderRadius: '16px', display: 'inline-block', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', marginBottom: '20px' }}>
                  <img src={qrBadgeData} alt="Participant QR Badge" style={{ width: '200px', height: '200px', display: 'block' }} />
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
                  Show this QR code at the Gate Check-In counter upon arrival.
                </p>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <a
                    href={qrBadgeData}
                    download={`${registeredUser.name.replace(/\s+/g, '_')}_Hackathon_QR.png`}
                    className="btn btn-secondary btn-sm"
                  >
                    <Download size={14} /> Download QR PNG
                  </a>
                  <button onClick={() => window.print()} className="btn btn-secondary btn-sm">
                    <Printer size={14} /> Print Pass
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LIVE GATE SCANNER */}
        {activeTab === 'scanner' && (
          <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
            
            {/* Mode Switcher Banner */}
            <div className="glass-panel" style={{ padding: '20px 28px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Gate Scan Terminal</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Scan participant QR passes to log timestamps</p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => { setScanType('check-in'); setScanNotification(null); }}
                  className={`btn ${scanType === 'check-in' ? 'btn-success' : 'btn-secondary'}`}
                  style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                >
                  <LogIn size={16} /> Mode: CHECK-IN
                </button>
                <button
                  onClick={() => { setScanType('check-out'); setScanNotification(null); }}
                  className={`btn ${scanType === 'check-out' ? 'btn-danger' : 'btn-secondary'}`}
                  style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                >
                  <LogOut size={16} /> Mode: CHECK-OUT
                </button>
              </div>
            </div>

            {/* Notification Banner */}
            {scanNotification && (
              <div className="animate-fade-in" style={{
                padding: '14px 20px',
                borderRadius: '12px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '0.9rem',
                fontWeight: '600',
                background: scanNotification.type === 'success' ? 'rgba(16, 185, 129, 0.15)' :
                            scanNotification.type === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                border: `1px solid ${scanNotification.type === 'success' ? 'rgba(16, 185, 129, 0.3)' :
                                     scanNotification.type === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                color: scanNotification.type === 'success' ? '#10b981' :
                       scanNotification.type === 'warning' ? '#f59e0b' : '#f43f5e'
              }}>
                {scanNotification.type === 'success' && <CheckCircle2 size={20} />}
                {scanNotification.type === 'warning' && <AlertCircle size={20} />}
                {scanNotification.type === 'error' && <AlertCircle size={20} />}
                <span>{scanNotification.message}</span>
              </div>
            )}

            {/* Camera View Area */}
            <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '16px' }}>
                📷 Webcam Live QR Reader
              </h3>

              {!isCameraActive ? (
                <div style={{ padding: '40px 20px', border: '2px dashed var(--border-color)', borderRadius: '16px', background: 'rgba(15, 23, 42, 0.4)' }}>
                  <Camera size={48} style={{ color: 'var(--text-dim)', marginBottom: '12px' }} />
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Click below to start live camera scanning for gate passes
                  </p>
                  <button onClick={startCameraScanner} className="btn btn-primary">
                    <Camera size={18} /> Start Camera Scanner
                  </button>
                </div>
              ) : (
                <div>
                  <div id="qr-reader-container" style={{ width: '100%', maxWidth: '400px', margin: '0 auto', overflow: 'hidden', borderRadius: '12px', border: '2px solid var(--primary)' }}></div>
                  <button onClick={stopCameraScanner} className="btn btn-secondary btn-sm" style={{ marginTop: '16px' }}>
                    Stop Camera
                  </button>
                </div>
              )}
            </div>

            {/* Manual ID Scan Simulator */}
            <div className="glass-panel" style={{ padding: '24px 32px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                ⚡ Manual ID Gate Scanner (Simulator)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Type or select a participant ID below to simulate barcode/QR gate scanning:
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualInputId) {
                    processAttendanceScan(manualInputId, scanType);
                    setManualInputId('');
                  }
                }}
                style={{ display: 'flex', gap: '12px' }}
              >
                <select
                  value={manualInputId}
                  onChange={e => setManualInputId(e.target.value)}
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
                  disabled={!manualInputId}
                  className={`btn ${scanType === 'check-in' ? 'btn-success' : 'btn-danger'}`}
                >
                  {scanType === 'check-in' ? <LogIn size={18} /> : <LogOut size={18} />}
                  Simulate {scanType.toUpperCase()}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: ORGANIZER DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* Top Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              
              <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ padding: '12px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '12px', color: 'var(--primary)' }}>
                  <Users size={24} />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL REGISTERED</p>
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

            {/* Attendance Table Card */}
            <div className="glass-panel" style={{ padding: '28px' }}>
              
              {/* Table Controls Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Attendance Roster</h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Manage participant check-in statuses and export live data</p>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Search Bar */}
                  <div style={{ position: 'relative', minWidth: '220px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                    <input
                      type="text"
                      placeholder="Search name, email, section..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{ paddingLeft: '36px', height: '40px', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Filter Dropdown */}
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

              {/* Table Render */}
              <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '14px 16px', fontWeight: 600 }}>ID</th>
                      <th style={{ padding: '14px 16px', fontWeight: 600 }}>PARTICIPANT</th>
                      <th style={{ padding: '14px 16px', fontWeight: 600 }}>SECTION</th>
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
                          No participant records found matching filter.
                        </td>
                      </tr>
                    ) : (
                      filteredParticipants.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}>
                          <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                            {p.id}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.email} • <span style={{ color: 'var(--accent-cyan)' }}>{p.role}</span></div>
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
                                onClick={() => toggleParticipantStatus(p)}
                                className="btn btn-secondary btn-sm"
                                title="Toggle Status"
                              >
                                <RefreshCw size={14} /> Toggle
                              </button>
                              <button
                                onClick={() => handleDeleteParticipant(p.id)}
                                className="btn btn-danger btn-sm"
                                title="Delete"
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
