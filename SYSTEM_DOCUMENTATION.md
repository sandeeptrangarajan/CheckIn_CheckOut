# 🚀 Hackathon Gate Attendance Portal — System Documentation

## 📌 Overview
The **Hackathon Gate Attendance Portal** is a production-ready, full-stack event attendance tracking system. It integrates a **React (Vite) Frontend** with an **Express & MongoDB Atlas Backend**, managing attendee check-ins and check-outs using a **Single Common Master Event QR Code**.

---

## 🎯 Core Features & Workflow

### 1. Team Number Login & Registration (First-Time vs Returning Users)
- **First-Time Users**: Enter **Team Number** (e.g. `TEAM-101`), **Name of Student**, **Email Address**, and **Class/Section**. Submitting creates a new row document directly inside **MongoDB Atlas (`cse_hackathon`)**.
- **Returning Users (Quick Access)**: Enter existing **Team Number** on the Login screen. The system skips registration and **directly redirects to the Scanner Terminal**.

### 2. Single Common Master QR Code System
- All attendees scan the **same, single event QR code** (`HACKATHON-GATE-2026`).
- **1st Scan**: Asks for explicit confirmation, logs `checkInTime` (timestamp), updates MongoDB status to `checked-in`, and triggers celebration confetti.
- **2nd Scan**: Asks for explicit confirmation, logs `checkOutTime` (timestamp), calculates the exact **In-Between Time (Duration)** (e.g. `8h 30m 0s`), updates MongoDB status to `checked-out`, and stores the duration in both MongoDB & Excel roster exports.

### 3. Real Webcam & Fallback Scanning Options
- Powered by `Html5Qrcode` for 100% cross-browser webcam device compatibility (Chrome, Edge, Safari, Firefox, Mobile).
- Built-in user selection simulator and image file upload fallback.

### 4. Admin Control Dashboard & Excel Roster Export
- Displays real-time metrics (Total Students, Checked In, Checked Out, Attendance Rate).
- Live search filtering by Team Number, Student Name, Section, or Status.
- **Manual Export to Excel (`.xlsx`)**: Generates formatted spreadsheet containing `Team Number`, `User ID`, `Name of Student`, `Email Address`, `Class/Section`, `Status`, `Check-In Time`, `Check-Out Time`, and `In-Between Time (Duration)`.

---

## 🍃 MongoDB Atlas Database Schemas

### `Participant` Schema ([`server/models/Participant.js`](file:///c:/Dev/hackathon-portal/server/models/Participant.js))
```javascript
{
  userId: { type: String, required: true, unique: true },
  teamNumber: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  section: { type: String, required: true },
  status: { type: String, enum: ['registered', 'checked-in', 'checked-out'], default: 'registered' },
  checkInTime: { type: String, default: null },
  checkOutTime: { type: String, default: null },
  duration: { type: String, default: null },
  scanLogs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ScanLog' }],
  createdAt: { type: Date, default: Date.now }
}
```

### `ScanLog` Schema ([`server/models/ScanLog.js`](file:///c:/Dev/hackathon-portal/server/models/ScanLog.js))
```javascript
{
  participant: { type: mongoose.Schema.Types.ObjectId, ref: 'Participant', required: true },
  userId: { type: String, required: true },
  scanType: { type: String, enum: ['check-in', 'check-out'], required: true },
  timestamp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}
```

---

## 📡 API Endpoints (`http://localhost:5000/api`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Backend & MongoDB Atlas connection status |
| `GET` | `/api/stats` | Analytics metrics & section breakdown |
| `GET` | `/api/participants` | Fetch all team rows with populated scan logs |
| `POST` | `/api/participants/login` | Team login & quick scanner redirection |
| `POST` | `/api/participants/register` | Create a new team participant row in MongoDB |
| `POST` | `/api/participants/scan` | Process 1st Scan (Check-In) / 2nd Scan (Check-Out & calculate duration) |
| `DELETE` | `/api/participants/:id` | Delete team row & associated scan logs |

---

## 💻 Quickstart Commands

### Start Backend Express MongoDB Server
```bash
cd server
npm install
node index.js
```

### Seed Sample MongoDB Atlas Rows
```bash
cd server
node seedData.js
```

### Start Frontend Dev Server
```bash
npm install
npm run dev
```

---

## 🌐 GitHub Repository
- **URL**: [https://github.com/sandeeptrangarajan/CheckIn_CheckOut.git](https://github.com/sandeeptrangarajan/CheckIn_CheckOut.git)
- **Maintainer**: Sandeep Rangarajan
