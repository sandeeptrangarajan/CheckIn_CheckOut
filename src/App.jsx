import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';

export default function App() {
  const [participants, setParticipants] = useState(() => {
    const saved = localStorage.getItem('hackathon_portal_participants');
    return saved ? JSON.parse(saved) : [];
  });

  const [formData, setFormData] = useState({ name: '', email: '', section: '' });
  const [currentUser, setCurrentUser] = useState(null);
  const [qrCodes, setQrCodes] = useState(null);
  const [showForm, setShowForm] = useState(true);

  // Auto-sync participants state to LocalStorage
  useEffect(() => {
    localStorage.setItem('hackathon_portal_participants', JSON.stringify(participants));
  }, [participants]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 1. Participant Registration & Dual QR Generation
  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim() || !formData.section.trim()) {
      alert('Please fill all required fields');
      return;
    }

    const userId = `HACK-${Date.now().toString().slice(-6)}`;
    const newParticipant = {
      id: userId,
      name: formData.name.trim(),
      email: formData.email.trim(),
      section: formData.section.trim(),
      checkInTime: null,
      checkOutTime: null,
      status: 'registered', // 'registered' | 'checked-in' | 'checked-out'
    };

    setParticipants(prev => [newParticipant, ...prev]);

    // Generate two distinct QR codes: one for Check-In & one for Check-Out
    const checkInData = JSON.stringify({ userId, type: 'check-in', name: formData.name });
    const checkOutData = JSON.stringify({ userId, type: 'check-out', name: formData.name });

    try {
      const checkInQR = await QRCode.toDataURL(checkInData, { 
        width: 220, 
        margin: 1, 
        color: { dark: '#0f172a', light: '#ffffff' } 
      });
      const checkOutQR = await QRCode.toDataURL(checkOutData, { 
        width: 220, 
        margin: 1, 
        color: { dark: '#0f172a', light: '#ffffff' } 
      });
      
      setQrCodes({ checkInQR, checkOutQR });
      setCurrentUser(newParticipant);
      setFormData({ name: '', email: '', section: '' });
      setShowForm(false);
    } catch (err) {
      console.error('QR code generation error:', err);
      alert('Failed to generate QR codes. Please try again.');
    }
  };

  // 2. Simulated QR Scan Logic & Status Access Control
  const handleScanQR = (type, targetId = null) => {
    const idToScan = targetId || currentUser?.id;
    if (!idToScan) return;

    let notificationText = '';

    const updatedParticipants = participants.map(p => {
      if (p.id === idToScan) {
        if (type === 'check-in') {
          if (p.status === 'checked-in') {
            notificationText = `⚠️ ${p.name} is already checked in! Please check out first.`;
            return p;
          }
          const nowTime = new Date().toLocaleString('en-IN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
          });
          notificationText = `✓ Check-In Successful for ${p.name} at ${nowTime}`;
          return {
            ...p,
            status: 'checked-in',
            checkInTime: nowTime,
          };
        } else if (type === 'check-out') {
          if (p.status !== 'checked-in') {
            notificationText = `⚠️ Cannot Check-Out! ${p.name} has not checked in yet.`;
            return p;
          }
          const nowTime = new Date().toLocaleString('en-IN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
          });
          notificationText = `✓✓ Check-Out Successful for ${p.name} at ${nowTime}`;
          return {
            ...p,
            status: 'checked-out',
            checkOutTime: nowTime,
          };
        }
      }
      return p;
    });

    setParticipants(updatedParticipants);
    
    // Update active current user display
    const updatedUser = updatedParticipants.find(p => p.id === idToScan);
    if (updatedUser && currentUser && currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }

    if (notificationText) {
      alert(notificationText);
    }
  };

  // 3. Export Attendance Data to Excel (.xlsx)
  const exportToExcel = () => {
    if (participants.length === 0) {
      alert('No attendance data available to export');
      return;
    }

    const exportData = participants.map((p, idx) => ({
      'S.No': idx + 1,
      'Participant ID': p.id,
      'Name': p.name,
      'Email': p.email,
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

  const handleNewRegistration = () => {
    setShowForm(true);
    setQrCodes(null);
    setCurrentUser(null);
  };

  return (
    <div style={styles.container}>
      {/* Header Banner */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>🚀 Hackathon Attendance Portal</h1>
          <p style={styles.subtitle}>Check-In & Check-Out QR Verification System</p>
        </div>
      </header>

      <main style={styles.mainContent}>
        {showForm ? (
          /* Step 1: Registration Form */
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Participant Registration</h2>
              <span style={styles.stepBadge}>Step 1</span>
            </div>

            <form onSubmit={handleRegister} style={styles.form}>
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
                  placeholder="e.g., CSE-A, ECE-B, IT-1"
                  style={styles.input}
                  required
                />
              </div>

              <button type="submit" style={styles.submitButton}>
                ⚡ Generate QR Codes (Check-In & Check-Out)
              </button>
            </form>
          </div>
        ) : (
          /* Step 2: Dual QR Code System & Simulated Scan Buttons */
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ ...styles.cardTitle, margin: 0 }}>Welcome, {currentUser?.name}!</h2>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0 0' }}>
                  ID: <strong style={{ color: '#38bdf8' }}>{currentUser?.id}</strong> | Section: <strong>{currentUser?.section}</strong>
                </p>
              </div>

              {/* Status Access Control Badge */}
              <div>
                <span style={{
                  ...styles.statusBadge,
                  backgroundColor: currentUser?.status === 'registered' ? '#f59e0b' :
                                    currentUser?.status === 'checked-in' ? '#10b981' : '#059669'
                }}>
                  {currentUser?.status === 'registered' && '⏳ Status: Registered'}
                  {currentUser?.status === 'checked-in' && '✓ Status: Checked-In'}
                  {currentUser?.status === 'checked-out' && '✓✓ Status: Checked-Out'}
                </span>
              </div>
            </div>

            {/* Two Unique QR Codes per Participant */}
            <div style={styles.qrContainer}>
              
              {/* Check-In QR Card */}
              <div style={{
                ...styles.qrCard,
                borderColor: currentUser?.status === 'registered' ? '#3b82f6' : '#334155'
              }}>
                <div style={styles.qrCardHeader}>
                  <h3 style={styles.qrTitle}>📱 Check-In QR Pass</h3>
                  <span style={styles.qrTag}>Check-In Only</span>
                </div>
                
                {qrCodes?.checkInQR && (
                  <img 
                    src={qrCodes.checkInQR} 
                    alt="Check-In QR Code" 
                    style={styles.qrImage}
                  />
                )}

                {/* Simulated Check-In Scan Button */}
                <button
                  onClick={() => handleScanQR('check-in')}
                  disabled={currentUser?.status === 'checked-in' || currentUser?.status === 'checked-out'}
                  style={{
                    ...styles.scanButton,
                    backgroundColor: '#10b981',
                    opacity: (currentUser?.status === 'checked-in' || currentUser?.status === 'checked-out') ? 0.5 : 1,
                    cursor: (currentUser?.status === 'checked-in' || currentUser?.status === 'checked-out') ? 'not-allowed' : 'pointer',
                  }}
                >
                  {currentUser?.status === 'checked-in' ? 'Already Checked-In' :
                   currentUser?.status === 'checked-out' ? 'Checked-Out' : '📲 Scan Check-In QR'}
                </button>

                {currentUser?.checkInTime && (
                  <p style={styles.timeDisplay}>✓ Check-In Recorded: {currentUser.checkInTime}</p>
                )}
              </div>

              {/* Check-Out QR Card */}
              <div style={{
                ...styles.qrCard,
                borderColor: currentUser?.status === 'checked-in' ? '#ef4444' : '#334155'
              }}>
                <div style={styles.qrCardHeader}>
                  <h3 style={styles.qrTitle}>📱 Check-Out QR Pass</h3>
                  <span style={{ ...styles.qrTag, backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>Check-Out Only</span>
                </div>
                
                {qrCodes?.checkOutQR && (
                  <img 
                    src={qrCodes.checkOutQR} 
                    alt="Check-Out QR Code" 
                    style={styles.qrImage}
                  />
                )}

                {/* Simulated Check-Out Scan Button */}
                <button
                  onClick={() => handleScanQR('check-out')}
                  disabled={currentUser?.status !== 'checked-in'}
                  style={{
                    ...styles.scanButton,
                    backgroundColor: '#ef4444',
                    opacity: currentUser?.status !== 'checked-in' ? 0.5 : 1,
                    cursor: currentUser?.status !== 'checked-in' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {currentUser?.status === 'registered' ? 'Must Check-In First' :
                   currentUser?.status === 'checked-out' ? 'Already Checked-Out' : '📲 Scan Check-Out QR'}
                </button>

                {currentUser?.checkOutTime && (
                  <p style={{ ...styles.timeDisplay, color: '#f87171' }}>✓ Check-Out Recorded: {currentUser.checkOutTime}</p>
                )}
              </div>

            </div>

            <button 
              onClick={handleNewRegistration}
              style={styles.newParticipantButton}
            >
              + Register New Participant
            </button>
          </div>
        )}

        {/* Step 3: Attendance Tracking Table & Excel Export */}
        {participants.length > 0 && (
          <div style={styles.card}>
            <div style={styles.recordsHeader}>
              <div>
                <h2 style={styles.cardTitle}>Live Attendance Tracking Roster</h2>
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0 0' }}>
                  Total Participants: <strong>{participants.length}</strong> | Checked-In: <strong style={{ color: '#10b981' }}>{participants.filter(p => p.status === 'checked-in').length}</strong> | Checked-Out: <strong style={{ color: '#059669' }}>{participants.filter(p => p.status === 'checked-out').length}</strong>
                </p>
              </div>

              <button onClick={exportToExcel} style={styles.exportButton}>
                📊 Export to Excel (.xlsx)
              </button>
            </div>

            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.th}>ID</th>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}>Section</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Check-In Time</th>
                    <th style={styles.th}>Check-Out Time</th>
                    <th style={styles.th}>Quick Action</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p, idx) => (
                    <tr key={p.id} style={idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}>
                      <td style={{ ...styles.td, fontFamily: 'monospace', fontWeight: 'bold', color: '#38bdf8' }}>{p.id}</td>
                      <td style={{ ...styles.td, fontWeight: '600', color: '#f8fafc' }}>{p.name}</td>
                      <td style={styles.td}>{p.email}</td>
                      <td style={styles.td}>{p.section}</td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.statusTag,
                          backgroundColor: p.status === 'registered' ? 'rgba(245, 158, 11, 0.2)' :
                                            p.status === 'checked-in' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(5, 150, 105, 0.2)',
                          color: p.status === 'registered' ? '#f59e0b' :
                                 p.status === 'checked-in' ? '#10b981' : '#34d399',
                          border: `1px solid ${p.status === 'registered' ? 'rgba(245, 158, 11, 0.4)' :
                                               p.status === 'checked-in' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(5, 150, 105, 0.4)'}`
                        }}>
                          {p.status === 'registered' ? '⏳ Registered' :
                           p.status === 'checked-in' ? '✓ Checked-In' : '✓✓ Checked-Out'}
                        </span>
                      </td>
                      <td style={{ ...styles.td, color: p.checkInTime ? '#34d399' : '#64748b' }}>{p.checkInTime || '-'}</td>
                      <td style={{ ...styles.td, color: p.checkOutTime ? '#f87171' : '#64748b' }}>{p.checkOutTime || '-'}</td>
                      <td style={styles.td}>
                        {p.status === 'registered' && (
                          <button
                            onClick={() => handleScanQR('check-in', p.id)}
                            style={{ ...styles.actionBtn, backgroundColor: '#10b981' }}
                          >
                            Scan Check-In
                          </button>
                        )}
                        {p.status === 'checked-in' && (
                          <button
                            onClick={() => handleScanQR('check-out', p.id)}
                            style={{ ...styles.actionBtn, backgroundColor: '#ef4444' }}
                          >
                            Scan Check-Out
                          </button>
                        )}
                        {p.status === 'checked-out' && (
                          <span style={{ color: '#34d399', fontSize: '12px', fontWeight: 'bold' }}>✓ Completed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
    padding: '36px 20px',
    textAlign: 'center',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  title: {
    fontSize: '36px',
    fontWeight: '800',
    margin: '0 0 8px 0',
    letterSpacing: '-0.5px',
    background: 'linear-gradient(90deg, #ffffff 0%, #cbd5e1 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '15px',
    fontWeight: '400',
    margin: '0',
    color: '#a5b4fc',
  },
  mainContent: {
    maxWidth: '1140px',
    margin: '0 auto',
    padding: '36px 20px',
  },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    backdropFilter: 'blur(12px)',
    borderRadius: '16px',
    padding: '32px',
    marginBottom: '28px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  cardTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: 0,
  },
  stepBadge: {
    background: 'rgba(99, 102, 241, 0.2)',
    color: '#818cf8',
    border: '1px solid rgba(99, 102, 241, 0.4)',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
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
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  submitButton: {
    padding: '14px 24px',
    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '8px',
    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
  },
  statusBadge: {
    padding: '8px 18px',
    borderRadius: '20px',
    color: 'white',
    fontWeight: '700',
    fontSize: '13px',
  },
  qrContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px',
    marginTop: '20px',
    marginBottom: '24px',
  },
  qrCard: {
    backgroundColor: '#090d16',
    borderRadius: '14px',
    padding: '24px',
    textAlign: 'center',
    border: '2px solid #334155',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  qrCardHeader: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  qrTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: 0,
  },
  qrTag: {
    fontSize: '11px',
    fontWeight: '700',
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: '#60a5fa',
  },
  qrImage: {
    width: '200px',
    height: '200px',
    marginBottom: '18px',
    borderRadius: '12px',
    backgroundColor: '#ffffff',
    padding: '10px',
  },
  scanButton: {
    width: '100%',
    padding: '12px 16px',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '700',
    marginBottom: '12px',
    transition: 'all 0.2s',
  },
  timeDisplay: {
    fontSize: '12px',
    color: '#34d399',
    fontWeight: '600',
    margin: '4px 0 0 0',
  },
  newParticipantButton: {
    width: '100%',
    padding: '14px 24px',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    color: '#818cf8',
    border: '1px solid #6366f1',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  recordsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    gap: '16px',
    flexWrap: 'wrap',
  },
  exportButton: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
  },
  tableContainer: {
    overflowX: 'auto',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
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
    padding: '5px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
    display: 'inline-block',
  },
  actionBtn: {
    padding: '6px 14px',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  }
};
