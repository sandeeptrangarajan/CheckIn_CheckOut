import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Participant from './models/Participant.js';
import ScanLog from './models/ScanLog.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_REPLICA_URI = process.env.MONGODB_REPLICA_URI;

const SAMPLE_PARTICIPANTS = [
  {
    userId: 'USER-1001',
    teamNumber: 'TEAM-101',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@example.com',
    section: 'CSE-A',
    status: 'checked-out',
    checkInTime: '17/08/2026, 09:00:00 AM',
    checkOutTime: '17/08/2026, 05:30:00 PM',
    duration: '8h 30m 0s'
  },
  {
    userId: 'USER-1002',
    teamNumber: 'TEAM-102',
    name: 'Ananya Patel',
    email: 'ananya.patel@example.com',
    section: 'ECE-B',
    status: 'checked-in',
    checkInTime: '17/08/2026, 09:30:00 AM',
    checkOutTime: null,
    duration: 'Active'
  },
  {
    userId: 'USER-1003',
    teamNumber: 'TEAM-103',
    name: 'Sandeep Rangarajan',
    email: 'sandeep.rangarajan@example.com',
    section: 'CSE-B',
    status: 'registered',
    checkInTime: null,
    checkOutTime: null,
    duration: null
  }
];

async function seedMongoAtlas() {
  console.log('Connecting to MongoDB Atlas Cluster for Seeding...');
  try {
    try {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
      console.log('✓ Connected via SRV Cluster URI');
    } catch (e) {
      await mongoose.connect(MONGODB_REPLICA_URI);
      console.log('✓ Connected via Replica Set URI');
    }

    console.log('Creating sample rows in MongoDB Atlas collection "participants"...');

    for (const data of SAMPLE_PARTICIPANTS) {
      // Upsert by userId
      const existing = await Participant.findOne({ userId: data.userId });
      if (!existing) {
        const doc = new Participant(data);
        await doc.save();

        // Create interconnected ScanLog if checked-in or checked-out
        if (data.checkInTime) {
          const inLog = new ScanLog({
            participant: doc._id,
            userId: doc.userId,
            scanType: 'check-in',
            timestamp: data.checkInTime
          });
          await inLog.save();
          doc.scanLogs.push(inLog._id);
        }

        if (data.checkOutTime) {
          const outLog = new ScanLog({
            participant: doc._id,
            userId: doc.userId,
            scanType: 'check-out',
            timestamp: data.checkOutTime
          });
          await outLog.save();
          doc.scanLogs.push(outLog._id);
        }

        await doc.save();
        console.log(`✓ Seeded Row: Team ${data.teamNumber} - ${data.name} (${data.status.toUpperCase()})`);
      } else {
        console.log(`ℹ Row already exists: Team ${existing.teamNumber} - ${existing.name}`);
      }
    }

    console.log('✓ MongoDB Atlas Seeding Complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding Error:', err);
    process.exit(1);
  }
}

seedMongoAtlas();
