import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import Participant from './models/Participant.js';
import ScanLog from './models/ScanLog.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_REPLICA_URI = process.env.MONGODB_REPLICA_URI;

// Middleware with complete permissive CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Log every incoming API request for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Helper function to format duration milliseconds into readable text string
function formatDurationMs(totalMs) {
  if (!totalMs || totalMs <= 0) return '0s';
  const diffSecs = Math.floor(totalMs / 1000);
  const hours = Math.floor(diffSecs / 3600);
  const minutes = Math.floor((diffSecs % 3600) / 60);
  const seconds = diffSecs % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
}

// Format Name Title Case
function toTitleCase(str) {
  if (!str) return 'Anonymous Student';
  return str.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// Format Team Number
function formatTeamNumber(teamStr) {
  if (!teamStr || !teamStr.trim()) return `TEAM-${Math.floor(100 + Math.random() * 900)}`;
  let clean = teamStr.trim().toUpperCase().replace(/\s+/g, '-');
  if (!clean.startsWith('TEAM-') && !clean.startsWith('TEAM')) {
    clean = `TEAM-${clean}`;
  }
  return clean;
}

// MongoDB Database Cluster Connection Handler
async function connectToMongoCluster() {
  console.log('Connecting to MongoDB Atlas Cluster...');
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
    console.log('✓ Successfully connected to MongoDB Atlas Cluster (srv: hud8s5x.mongodb.net / cse_hackathon)');
  } catch (srvErr) {
    console.warn('⚠ Atlas SRV lookup failed, falling back to direct Cluster Replica Set Seeds:', srvErr.message);
    try {
      await mongoose.connect(MONGODB_REPLICA_URI);
      console.log('✓ Successfully connected to MongoDB Atlas Cluster Replica Set (atlas-11a9cr-shard-0 / cse_hackathon)');
    } catch (replicaErr) {
      console.error('❌ MongoDB Cluster Connection Error:', replicaErr.message);
    }
  }
}

connectToMongoCluster();

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    cluster: 'hud8s5x.mongodb.net',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    dbName: mongoose.connection.name || 'cse_hackathon',
    timestamp: new Date().toISOString()
  });
});

// Analytics & Statistics Endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const participants = await Participant.find();
    const scanLogsCount = await ScanLog.countDocuments();

    const sectionBreakdown = {};
    let totalSessions = 0;

    participants.forEach(p => {
      const sec = p.section || 'Unassigned';
      sectionBreakdown[sec] = (sectionBreakdown[sec] || 0) + 1;
      totalSessions += (p.sessionCount || 0);
    });

    const stats = {
      totalStudents: participants.length,
      checkedIn: participants.filter(p => p.status === 'checked-in').length,
      checkedOut: participants.filter(p => p.status === 'checked-out').length,
      registeredOnly: participants.filter(p => p.status === 'registered').length,
      totalSessions,
      totalScanAuditLogs: scanLogsCount,
      sectionBreakdown,
      timestamp: new Date().toISOString()
    };

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Audit Scan Logs Endpoint
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await ScanLog.find()
      .populate('participant', 'teamNumber name email section status')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1. Get all participants with populated scan history logs for Admin view
