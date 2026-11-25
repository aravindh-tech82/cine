import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MP4_PATH = path.resolve(__dirname, 'sample-movie.mp4');

async function test() {
  console.log('=== INVESTIGATING USER ISSUE (NORMAL + INCOGNITO) ===');

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

  const logs = [];
  function recordLog(source, msg) {
    const time = new Date().toISOString().substring(11, 23);
    const line = `[${time}] [${source}] ${msg}`;
    console.log(line);
    logs.push(line);
  }

  hostPage.on('console', m => recordLog('HOST', m.text()));
  guestPage.on('console', m => recordLog('GUEST', m.text()));
  hostPage.on('pageerror', e => recordLog('HOST-ERR', e.message));
  guestPage.on('pageerror', e => recordLog('GUEST-ERR', e.message));

  // 1. Host creates room
  await hostPage.goto('http://127.0.0.1:5173/');
  await hostPage.click('text=Create Your Movie Room');
  await hostPage.fill('input[placeholder="e.g. Alex"]', 'Alex Host');
  await hostPage.click('button:has-text("Create & Enter Lobby")');
  await hostPage.waitForSelector('text=Participants (2 max)');

  const roomIdText = await hostPage.textContent('span:has-text("Room ID:")');
  const roomIdMatch = roomIdText?.match(/Room ID:\s*([a-zA-Z0-9\-_]+)/);
  const roomId = roomIdMatch ? roomIdMatch[1] : '';
  console.log('>>> Room ID created:', roomId);

  // Host selects local movie file
  const fileInput = await hostPage.$('input[type="file"]');
  if (fileInput) {
    await fileInput.setInputFiles(MP4_PATH);
  }
  await hostPage.waitForSelector('text=sample-movie');
  console.log('>>> Host loaded movie file');

  // 2. Guest joins via invitation link
  const inviteUrl = `http://127.0.0.1:5173/#room=${roomId}`;
  console.log('>>> Guest navigating to:', inviteUrl);
  await guestPage.goto(inviteUrl);
  await guestPage.waitForSelector('input[placeholder="e.g. Sarah"]');
  await guestPage.fill('input[placeholder="e.g. Sarah"]', 'Sam Guest');
  await guestPage.click('button:has-text("Join Movie Night")');
  await guestPage.waitForSelector('text=Participants (2 max)');
  console.log('>>> Guest joined lobby');

  // 3. Ready up
  await hostPage.waitForTimeout(1000);
  const hostReadyBtn = await hostPage.$('button:has-text("Ready")');
  if (hostReadyBtn) await hostReadyBtn.click();
  await hostPage.waitForTimeout(600);
  const guestReadyBtn = await guestPage.$('button:has-text("Ready")');
  if (guestReadyBtn) await guestReadyBtn.click();
  console.log('>>> Both readied up');

  // Wait for Movie Room transition
  await hostPage.waitForSelector('button:has-text("Interactions")', { timeout: 12000 });
  await guestPage.waitForSelector('button:has-text("Interactions")', { timeout: 12000 });
  console.log('>>> Both entered Movie Room!');

  // Check state for 5 seconds BEFORE host presses play
  console.log('\n--- OBSERVING MOVIE ROOM BEFORE PLAY ---');
  for (let i = 0; i < 5; i++) {
    const guestUI = await guestPage.evaluate(() => {
      return {
        h3: document.querySelector('.bg-\\[\\#0B0A10\\]\\/95 h3')?.innerText,
        sub: document.querySelector('.bg-\\[\\#0B0A10\\]\\/95 p')?.innerText,
        statusPill: document.querySelector('.bg-\\[\\#0B0A10\\]\\/95 div.rounded-full span:last-child')?.innerText,
        headerStep: document.querySelector('header span.text-gray-300')?.innerText,
      };
    });
    console.log(`[Before Play T+${i}s] GUEST UI:`, JSON.stringify(guestUI));
    await hostPage.waitForTimeout(1000);
  }

  // 4. Host presses Play!
  console.log('\n--- HOST PRESSES PLAY ---');
  await hostPage.keyboard.press('Space');
  await hostPage.waitForTimeout(3000);

  // Check state for 5 seconds AFTER host presses play
  for (let i = 0; i < 5; i++) {
    const guestUI = await guestPage.evaluate(() => {
      const v = document.querySelector('video');
      return {
        overlayH3: document.querySelector('.bg-\\[\\#0B0A10\\]\\/95 h3')?.innerText || null,
        headerStep: document.querySelector('header span.text-gray-300')?.innerText,
        videoPaused: v ? v.paused : null,
        videoTime: v ? v.currentTime : null,
        hasSrcObject: Boolean(v && v.srcObject),
        tracks: v && v.srcObject ? v.srcObject.getTracks().map(t => ({ kind: t.kind, readyState: t.readyState })) : [],
      };
    });
    console.log(`[After Play T+${i}s] GUEST UI:`, JSON.stringify(guestUI));
    await hostPage.waitForTimeout(1000);
  }

  await browser.close();
}

test().catch(console.error);

