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
  Upload
} from 'lucide-react';

const COMMON_EVENT_QR_PAYLOAD = 'HACKATHON-GATE-2026';

const INITIAL_PARTICIPANTS = [
  {
    id: 'USER-1001',
    name: 'Aarav Sharma',
    email: 'aarav.s@example.com',
    section: 'CSE-A',
    status: 'checked-in',
    checkInTime: '17/08/2026, 09:15 AM',
    checkOutTime: null,
  },
  {
    id: 'USER-1002',
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
    const saved = localStorage.getItem('hackathon_manual_excel_v9');
    return saved ? JSON.parse(saved) : INITIAL_PARTICIPANTS;
  });

  const [activeTab, setActiveTab] = useState('register'); // 'register' | 'scanner' | 'admin'

  // Registration Form State
  const [formData, setFormData] = useState({ name: '', email: '', section: '' });
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

  // Auto-sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem('hackathon_manual_excel_v9', JSON.stringify(participants));
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

  // Manual Export to Excel (NO AUTOMATIC EXPORT DOWNLOADS)
  const exportToExcelManual = () => {
    if (participants.length === 0) {
      alert('No participant records to export.');
      return;
    }

    const exportData = participants.map((p, idx) => ({
      'S.No': idx + 1,
      'User ID': p.id,
      'Full Name': p.name,
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

  // 1 & 2. Details Entry -> Switch to Scanner Terminal
  const handleRegisterUser = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.section.trim()) {
      alert('Please fill out all details.');
      return;
    }

    const userId = `USER-${Math.floor(1000 + Math.random() * 9000)}`;
    const newUser = {
      id: userId,
      name: formData.name.trim(),
      email: formData.email.trim(),
      section: formData.section.trim(),
      status: 'registered',
      checkInTime: null,
      checkOutTime: null,
    };

    setParticipants(prev => [newUser, ...prev]);
    setActiveUser(newUser);
    setFormData({ name: '', email: '', section: '' });
    
    setActiveTab('scanner');
    setScanNotice({
      type: 'info',
      title: `Registered: ${newUser.name}`,
      message: `Scanner terminal ready. Scan the common QR code to Check-In.`
    });

    confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
  };

  // Core Scan Transition Logic (1st scan = Check-In, 2nd scan = Check-Out)
  const processScanForUser = (targetUserId) => {
    const userToUpdate = participants.find(p => p.id === targetUserId) || activeUser;
    if (!userToUpdate) {
      setScanNotice({
        type: 'error',
        title: 'No User Selected',
        message: 'Please register or select a user from the dropdown first.'
      });
      return;
    }

    const nowFormatted = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    playBeep();

    if (userToUpdate.status === 'registered') {
      // 1st SCAN -> CHECK-IN
      const updated = {
        ...userToUpdate,
        status: 'checked-in',
        checkInTime: nowFormatted,
      };

      setParticipants(prev => prev.map(p => p.id === userToUpdate.id ? updated : p));
      setActiveUser(updated);

      setScanNotice({
        type: 'check-in',
        title: `✓ 1st Scan: CHECKED-IN`,
        message: `${userToUpdate.name} (${userToUpdate.section}) checked in at ${nowFormatted}`
      });

      confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });

    } else if (userToUpdate.status === 'checked-in') {
      // 2nd SCAN -> CHECK-OUT
      const updated = {
        ...userToUpdate,
        status: 'checked-out',
        checkOutTime: nowFormatted,
      };

      setParticipants(prev => prev.map(p => p.id === userToUpdate.id ? updated : p));
      setActiveUser(updated);

      setScanNotice({
        type: 'check-out',
        title: `✓✓ 2nd Scan: CHECKED-OUT`,
        message: `${userToUpdate.name} checked out at ${nowFormatted}`
      });

    } else if (userToUpdate.status === 'checked-out') {
      setScanNotice({
        type: 'warning',
        title: `ℹ Attendance Completed`,
        message: `${userToUpdate.name} has already completed Check-In (${userToUpdate.checkInTime}) & Check-Out (${userToUpdate.checkOutTime}).`
      });
    }
  };

  // Robust Camera Scanner Startup using Html5Qrcode
  const startCameraScanner = async () => {
    setCameraError(null);
    setIsCameraActive(true);

    setTimeout(async () => {
      try {
        const container = document.getElementById('camera-stream-div');
        if (!container) return;

        // Clean up any existing instances
        if (html5QrCodeRef.current) {
          try {
            await html5QrCodeRef.current.stop();
          } catch (e) {}
        }

        const html5QrCode = new Html5Qrcode('camera-stream-div');
        html5QrCodeRef.current = html5QrCode;

        let lastScanTime = 0;

        // Get available cameras
        const devices = await Html5Qrcode.getCameras();
        let cameraId = { facingMode: 'environment' };

        if (devices && devices.length > 0) {
          // Prefer back camera if available
          const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'));
          cameraId = backCamera ? backCamera.id : devices[0].id;
        }

        await html5QrCode.start(
          cameraId,
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            const now = Date.now();
            if (now - lastScanTime < 2500) return; // Prevent duplicate rapid scans
            lastScanTime = now;

            if (activeUser) {
              processScanForUser(activeUser.id);
            } else {
              setScanNotice({
                type: 'info',
                title: 'QR Code Scanned',
                message: 'Scan detected! Please select a user below to log attendance.'
              });
            }
          },
          (errorMessage) => {
            // Ignore scan attempt frame failures
          }
        );
      } catch (err) {
        console.error('Webcam initialization failed:', err);
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
      } catch (err) {
        console.error('Camera stop error:', err);
      }
      html5QrCodeRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Scan QR Code Image File Upload (Fallback for hardware blocked cameras)
  const handleFileUploadScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const html5QrCode = new Html5Qrcode('camera-stream-div-hidden');
      const decodedText = await html5QrCode.scanFile(file, true);
      if (activeUser) {
        processScanForUser(activeUser.id);
      } else {
        alert(`QR Code Scanned: ${decodedText}`);
      }
    } catch (err) {
      alert('Could not decode QR code from selected image file.');
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this record?')) {
      setParticipants(prev => prev.filter(p => p.id !== id));
      if (activeUser && activeUser.id === id) {
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
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.section.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#090d16', color: '#f8fafc' }}>
      <div id="camera-stream-div-hidden" style={{ display: 'none' }}></div>

      {/* Top Navbar */}
      <header className="glass-panel" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0, padding: '16px 32px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)' }}>
              <Camera style={{ width: '24px', height: '24px', color: '#fff' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 800, background: 'linear-gradient(90deg, #fff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                HACKPORTAL Live Gate
              </h1>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Details Entry ➔ Live Camera Scanner ➔ Manual Excel Export</p>
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
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Enter User Details</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Submit details to immediately launch the live camera scanner</p>
                </div>
              </div>

              <form onSubmit={handleRegisterUser} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                    placeholder="e.g. CSE-A, ECE-B"
                    value={formData.section}
                    onChange={e => setFormData({ ...formData, section: e.target.value })}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '10px', padding: '14px', width: '100%', fontWeight: 700 }}>
                  <Camera size={18} /> Submit Details & Launch Camera Scanner
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
                Selected User: <strong style={{ color: '#fff' }}>{activeUser ? activeUser.name : 'Select user below'}</strong>
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
                      ⚠ {cameraError}. Ensure webcam permissions are allowed or use the Scan Button below.
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ marginBottom: '20px' }}>
                  <button onClick={stopCameraScanner} className="btn btn-danger btn-sm" style={{ marginBottom: '12px' }}>
                    <StopCircle size={14} /> Stop Camera
                  </button>

                  {/* Html5Qrcode Target Element */}
                  <div id="camera-stream-div" style={{ width: '100%', maxWidth: '380px', margin: '0 auto', minHeight: '260px', borderRadius: '14px', border: '2px solid var(--primary)', overflow: 'hidden' }}></div>
                </div>
              )}

              {/* User Selection & Scan Button Simulator */}
              <div style={{ textAlign: 'left', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Select User to Process Attendance Scan:
                </label>
                
                <select
                  value={activeUser ? activeUser.id : ''}
                  onChange={e => {
                    const found = participants.find(p => p.id === e.target.value);
                    if (found) setActiveUser(found);
                  }}
                  style={{ marginBottom: '12px' }}
                >
                  {participants.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.section}) - Status: {p.status.toUpperCase()}
                    </option>
                  ))}
                </select>

                {activeUser && (
                  <button
                    onClick={() => processScanForUser(activeUser.id)}
                    disabled={activeUser.status === 'checked-out'}
                    className={`btn ${activeUser.status === 'registered' ? 'btn-success' : activeUser.status === 'checked-in' ? 'btn-danger' : 'btn-secondary'}`}
                    style={{ width: '100%', padding: '12px', marginBottom: '12px' }}
                  >
                    {activeUser.status === 'registered' && <><LogIn size={18} /> Scan Common QR (1st Scan = Check-In)</>}
                    {activeUser.status === 'checked-in' && <><LogOut size={18} /> Scan Common QR (2nd Scan = Check-Out)</>}
                    {activeUser.status === 'checked-out' && <>✓ Attendance Completed</>}
                  </button>
                )}

                {/* Upload QR Image Fallback */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <label className="btn btn-secondary btn-sm" style={{ flex: 1, cursor: 'pointer' }}>
                    <Upload size={14} /> Scan Image File
                    <input type="file" accept="image/*" onChange={handleFileUploadScan} style={{ display: 'none' }} />
                  </label>
                </div>
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
                  <div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>ACTIVE USER STATUS:</div>
                  <div style={{ fontWeight: 700, color: '#fff' }}>{activeUser.name} ({activeUser.section})</div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                    <span style={{ color: activeUser.checkInTime ? '#34d399' : 'var(--text-dim)' }}>
                      IN: {activeUser.checkInTime || 'Pending'}
                    </span>
                    <span style={{ color: activeUser.checkOutTime ? '#f87171' : 'var(--text-dim)' }}>
                      OUT: {activeUser.checkOutTime || 'Pending'}
                    </span>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 3: ADMIN DASHBOARD & MANUAL EXCEL EXPORT ONLY */}
        {activeTab === 'admin' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* Top Bar with Explicit Manual Export Button Only */}
            <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Admin Attendance Master Control</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  View all participant records and export to Excel spreadsheet on demand
                </p>
              </div>

              <button onClick={exportToExcelManual} className="btn btn-success" style={{ height: '42px', fontWeight: 700 }}>
                <FileSpreadsheet size={18} /> Export to Excel (.xlsx)
              </button>
            </div>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ padding: '12px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '12px', color: 'var(--primary)' }}>
                  <Users size={24} />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL USERS</p>
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

            {/* Admin Table Roster */}
            <div className="glass-panel" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Attendance Master Roster</h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Real-time attendance logs stored in application state</p>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
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
                      <th style={{ padding: '14px 16px', fontWeight: 600 }}>USER ID</th>
                      <th style={{ padding: '14px 16px', fontWeight: 600 }}>FULL NAME & EMAIL</th>
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
                          No records found.
                        </td>
                      </tr>
                    ) : (
                      filteredParticipants.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
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
                                onClick={() => processScanForUser(p.id)}
                                className={`btn btn-sm ${p.status === 'registered' ? 'btn-success' : 'btn-danger'}`}
                              >
                                <ScanLine size={14} /> {p.status === 'registered' ? 'Scan In' : p.status === 'checked-in' ? 'Scan Out' : 'Rescan'}
                              </button>
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
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
