import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Participant from './models/Participant.js';
import ScanLog from './models/ScanLog.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_REPLICA_URI = process.env.MONGODB_REPLICA_URI;

async function cleanAndNormalizeMongo() {
  console.log('Connecting to MongoDB Atlas Cluster for Data Normalization...');
  try {
    try {
      await mongoose.connect(MONGODB_REPLICA_URI);
      console.log('✓ Connected via Replica Set URI!');
    } catch (e) {
      await mongoose.connect(MONGODB_URI);
      console.log('✓ Connected via SRV URI!');
    }

    console.log('Fetching all participant records from MongoDB Atlas...');
    const participants = await Participant.find();
    console.log(`Found ${participants.length} records to clean and format.`);

    for (let p of participants) {
      let changed = false;

      // 1. Clean Team Number (e.g. 'TEAM 1' -> 'TEAM-101', 'TEAM !' -> 'TEAM-100')
      let cleanTeam = p.teamNumber ? p.teamNumber.trim().toUpperCase().replace(/\s+/g, '-') : 'TEAM-101';
      if (cleanTeam === 'TEAM-!' || cleanTeam === 'TEAM-1') {
        cleanTeam = p.userId === 'USER-5416' ? 'TEAM-104' : 'TEAM-105';
      }
      if (p.teamNumber !== cleanTeam) {
        p.teamNumber = cleanTeam;
        changed = true;
      }

      // 2. Format Name Title Case (e.g. 'sandeep R' -> 'Sandeep R')
      if (p.name) {
        const cleanName = p.name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        if (p.name !== cleanName) {
          p.name = cleanName;
          changed = true;
        }
      }

      // 3. Format Section
      if (p.section) {
        const cleanSec = p.section.toUpperCase().replace(/\s+/g, '-');
        if (p.section !== cleanSec) {
          p.section = cleanSec;
          changed = true;
        }
      }

      if (changed) {
        await p.save();
        console.log(`✓ Cleaned Record: ${p.teamNumber} - ${p.name} (${p.section})`);
      }
    }

    console.log('✓ MongoDB Atlas Data Cleaning & Formatting Complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Data Cleaning Error:', err);
    process.exit(1);
  }
}

cleanAndNormalizeMongo();
