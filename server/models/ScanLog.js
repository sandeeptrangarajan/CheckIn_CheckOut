import mongoose from 'mongoose';

const scanLogSchema = new mongoose.Schema({
  participant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Participant',
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  scanType: {
    type: String,
    enum: ['check-in', 'check-out'],
    required: true
  },
  timestamp: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('ScanLog', scanLogSchema);
