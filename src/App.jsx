import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

const COMMON_QR_PAYLOAD = 'HACKATHON-GATE-2026';

export default function App() {
  const [participants, setParticipants] = useState(() => {
    const saved = localStorage.getItem('hackathon_complete_portal_v8');
    return saved ? JSON.parse(saved) : [];
  });

  const [formData, setFormData] = useState({ name: '', email: '', section: '' });
  const [activeUser, setActiveUser] = useState(null);
  const [commonQrUrl, setCommonQrUrl] = useState('');
  const [activeTab, setActiveTab] = useState('register'); // 'register' | 'scanner' | 'admin'
  const [notice, setNotice] = useState(null);
  const [secondsUntilExport, setSecondsUntilExport] = useState(60);
  
  // Camera & QR Scanner State
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const [cameraPermission, setCameraPermission] = useState(null);

  // Auto-sync participants to LocalStorage
  useEffect(() => {
    localStorage.setItem('hackathon_complete_portal_v8', JSON.stringify(participants));
  }, [participants]);

  // Generate Common Master QR Code Data URL
  useEffect(() => {
    QRCode.toDataURL(COMMON_QR_PAYLOAD, {
      width: 250,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' }
    })
      .then(url => setCommonQrUrl(url))
      .catch(err => console.error('QR generation error:', err));
  }, []);

  // 1-Minute Auto Excel Export Interval
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsUntilExport(prev => {
        if (prev <= 1) {
          if (participants.length > 0) exportToExcel(true);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [participants]);

  // Notice Auto-Dismiss after 6 seconds
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 1 & 2. Register Participant -> Automatically Launch Scanner View
  const handleRegisterAndLaunchScanner = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.section.trim()) {
      setNotice({ type: 'error', msg: '❌ Please fill out all details.' });
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
    setNotice({
      type: 'success',
      msg: `✓ ${newUser.name} registered! Point camera or click Scan to record Check-In.`
    });
  };

  // Start Camera Stream
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setScanning(true);
        setCameraPermission('granted');
      }
    } catch (error) {
      console.error('Camera error:', error);
      setCameraPermission('denied');
      setNotice({ type: 'error', msg: '❌ Camera access denied. Use the Scan Button below or grant camera permissions.' });
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  // Frame Loop for Camera Scanner
  useEffect(() => {
    if (!scanning) return;

    let isScanningFrame = true;

    const scanFrame = () => {
      if (!isScanningFrame || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code) {
            if (code.data === COMMON_QR_PAYLOAD || code.data.includes('HACKATHON')) {
              if (!activeUser) {
                setNotice({ type: 'error', msg: '❌ Please register user details first!' });
              } else {
                processCheckInOut(activeUser.id);
              }
              stopCamera();
              return;
            }
          }
        } catch (error) {
          // Ignore frame decode error
        }
      }

      animFrameIdRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(scanFrame);

    return () => {
      isScanningFrame = false;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [scanning, activeUser]);

  // Process Check-In (1st Scan) & Check-Out (2nd Scan)
  const processCheckInOut = (userId) => {
    const userToUpdate = participants.find(p => p.id === userId) || activeUser;
    if (!userToUpdate) return;

    const nowFormatted = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });

    let scanMsg = '';
    let updatedUser = null;

    const updatedParticipants = participants.map(p => {
      if (p.id === userToUpdate.id) {
        if (p.status === 'registered') {
          // 1st Scan -> Check In
          scanMsg = `✓ 1st Scan: Check-In Recorded for ${p.name} at ${nowFormatted}`;
          updatedUser = { ...p, status: 'checked-in', checkInTime: nowFormatted };
          return updatedUser;
        } else if (p.status === 'checked-in') {
          // 2nd Scan -> Check Out
          scanMsg = `✓✓ 2nd Scan: Check-Out Recorded for ${p.name} at ${nowFormatted}`;
          updatedUser = { ...p, status: 'checked-out', checkOutTime: nowFormatted };
          return updatedUser;
        } else {
          scanMsg = `ℹ ${p.name} has already completed attendance!`;
          return p;
        }
      }
      return p;
    });

    setParticipants(updatedParticipants);
    if (updatedUser) setActiveUser(updatedUser);
    setNotice({ type: 'success', msg: scanMsg });
  };

  // Export Roster to Excel
  const exportToExcel = (isAuto = false) => {
    if (participants.length === 0) return;

    const data = participants.map((p, i) => ({
      'S.No': i + 1,
      'User ID': p.id,
      'Name': p.name,
      'Email': p.email,
      'Class/Section': p.section,
      'Status': p.status.toUpperCase(),
      'Check-In Time': p.checkInTime || 'Pending',
      'Check-Out Time': p.checkOutTime || 'Pending',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
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

    const filename = `Hackathon_Attendance_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this record from attendance roster?')) {
      setParticipants(prev => prev.filter(p => p.id !== id));
      if (activeUser && activeUser.id === id) setActiveUser(null);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header Banner */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>🚀 Hackathon Attendance Portal</h1>
          <p style={styles.subtitle}>Register → Scan Common QR (1st Check-In / 2nd Check-Out) → Auto Excel Sync</p>
        </div>
      </header>

      {/* Navigation Bar */}
      <div style={styles.navBar}>
        <button
          onClick={() => { setActiveTab('register'); stopCamera(); }}
          style={{
            ...styles.navBtn,
            backgroundColor: activeTab === 'register' ? '#3b82f6' : '#1e293b'
          }}
        >
          1. Register Participant
        </button>
        <button
          onClick={() => setActiveTab('scanner')}
          style={{
            ...styles.navBtn,
            backgroundColor: activeTab === 'scanner' ? '#3b82f6' : '#1e293b'
          }}
        >
          2. Scan & Track
        </button>
        <button
          onClick={() => { setActiveTab('admin'); stopCamera(); }}
          style={{
            ...styles.navBtn,
            backgroundColor: activeTab === 'admin' ? '#3b82f6' : '#1e293b'
          }}
        >
          3. Admin Dashboard ({participants.length})
        </button>
      </div>

      {/* Main Content Area */}
      <main style={styles.mainContent}>
        {notice && (
          <div style={{
            ...styles.noticeBox,
            backgroundColor: notice.type === 'error' ? 'rgba(239, 68, 68, 0.15)' :
                           notice.type === 'success' ? 'rgba(16, 185, 129, 0.15)' :
                           'rgba(59, 130, 246, 0.15)',
            borderColor: notice.type === 'error' ? 'rgba(239, 68, 68, 0.3)' :
                        notice.type === 'success' ? 'rgba(16, 185, 129, 0.3)' :
                        'rgba(59, 130, 246, 0.3)',
            color: notice.type === 'error' ? '#f87171' :
                  notice.type === 'success' ? '#34d399' : '#60a5fa'
          }}>
            {notice.msg}
          </div>
        )}

        {/* 1. Register Participant */}
        {activeTab === 'register' && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Step 1: Register Participant</h2>
            <form onSubmit={handleRegisterAndLaunchScanner} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Full Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter full name"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="your.email@domain.com"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Class / Section *</label>
                <input
                  type="text"
                  name="section"
                  value={formData.section}
                  onChange={handleInputChange}
                  placeholder="e.g., CSE-A, ECE-B"
                  style={styles.input}
                  required
                />
              </div>

              <button type="submit" style={styles.submitButton}>
                ✓ Register & Go to Scanner Terminal
              </button>
            </form>
          </div>
        )}

        {/* 2. Scanner & Common QR Code View */}
        {activeTab === 'scanner' && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Step 2: Scan QR Code for Attendance</h2>

            {activeUser ? (
              <div style={styles.activeUserBox}>
                <p style={styles.activeUserText}>
                  📍 Selected User: <strong style={{ color: '#38bdf8' }}>{activeUser.name}</strong> ({activeUser.section})
                </p>
                <p style={styles.statusText}>
                  Current Status:{' '}
                  <span style={{
                    ...styles.statusBadge,
                    backgroundColor: activeUser.status === 'registered' ? 'rgba(245, 158, 11, 0.2)' :
                                    activeUser.status === 'checked-in' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                    color: activeUser.status === 'registered' ? '#f59e0b' :
                           activeUser.status === 'checked-in' ? '#10b981' : '#f43f5e'
                  }}>
                    {activeUser.status === 'registered' && '⏳ Registered (Ready for 1st Scan)'}
                    {activeUser.status === 'checked-in' && '✓ CHECKED-IN (Ready for 2nd Scan)'}
                    {activeUser.status === 'checked-out' && '✓✓ CHECKED-OUT (Completed)'}
                  </span>
                </p>
              </div>
            ) : (
              <div style={styles.warningBox}>
                ⚠ Please select or register a participant below to process scanning.
              </div>
            )}

            {/* QR Display and Scanner Controls */}
            <div style={styles.scannerContainer}>
              {/* Common QR Graphic */}
              <div style={styles.qrDisplayCard}>
                <h3 style={styles.qrTitle}>Common Event QR Code</h3>
                <p style={styles.qrDesc}>
                  Single master QR for all participants<br/>
                  <strong>1st scan</strong> = Check-In | <strong>2nd scan</strong> = Check-Out
                </p>
                {commonQrUrl && (
                  <img src={commonQrUrl} alt="Common Event QR Code" style={styles.qrImage} />
                )}

                {activeUser && (
                  <button
                    onClick={() => processCheckInOut(activeUser.id)}
                    disabled={activeUser.status === 'checked-out'}
                    style={{
                      ...styles.actionScanBtn,
                      backgroundColor: activeUser.status === 'registered' ? '#10b981' :
                                       activeUser.status === 'checked-in' ? '#ef4444' : '#64748b',
                      cursor: activeUser.status === 'checked-out' ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {activeUser.status === 'registered' && '📲 Scan Common QR (1st Scan = Check-In)'}
                    {activeUser.status === 'checked-in' && '📲 Scan Common QR (2nd Scan = Check-Out)'}
                    {activeUser.status === 'checked-out' && '✓ Attendance Completed'}
                  </button>
                )}
              </div>

              {/* Real Camera Stream Box */}
              <div style={styles.cameraCard}>
                <h3 style={styles.cameraTitle}>📷 Real Webcam Scanner</h3>
                {scanning ? (
                  <div>
                    <video
                      ref={videoRef}
                      style={styles.videoStream}
                      autoPlay
                      playsInline
                    />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <button onClick={stopCamera} style={styles.stopButton}>
                      Stop Camera
                    </button>
                  </div>
                ) : (
                  <div>
                    <p style={styles.cameraPrompt}>
                      {cameraPermission === 'denied'
                        ? '❌ Camera access denied'
                        : 'Point webcam at the Common QR code to trigger scan'}
                    </p>
                    <button onClick={startCamera} style={styles.startButton}>
                      📷 Start Device Camera
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Select active user dropdown */}
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #334155' }}>
              <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
                Select Active Participant to Track:
              </label>
              <select
                value={activeUser ? activeUser.id : ''}
                onChange={e => {
                  const found = participants.find(p => p.id === e.target.value);
                  if (found) setActiveUser(found);
                }}
                style={styles.input}
              >
                <option value="">-- Choose Registered Participant --</option>
                {participants.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.section}) - {p.status.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* 3. Admin Dashboard & Auto 1-Min Excel Export */}
        {activeTab === 'admin' && (
          <div style={styles.card}>
            <div style={styles.adminHeader}>
              <div>
                <h2 style={styles.cardTitle}>Step 3: Admin Master Dashboard</h2>
                <p style={styles.autoExportText}>
                  📊 Total Attendees: <strong>{participants.length}</strong> | Auto-Syncing Excel every <strong>60s</strong> (Next in {secondsUntilExport}s)
                </p>
              </div>
              <button onClick={() => exportToExcel(false)} style={styles.exportButton}>
                📥 Export to Excel Now (.xlsx)
              </button>
            </div>

            {participants.length === 0 ? (
              <div style={styles.emptyState}>
                <p>No participants registered yet. Click "1. Register Participant" to begin.</p>
              </div>
            ) : (
              <div style={styles.tableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeader}>
                      <th style={styles.th}>User ID</th>
                      <th style={styles.th}>Full Name</th>
                      <th style={styles.th}>Email Address</th>
                      <th style={styles.th}>Class / Section</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Check-In Time</th>
                      <th style={styles.th}>Check-Out Time</th>
                      <th style={styles.th}>Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((p, idx) => (
                      <tr key={p.id} style={idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}>
                        <td style={{ ...styles.td, fontFamily: 'monospace', color: '#38bdf8', fontWeight: 'bold' }}>
                          {p.id}
                        </td>
                        <td style={{ ...styles.td, fontWeight: '600' }}>{p.name}</td>
                        <td style={styles.td}>{p.email}</td>
                        <td style={styles.td}>{p.section}</td>
                        <td style={styles.td}>
                          <span style={{
                            ...styles.statusTag,
                            backgroundColor: p.status === 'registered' ? 'rgba(245, 158, 11, 0.2)' :
                                            p.status === 'checked-in' ? 'rgba(16, 185, 129, 0.2)' :
                                            'rgba(244, 63, 94, 0.2)',
                            color: p.status === 'registered' ? '#f59e0b' :
                                   p.status === 'checked-in' ? '#10b981' : '#f87171'
                          }}>
                            {p.status === 'registered' ? '⏳ Registered' :
                             p.status === 'checked-in' ? '✓ Checked-In' :
                             '✓✓ Checked-Out'}
                          </span>
                        </td>
                        <td style={{ ...styles.td, color: p.checkInTime ? '#34d399' : '#64748b' }}>
                          {p.checkInTime || '-'}
                        </td>
                        <td style={{ ...styles.td, color: p.checkOutTime ? '#f87171' : '#64748b' }}>
                          {p.checkOutTime || '-'}
                        </td>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {p.status !== 'checked-out' && (
                              <button
                                onClick={() => processCheckInOut(p.id)}
                                style={{
                                  ...styles.smallBtn,
                                  backgroundColor: p.status === 'registered' ? '#10b981' : '#ef4444'
                                }}
                              >
                                {p.status === 'registered' ? 'Scan In' : 'Scan Out'}
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(p.id)}
                              style={{ ...styles.smallBtn, backgroundColor: '#f43f5e' }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#090d16',
    color: '#f8fafc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
    color: 'white',
    padding: '30px 20px',
    textAlign: 'center',
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  title: {
    fontSize: '32px',
    fontWeight: '800',
    margin: '0 0 6px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#a5b4fc',
    margin: 0,
  },
  navBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #334155',
    flexWrap: 'wrap',
  },
  navBtn: {
    padding: '10px 20px',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer',
    fontSize: '14px',
  },
  mainContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '32px 20px',
  },
  noticeBox: {
    padding: '16px 20px',
    borderRadius: '10px',
    border: '1px solid',
    fontWeight: 'bold',
    marginBottom: '24px',
  },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: '16px',
    padding: '32px',
    marginBottom: '28px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  cardTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: '0 0 20px 0',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#94a3b8',
  },
  input: {
    padding: '14px 16px',
    backgroundColor: '#090d16',
    border: '1px solid #334155',
    borderRadius: '10px',
    fontSize: '14px',
    color: '#fff',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  submitButton: {
    padding: '14px 24px',
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  activeUserBox: {
    backgroundColor: '#090d16',
    padding: '16px 20px',
    borderRadius: '10px',
    marginBottom: '24px',
    border: '1px solid #334155',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  activeUserText: {
    fontSize: '15px',
    margin: 0,
  },
  statusText: {
    fontSize: '14px',
    margin: 0,
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '700',
  },
  warningBox: {
    padding: '14px 18px',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    color: '#fbbf24',
    borderRadius: '10px',
    fontWeight: '600',
    marginBottom: '24px',
  },
  scannerContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px',
  },
  qrDisplayCard: {
    backgroundColor: '#090d16',
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center',
    border: '1px solid #334155',
  },
  qrTitle: {
    fontSize: '18px',
    fontWeight: '700',
    margin: '0 0 8px 0',
  },
  qrDesc: {
    fontSize: '13px',
    color: '#94a3b8',
    marginBottom: '16px',
  },
  qrImage: {
    width: '200px',
    height: '200px',
    borderRadius: '12px',
    backgroundColor: '#fff',
    padding: '10px',
    marginBottom: '16px',
  },
  actionScanBtn: {
    width: '100%',
    padding: '12px',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '14px',
  },
  cameraCard: {
    backgroundColor: '#090d16',
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center',
    border: '1px solid #334155',
  },
  cameraTitle: {
    fontSize: '18px',
    fontWeight: '700',
    margin: '0 0 16px 0',
  },
  cameraPrompt: {
    fontSize: '14px',
    color: '#94a3b8',
    marginBottom: '16px',
  },
  startButton: {
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
  },
  stopButton: {
    padding: '10px 20px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'pointer',
    marginTop: '12px',
  },
  videoStream: {
    width: '100%',
    maxWidth: '360px',
    borderRadius: '12px',
    border: '2px solid #3b82f6',
  },
  adminHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  autoExportText: {
    fontSize: '13px',
    color: '#94a3b8',
    margin: '4px 0 0 0',
  },
  exportButton: {
    padding: '12px 24px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
  },
  emptyState: {
    padding: '40px',
    textAlign: 'center',
    color: '#64748b',
  },
  tableContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  tableHeader: {
    backgroundColor: '#090d16',
    borderBottom: '2px solid #334155',
  },
  th: {
    padding: '14px 16px',
    textAlign: 'left',
    fontWeight: '600',
    color: '#94a3b8',
  },
  td: {
    padding: '14px 16px',
    borderBottom: '1px solid #1e293b',
    color: '#cbd5e1',
  },
  tableRowEven: {
    backgroundColor: 'rgba(9, 13, 22, 0.5)',
  },
  tableRowOdd: {
    backgroundColor: 'transparent',
  },
  statusTag: {
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '700',
  },
  smallBtn: {
    padding: '6px 12px',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  }
};
