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
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// MongoDB Database Cluster Connection Handler
async function connectToMongoCluster() {
  console.log('Connecting to MongoDB Atlas Cluster...');
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
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

// 2. Register a new participant with Team Number & Student Name
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
      checkOutTime: null
    });

    await newParticipant.save();
    console.log(`✓ Saved to MongoDB Database: Team ${formattedTeamNumber} - ${name} (${userId})`);
    res.status(201).json(newParticipant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Process Check-In (1st Scan) & Check-Out (2nd Scan) with interconnected ScanLog creation
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

    const nowFormatted = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    let scanType = 'check-in';
    let message = '';

    if (participant.status === 'registered') {
      // 1st SCAN -> CHECK-IN
      scanType = 'check-in';
      participant.status = 'checked-in';
      participant.checkInTime = nowFormatted;
      message = `✓ Check-In Recorded for Team ${participant.teamNumber} (${participant.name}) at ${nowFormatted}`;
    } else if (participant.status === 'checked-in') {
      // 2nd SCAN -> CHECK-OUT
      scanType = 'check-out';
      participant.status = 'checked-out';
      participant.checkOutTime = nowFormatted;
      message = `✓✓ Check-Out Recorded for Team ${participant.teamNumber} (${participant.name}) at ${nowFormatted}`;
    } else {
      return res.status(400).json({
        message: `ℹ Team ${participant.teamNumber} (${participant.name}) has already completed attendance!`,
        participant
      });
    }

    // Create interconnected ScanLog entry
    const scanLog = new ScanLog({
      participant: participant._id,
      userId: participant.userId,
      scanType,
      timestamp: nowFormatted
    });

    await scanLog.save();

    // Link ScanLog ObjectId reference into Participant.scanLogs array
    participant.scanLogs.push(scanLog._id);
    await participant.save();

    console.log(`✓ Updated Cluster Record & ScanLog: Team ${participant.teamNumber} - ${participant.name} [${scanType.toUpperCase()}]`);

    res.json({
      message,
      participant,
      scanLog
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Delete participant
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
