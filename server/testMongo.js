import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Participant from './models/Participant.js';
import ScanLog from './models/ScanLog.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_REPLICA_URI = process.env.MONGODB_REPLICA_URI;

async function checkMongo() {
  console.log('1. Testing Connection to MongoDB Atlas...');
  try {
    try {
      await mongoose.connect(MONGODB_REPLICA_URI);
      console.log('✓ Connected via Replica Set URI!');
    } catch (e) {
      await mongoose.connect(MONGODB_URI);
      console.log('✓ Connected via SRV URI!');
    }

    console.log('2. Current DB Name:', mongoose.connection.name);
    console.log('3. Collections in database:', Object.keys(mongoose.connection.collections));

    // Check count
    const count = await Participant.countDocuments();
    console.log('4. Participant Document Count in MongoDB Atlas:', count);

    if (count === 0) {
      console.log('5. Seeding 3 participant records into MongoDB Atlas...');
      const samples = [
        {
          userId: 'USER-1001',
          teamNumber: 'TEAM-101',
          name: 'Aarav Sharma',
          email: 'aarav.sharma@example.com',
          section: 'CSE-A',
          status: 'checked-out',
          checkInTime: '17/08/2026, 09:00:00 AM',
          checkOutTime: '17/08/2026, 05:30:00 PM',
          duration: '8h 30m 0s',
          sessionCount: 1
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
          duration: 'Active',
          sessionCount: 1
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
          duration: null,
          sessionCount: 0
        }
      ];

      await Participant.insertMany(samples);
      console.log('✓ Inserted 3 records into MongoDB Atlas!');
    }

    const all = await Participant.find().lean();
    console.log('6. All Records currently in MongoDB Atlas:');
    console.log(JSON.stringify(all, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('❌ Diagnostic Error:', err);
    process.exit(1);
  }
}

checkMongo();
