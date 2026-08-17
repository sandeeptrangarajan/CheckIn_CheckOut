import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Participant from './models/Participant.js';
import ScanLog from './models/ScanLog.js';

dotenv.config();

const MONGODB_REPLICA_URI = process.env.MONGODB_REPLICA_URI;

async function testInsertAndFetch() {
  console.log('1. Connecting directly to MongoDB Atlas Replica Set...');
  await mongoose.connect(MONGODB_REPLICA_URI);
  console.log('✓ Connected to Cluster Database:', mongoose.connection.name);

  const testUserId = `USER-${Math.floor(1000 + Math.random() * 9000)}`;
  const testTeam = `TEAM-${Math.floor(500 + Math.random() * 400)}`;

  console.log(`2. Pushing new document into MongoDB Atlas collection "participants": ${testUserId} (${testTeam})...`);

  const newDoc = new Participant({
    userId: testUserId,
    teamNumber: testTeam,
    name: 'Sandeep Verified Student',
    email: 'sandeep.verified@example.com',
    section: 'CSE-A',
    status: 'registered',
    checkInTime: null,
    checkOutTime: null,
    duration: null,
    totalDurationMs: 0,
    sessionCount: 0
  });

  const savedDoc = await newDoc.save();
  console.log('✓ Document Successfully Inserted and Saved in MongoDB Atlas!');
  console.log('Saved Mongo _id:', savedDoc._id.toString());
  console.log('Saved document contents:');
  console.log(JSON.stringify(savedDoc, null, 2));

  console.log('\n3. Querying MongoDB Atlas to verify document persistence...');
  const found = await Participant.findById(savedDoc._id);
  if (found) {
    console.log('✓ VERIFIED! Document exists in MongoDB Atlas cluster!');
    console.log(`Found Team: ${found.teamNumber}, Name: ${found.name}, UserID: ${found.userId}`);
  } else {
    console.error('❌ Document not found after save!');
  }

  process.exit(0);
}

testInsertAndFetch();
