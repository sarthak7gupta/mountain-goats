// Online (v4) end-to-end check. Start the server first:
//   pnpm build && PORT=3111 MODE=online PUBLIC_ORIGIN=http://localhost:3111 DATABASE_PATH=/tmp/goats-e2e.sqlite pnpm exec tsx server/http.ts
//   BASE=http://localhost:3111 node tests/browser-online.mjs
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE || 'http://localhost:3111';
const password = 'correct-horse-battery-staple';
const suffix = Date.now().toString(36).slice(-5);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
const watch = (page) => page.on('pageerror', (e) => errors.push(e.message));
async function signUp(page, username) {
  await page.goto(base);
  await page.getByRole('button', { name: 'Need an account? Create one →' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('heading', { name: `Hello, ${username}` }).waitFor();
}
async function signIn(page, username) {
  await page.getByLabel('Username').fill(username);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: `Hello, ${username}` }).waitFor();
}
try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const host = await desktop.newPage();
  const guest = await phone.newPage();
  watch(host);
  watch(guest);
  const hostName = `host_${suffix}`;
  const guestName = `guest_${suffix}`;

  // An anonymous visitor cannot create or join, but can always play pass-and-play locally.
  await host.goto(base);
  if (!(await host.getByRole('button', { name: /Sign in to continue/ }).isDisabled()))
    throw new Error('Anonymous visitor can create a room');
  await host.getByRole('button', { name: 'Pass & play' }).click();
  await host.getByRole('heading', { name: 'Player Setup' }).waitFor();
  await host.getByRole('button', { name: '← Back to multiplayer' }).click();

  await signUp(host, hostName);
  await host.getByLabel('Your name').fill('Alpine host');
  await host.getByLabel('Seats').selectOption('2');
  await host.getByRole('checkbox', { name: /Public room/ }).check();
  await host.getByRole('checkbox', { name: /Big Mountain/ }).check();
  await host.getByRole('button', { name: /Create a room/ }).click();
  await host.getByRole('heading', { name: 'Your expedition starts here.' }).waitFor();
  const code = new URL(await host.getByLabel('Join link').inputValue()).searchParams.get('room');
  if (!(await host.getByText(`Signed in as ${hostName}`).isVisible())) throw new Error('No account chip');

  // The guest finds the public room, then joins with an account.
  await signUp(guest, guestName);
  await guest.getByRole('button', { name: `Choose room ${code}` }).click();
  await guest.getByLabel('Your name').fill('Phone guest');
  await guest.getByRole('button', { name: /Join the expedition/ }).click();
  await guest.getByText('Waiting for the host to start…').waitFor();

  await host.getByRole('button', { name: 'Start with 2 players' }).click();
  await host.getByRole('heading', { name: 'Your move. Aim higher.' }).waitFor();
  await guest.getByRole('heading', { name: 'Alpine host is climbing.' }).waitFor();
  await host.getByRole('button', { name: /^End turn/ }).click();
  await host.getByRole('button', { name: 'Pass turn', exact: true }).click();
  await guest.getByRole('heading', { name: 'Your move. Aim higher.' }).waitFor();

  // Same guest account on a brand-new device recovers the seat from the account.
  const tablet = await browser.newContext({ viewport: { width: 820, height: 1180 } });
  const second = await tablet.newPage();
  watch(second);
  await second.goto(base);
  await signIn(second, guestName);
  await second.getByRole('button', { name: `Resume room ${code}` }).click();
  await second.getByRole('heading', { name: 'Your move. Aim higher.' }).waitFor();

  // A different account cannot use a copied seat; it is forgotten on that device.
  const intruder = await browser.newContext();
  const thief = await intruder.newPage();
  watch(thief);
  await signUp(thief, `thief_${suffix}`);
  const seat = await second.evaluate(() => localStorage.getItem('mountain-goats-seat-v1'));
  await thief.evaluate((value) => localStorage.setItem('mountain-goats-seat-v1', value), seat);
  await thief.reload();
  await thief.getByRole('alert').filter({ hasText: 'another account' }).waitFor();
  await thief.getByRole('heading', { name: `Hello, thief_${suffix}` }).waitFor();

  // Signing out drops the seat on that device only.
  await second.getByRole('button', { name: 'Sign out' }).click();
  await second.getByRole('heading', { name: 'Sign in' }).waitFor();
  if (await second.evaluate(() => localStorage.getItem('mountain-goats-seat-v1')))
    throw new Error('Seat kept after sign-out');
  await guest.reload();
  await guest.getByRole('heading', { name: 'Your move. Aim higher.' }).waitFor();

  const width = await guest.evaluate(() => ({ viewport: innerWidth, doc: document.documentElement.scrollWidth }));
  if (width.doc > width.viewport) throw new Error(`Mobile overflow ${JSON.stringify(width)}`);
  await host.screenshot({ path: '/tmp/goats-online-desktop.png', fullPage: true });
  await guest.screenshot({ path: '/tmp/goats-online-mobile.png', fullPage: true });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(
    'PASS: anonymous gate, sign-up, public room discovery, account join, start, turn sync, cross-device resume, foreign-seat rejection, sign-out, mobile layout, no page errors'
  );
} finally {
  await browser.close();
}
