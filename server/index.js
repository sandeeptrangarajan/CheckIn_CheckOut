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

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

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

// 1. Get all participants
app.get('/api/participants', async (req, res) => {
  try {
    const participants = await Participant.find()
      .populate('scanLogs')
      .sort({ createdAt: -1 });
    res.json(participants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Team Login Endpoint (Redirects existing users)
app.post('/api/participants/login', async (req, res) => {
  try {
    const { teamNumber } = req.body;
    if (!teamNumber || !teamNumber.trim()) {
      return res.status(400).json({ error: 'Team Number is required' });
    }

    const searchStr = teamNumber.trim().toUpperCase();
    const participant = await Participant.findOne({
      $or: [
        { teamNumber: searchStr },
        { userId: searchStr }
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

// 3. Register a new participant (First time login / registration)
app.post('/api/participants/register', async (req, res) => {
  try {
    const { teamNumber, name, email, section } = req.body;
    if (!name || !email || !section) {
      return res.status(400).json({ error: 'Student Name, email, and section are required fields.' });
    }

    const formattedTeamNumber = teamNumber && teamNumber.trim() ? teamNumber.trim().toUpperCase() : `TEAM-${Math.floor(100 + Math.random() * 900)}`;
    const userId = `USER-${Math.floor(1000 + Math.random() * 9000)}`;

    const newParticipant = new Participant({
      userId,
      teamNumber: formattedTeamNumber,
      name: name.trim(),
      email: email.trim(),
      section: section.trim(),
      status: 'registered',
      checkInTime: null,
      checkOutTime: null,
      duration: null,
      totalDurationMs: 0,
      sessionCount: 0
    });

    await newParticipant.save();
    console.log(`✓ First-Time User Saved to MongoDB Atlas: Team ${formattedTeamNumber} - ${name} (${userId})`);
    res.status(201).json(newParticipant);
  } catch (err) {
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

    console.log(`✓ MongoDB Atlas Row Updated: Team ${participant.teamNumber} - ${participant.name} [${scanType.toUpperCase()} - Session #${participant.sessionCount}]`);

    res.json({
      message,
      participant,
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

// Start Express Server
app.listen(PORT, () => {
  console.log(`🚀 Hackathon Express Server listening on port ${PORT}`);
  console.log(`📡 API Base URL: http://localhost:${PORT}/api`);
});