app.get('/api/participants', async (req, res) => {
  try {
    const participants = await Participant.find()
      .populate({
        path: 'scanLogs',
        options: { sort: { createdAt: -1 } }
      })
      .sort({ createdAt: -1 });
    res.json(participants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Team Login Endpoint (Redirects returning users directly)
app.post('/api/participants/login', async (req, res) => {
  try {
    const { teamNumber } = req.body;
    if (!teamNumber || !teamNumber.trim()) {
      return res.status(400).json({ error: 'Team Number is required' });
    }

    const searchStr = formatTeamNumber(teamNumber);
    const participant = await Participant.findOne({
      $or: [
        { teamNumber: searchStr },
        { teamNumber: teamNumber.trim().toUpperCase() },
        { userId: teamNumber.trim().toUpperCase() }
      ]
    }).populate('scanLogs');

    if (!participant) {
      return res.status(404).json({ error: `Team Number "${teamNumber}" not found in MongoDB Atlas.` });
    }

    console.log(`✓ Returning User Logged In: Team ${participant.teamNumber} (${participant.name})`);
    res.json(participant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Register a new participant (Formats data properly before saving to MongoDB Atlas)
app.post('/api/participants/register', async (req, res) => {
  try {
    const { teamNumber, name, email, section } = req.body;

    const cleanTeamNumber = formatTeamNumber(teamNumber);
    const cleanName = toTitleCase(name || 'Hackathon Participant');
    const cleanEmail = (email && email.trim()) ? email.trim().toLowerCase() : `student.${Math.floor(100 + Math.random() * 900)}@example.com`;
    const cleanSection = (section && section.trim()) ? section.trim().toUpperCase().replace(/\s+/g, '-') : 'CSE-A';
    const userId = `USER-${Math.floor(1000 + Math.random() * 9000)}`;

    const newParticipant = new Participant({
      userId,
      teamNumber: cleanTeamNumber,
      name: cleanName,
      email: cleanEmail,
      section: cleanSection,
      status: 'registered',
      checkInTime: null,
      checkOutTime: null,
      duration: null,
      totalDurationMs: 0,
      sessionCount: 0
    });

    await newParticipant.save();
    console.log(`✓ SUCCESS: Saved New Document to MongoDB Atlas: Team ${cleanTeamNumber} - ${cleanName} (${userId})`);
    res.status(201).json(newParticipant);
  } catch (err) {
    console.error('❌ Registration Save Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Process Repeatable Multi-Cycle Check-In / Check-Out Scans
app.post('/api/participants/scan', async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required' });
    }

    let participant = await Participant.findOne({ userId: targetUserId.trim().toUpperCase() });
    if (!participant && mongoose.Types.ObjectId.isValid(targetUserId)) {
      participant = await Participant.findById(targetUserId);
    }

    if (!participant) {
      return res.status(404).json({ error: `Participant ID "${targetUserId}" not found in MongoDB Cluster.` });
    }

    const nowObj = new Date();
    const nowFormatted = nowObj.toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });

    let scanType = 'check-in';
    let message = '';

    if (participant.status === 'registered' || participant.status === 'checked-out') {
      // START / REPEAT CYCLE -> CHECK-IN
      scanType = 'check-in';
      participant.status = 'checked-in';
      participant.checkInTime = nowFormatted;
      participant.checkOutTime = null;
      participant.sessionCount = (participant.sessionCount || 0) + 1;
      
      message = `✓ Check-In Confirmed (Session #${participant.sessionCount}) for Team ${participant.teamNumber} (${participant.name}) at ${nowFormatted}`;

    } else if (participant.status === 'checked-in') {
      // COMPLETE CYCLE -> CHECK-OUT (Calculate & Add Session Duration automatically)
      scanType = 'check-out';
      participant.status = 'checked-out';
      participant.checkOutTime = nowFormatted;

      // Calculate elapsed milliseconds for this session
      let sessionMs = 60000;
      try {
        const inDate = new Date(participant.checkInTime);
        const outDate = new Date(nowFormatted);
        const diffMs = Math.abs(outDate - inDate);
        if (!isNaN(diffMs) && diffMs > 0) sessionMs = diffMs;
      } catch (e) {}

      const updatedTotalMs = (participant.totalDurationMs || 0) + sessionMs;
      participant.totalDurationMs = updatedTotalMs;
      
      const readableDuration = formatDurationMs(updatedTotalMs);
      participant.duration = readableDuration;

      message = `✓✓ Check-Out Confirmed (Session #${participant.sessionCount}) for Team ${participant.teamNumber} (${participant.name}). Total Cumulative In-Between Time: ${readableDuration}`;
    }

    // Create interconnected ScanLog entry
    const scanLog = new ScanLog({
      participant: participant._id,
      userId: participant.userId,
      scanType,
      timestamp: nowFormatted
    });

    await scanLog.save();

    // Link ScanLog reference into Participant document
    participant.scanLogs.push(scanLog._id);
    await participant.save();

    const populated = await Participant.findById(participant._id).populate('scanLogs');

    console.log(`✓ MongoDB Atlas Row Updated: Team ${participant.teamNumber} - ${participant.name} [${scanType.toUpperCase()} - Session #${participant.sessionCount}]`);

    res.json({
      message,
      participant: populated,
      scanLog
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Delete participant
app.delete('/api/participants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let participant;
    
    if (mongoose.Types.ObjectId.isValid(id)) {
      participant = await Participant.findByIdAndDelete(id);
    } else {
      participant = await Participant.findOneAndDelete({ userId: id });
    }

    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    await ScanLog.deleteMany({ participant: participant._id });
    res.json({ message: 'Participant row and connected logs deleted from cluster' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Express Server listening on 0.0.0.0
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Hackathon Express Server listening on port ${PORT} (0.0.0.0)`);
  console.log(`📡 API Base URL: http://localhost:${PORT}/api`);
});
