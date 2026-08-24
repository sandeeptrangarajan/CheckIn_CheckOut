# 🚀 Hackathon Attendance Gate System

An interactive full-stack QR code attendance system built with **React (Vite)**, **Lucide Icons**, **Express**, and **MongoDB Atlas Database**.

## ✨ Key Capabilities
- **Team Number Login & Registration**: Returning users enter Team Number to skip registration and launch the scanner immediately.
- **Single Common Master Event QR Code**: Shared QR (`HACKATHON-GATE-2026`) used for all attendees.
- **2-Step Scan Sequence**: 1st Scan = Check-In confirmation ➔ 2nd Scan = Check-Out confirmation.
- **In-Between Time (Duration) Tracking**: Calculates exact elapsed duration (`e.g., 8h 30m 0s`) and stores it in MongoDB Atlas and Excel exports.
- **Real Webcam Reader & Image Upload Fallback**: Powered by `Html5Qrcode`.
- **Admin Roster & Manual Excel Exporter**: Export formatted `.xlsx` spreadsheets on demand.

## 🛠 Setup & Launch

1. **MongoDB Express Backend**:
   ```bash
   cd server
   npm install
   node index.js
   ```

2. **Frontend React App**:
   ```bash
   npm install
   npm run dev
   ```

3. **Seed MongoDB Atlas Sample Data**:
   ```bash
   cd server
   node seedData.js
   ```

## 🔗 Repository & Maintainer
- **Maintainer**: Sandeep Rangarajan ([`sandeeptrangarajan@gmail.com`](mailto:sandeeptrangarajan@gmail.com))
- **GitHub Account**: [@sandeeptrangarajan](https://github.com/sandeeptrangarajan)
- **Repository URL**: [https://github.com/sandeeptrangarajan/CheckIn_CheckOut.git](https://github.com/sandeeptrangarajan/CheckIn_CheckOut.git)
- **Status**: Production Verified
