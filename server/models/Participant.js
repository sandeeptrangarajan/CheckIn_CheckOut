import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  teamNumber: {
    type: String,
    required: true,
    trim: true,
    default: 'TEAM-101'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  section: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['registered', 'checked-in', 'checked-out'],
    default: 'registered'
  },
  checkInTime: {
    type: String,
    default: null
  },
  checkOutTime: {
    type: String,
    default: null
  },
  scanLogs: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScanLog'
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Participant', participantSchema);
