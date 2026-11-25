import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MP4_PATH = path.resolve(__dirname, 'sample-movie.mp4');

async function trace() {
  console.log('=== TRACING CINEMATE HOST & GUEST SDP NEGOTIATION ===');
  
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  const hostContext = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const guestContext = await browser.newContext({ permissions: ['camera', 'microphone'] });

  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  const allLogs = [];
  function logEvent(source, msg) {
    const time = new Date().toISOString().substring(11, 23);
    const line = `[${time}] [${source}] ${msg}`;
    console.log(line);
    allLogs.push(line);
  }

  hostPage.on('console', m => logEvent('HOST-LOG', m.text()));
  guestPage.on('console', m => logEvent('GUEST-LOG', m.text()));
  hostPage.on('pageerror', err => logEvent('HOST-ERR', err.message));
  guestPage.on('pageerror', err => logEvent('GUEST-ERR', err.message));

  // 1. Host creates room
  await hostPage.goto('http://127.0.0.1:5173/');
  await hostPage.click('text=Create Your Movie Room');
  await hostPage.fill('input[placeholder="e.g. Alex"]', 'Alex Host');
  await hostPage.click('button:has-text("Create & Enter Lobby")');
  await hostPage.waitForSelector('text=Participants (2 max)');

  // Get Room ID
  const roomIdText = await hostPage.textContent('span:has-text("Room ID:")');
  const roomIdMatch = roomIdText?.match(/Room ID:\s*([a-zA-Z0-9\-_]+)/);
  const roomId = roomIdMatch ? roomIdMatch[1] : '';
  console.log('>>> Room ID is:', roomId);

  // Host selects local movie
  const fileInput = await hostPage.$('input[type="file"]');
  if (fileInput) {
    await fileInput.setInputFiles(MP4_PATH);
  }
  await hostPage.waitForSelector('text=sample-movie');
  console.log('>>> Host movie selected');

  // 2. Guest joins
  const inviteUrl = `http://127.0.0.1:5173/#room=${roomId}`;
  await guestPage.goto(inviteUrl);
  await guestPage.waitForSelector('input[placeholder="e.g. Sam"]');
  await guestPage.fill('input[placeholder="e.g. Sam"]', 'Sam Guest');
  await guestPage.click('button:has-text("Enter Movie Lobby")');
  await guestPage.waitForSelector('text=Participants (2 max)');
  console.log('>>> Guest joined lobby');

  // 3. Both click Ready
  await hostPage.waitForTimeout(1000);
  await guestPage.click('button:has-text("I\'m Ready to Watch")');
  await hostPage.waitForTimeout(500);
  await hostPage.click('button:has-text("I\'m Ready to Watch")');
  console.log('>>> Ready clicked on both');

  // Wait for Movie Room
  await hostPage.waitForSelector('button:has-text("Interactions")', { timeout: 10000 });
  await guestPage.waitForSelector('button:has-text("Interactions")', { timeout: 10000 });
  console.log('>>> Both entered Movie Room!');

  // Wait 10 seconds to observe Movie Room negotiation state
  for (let i = 0; i < 10; i++) {
    const hostState = await hostPage.evaluate(() => {
      const pc = window.__webrtcManager?.pc;
      return {
        step: document.querySelector('.bg-white\\/\\[0\\.03\\] span.text-gray-300')?.innerText,
        sigState: pc?.signalingState,
        iceState: pc?.iceConnectionState,
        connState: pc?.connectionState,
      };
    });
    const guestState = await guestPage.evaluate(() => {
      const pc = window.__webrtcManager?.pc;
      return {
        step: document.querySelector('.bg-white\\/\\[0\\.03\\] span.text-gray-300')?.innerText,
        mainScreen: document.querySelector('h3.font-heading')?.innerText,
        subMsg: document.querySelector('div.bg-amber-500\\/10 span:last-child')?.innerText,
        sigState: pc?.signalingState,
        iceState: pc?.iceConnectionState,
        connState: pc?.connectionState,
      };
    });
    console.log(`[T+${i}s] HOST:`, JSON.stringify(hostState), '| GUEST:', JSON.stringify(guestState));
    await hostPage.waitForTimeout(1000);
  }

  await browser.close();
}

trace().catch(console.error);

