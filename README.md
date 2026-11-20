# CineMate 🍿
> **"Different places. One movie. Together."**  
> *Your private, real-time cinema designed exclusively for two.*

![CineMate Preview](https://images.unsplash.com/photo-1518173946687-a4c8a383392e?auto=format&fit=crop&w=1200&q=80)

CineMate is a private, real-time movie-watching platform crafted exclusively for two people who are physically far apart but want to share intimate, cozy movie nights.

Unlike generic streaming websites or video chat apps, CineMate streams a movie file stored locally on the host's laptop directly to the guest's browser using **peer-to-peer WebRTC (`captureStream()`)**. 

**No movie file is ever uploaded to any cloud storage or server.** Both users watch in perfect synchronization with simultaneous webcams, microphones, live chat, floating reactions, and cute long-distance interactions.

---

## ✨ Key Features

### 🎬 Peer-to-Peer Local Movie Streaming
- **Zero Server Uploads:** Select an MP4, WebM, or MOV file on your computer. It streams directly to your partner via WebRTC.
- **Local Thumbnail Generation:** Automatic in-browser video thumbnail creation via offline HTML5 Canvas.
- **Synchronized Playback:** Millisecond-accurate synchronized Play, Pause, Resume, and Seeking (-10s / +10s) with automatic drift correction.
- **Dedicated Movie Audio Routing:** Movie audio is transmitted as a separate WebRTC media track so voice and movie audio never distort each other.

### 📹 Real-Time Webcams & Voice Chat
- **Dual Live Webcams:** Smooth WebRTC video with draggable floating Picture-in-Picture (PiP), side-by-side, or sidebar layouts.
- **Smart Audio Ducking:** Automatically lowers movie volume by 50% when either participant speaks, so you never miss a word.
- **Live Speaking Indicator:** Animated purple glowing ring pulses whenever voice audio is detected.
- **Camera & Mic Device Selectors:** Easily switch between webcams and microphones with a live audio level visualizer.

### 💖 Cute Long-Distance Interactions
- **Heart Burst:** Exploding shower of floating hearts across both screens.
- **Virtual Hug:** Avatars glide together with a glowing heart and warm embrace.
- **Toss Popcorn:** Playful popcorn animation thrown across the virtual cinema.
- **Miss You Button:** Tender message: *"Sending you a little hug from here ❤️"*.
- **Holding Hands:** Glowing connected hands animation.
- **Synchronized Heartbeat:** Real-time synchronized visual and sensory pulse.
- **Mood Selector:** Display your current vibe (Romantic, Cozy, Sleepy, Hungry, Confused) on your avatar.

### 🍿 Cozy Pre-Movie Lounge & Watchlist
- **Synchronized Countdown:** 3 → 2 → 1 → MOVIE TIME! synchronized countdown with celebratory confetti.
- **Movie Night Checklist:** Vibe selector (Cozy, Romantic, Horror, Comedy) + Snack checklist (Popcorn, Hot Cocoa, Nachos).
- **Shared Watchlist:** Curate your movie bucket list together.
- **Movie Roulette:** Can't decide? Let the random picker choose tonight's movie with celebratory fanfare!
- **Movie Night Memory Summary:** At the end of the night, record your favorite moments, rate the movie, and save the memory.

### 🎨 6 Atmospheric Themes
- **Midnight Cinema** (Default): Cosmic obsidian with violet & lilac glow.
- **Purple Dream:** Dreamy purple haze with neon pink accents.
- **Cozy Bedroom:** Warm candlelit amber and hot chocolate tones.
- **Pink Romance:** Gentle blush petals and warm intimacy.
- **Retro Cinema:** Vintage projector sepia and gold noir.
- **Galaxy Night:** Starlight deep navy with celestial electric blue.

---

## 🛠️ Tech Stack & Architecture

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React, Canvas-Confetti, QRCode
- **P2P Communication:** WebRTC `RTCPeerConnection`, `MediaStreamTrack`, `RTCDataChannel`, HTMLVideoElement `captureStream()`
- **Signaling:** Dual-mode architecture:
  1. **Supabase Realtime Broadcast & Presence:** For seamless cross-device internet connections.
  2. **Browser BroadcastChannel Fallback:** Automatic zero-config fallback for instant same-machine multi-tab testing with zero backend required!
- **Deployment:** Vercel (SPA rewrite rules configured in `vercel.json`).

---

## 🚀 Quick Start & Local Testing

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd cine
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Testing with Two Browsers (Host & Guest)

You can easily test CineMate on a single computer using two browser windows (or an Incognito window):

1. **Browser 1 (Host):**
   - Click **Create Room**.
   - Enter your name (e.g. `Alex`) and click **Create & Enter Lobby**.
   - In the lobby, click **Browse Local File** and select any sample `.mp4` or `.webm` video from your computer.
   - Click **Copy Invite Link**.

2. **Browser 2 (Guest):**
   - Open a new window (or Incognito tab) and paste the invite link (e.g. `http://localhost:5173/#room=abc-123-xyz`).
   - The pre-join screen will open with your webcam & mic preview.
   - Enter your name (e.g. `Sarah`) and click **Join Movie Night**.

3. **In the Lobby:**
   - Both users will see each other's live connection and avatars.
   - Both users click **"I'm Ready to Watch 🍿"**.
   - Watch the synchronized **3 → 2 → 1 Countdown** and enjoy the movie together!

---

## ☁️ Supabase Configuration (For Cross-Device Over the Internet)

If you want to connect across two different physical computers over the internet:

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public key`
3. Either:
   - Create a `.env` file from `.env.example`:
     ```env
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     ```
   - **Or directly enter them inside the app:** Click the **Settings icon ⚙️ → Signaling & P2P tab**, paste your Supabase URL & Key, and click **Save & Connect**!
4. *(Optional Database Tables)*: Run the SQL in `supabase/schema.sql` inside your Supabase SQL Editor if you wish to persist rooms and history.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / Pause Movie |
| `Left Arrow` | Rewind 10 seconds |
| `Right Arrow` | Forward 10 seconds |
| `F` | Toggle Fullscreen |
| `M` | Mute / Unmute Movie Audio |
| `C` | Toggle Webcam On / Off |
| `V` | Toggle Microphone On / Off |
| `1` | Send ❤️ Reaction |
| `2` | Send 😂 Reaction |
| `3` | Send 😭 Reaction |
| `4` | Send 😱 Reaction |
| `5` | Send 🔥 Reaction |

*(Shortcuts are disabled when typing in chat or input fields)*

---

## 🔒 Privacy & Security

- **Strict 2-Person Limit:** Rooms are restricted to 2 participants.
- **Unguessable Room IDs:** Generated using cryptographic randomness (e.g., `h7k-92m-x4p`).
- **No Video Uploads:** Movie files never leave the host's computer to any cloud server; only peer-to-peer MediaStream packets are transferred directly.
- **No Call Recording:** Video and audio streams are ephemeral and never recorded.

---

## 📦 Vercel Deployment

Deploy directly to Vercel with one click:
```bash
npm run build
```
Or push to GitHub and import into Vercel. `vercel.json` is already configured for single-page routing!

---

*Made with ❤️ for long-distance lovers and best friends everywhere.* 🍿
