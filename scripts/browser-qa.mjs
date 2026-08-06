import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const screenshotDir = '/home/btema2/.gemini/antigravity/brain/252b9214-8d91-4784-965c-a9ce7ebe7a12/screenshots';
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 760 },
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  console.log('=== STARTING BROWSER QA VERIFICATION ===');

  // 1. Screenshot Login Screen (390x760)
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(screenshotDir, '06_login_screen_390.png') });
  console.log('Captured 06_login_screen_390.png');

  // Register / Login user
  const email = `testuser_${Date.now()}@example.com`;
  const password = 'Password123!';

  await page.goto('http://localhost:3000/register');
  await page.fill('input[name="name"]', 'Мобільний Користувач');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  await page.waitForURL('http://localhost:3000/');
  await page.waitForLoadState('networkidle');

  // 2. Screenshot Room List (390x760)
  await page.screenshot({ path: path.join(screenshotDir, '01_room_list_390.png') });
  console.log('Captured 01_room_list_390.png');

  // Navigate to Room 1 (Акваріум) Schedule
  await page.click('a[href^="/rooms/"]:first-of-type');
  await page.waitForLoadState('networkidle');

  // 3. Screenshot Week Pager (390x760)
  await page.screenshot({ path: path.join(screenshotDir, '02_week_pager_390.png') });
  console.log('Captured 02_week_pager_390.png');

  // Navigate to Next Week to ensure all 7 days and 20 slots are strictly in the future
  await page.click('button[aria-label="Наступний тиждень"]');
  await page.waitForLoadState('networkidle');

  // Click a free slot on mobile pager in next week
  const freeSlot = page.locator('[data-grid-cell]').first();
  await freeSlot.click();

  await page.waitForSelector('[role="dialog"]');
  // 4. Screenshot Create Form (390x760)
  await page.screenshot({ path: path.join(screenshotDir, '03_create_form_390.png') });
  console.log('Captured 03_create_form_390.png');

  // Submit Create Booking
  await page.fill('#title-input', 'Мобільна зустріч QA');

  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/bookings') && res.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ]);

  console.log(`Booking API response status: ${response.status()}`);
  const resBody = await response.text();
  console.log(`Booking API response body: ${resBody}`);

  // Wait for modal to close and booking to appear
  await page.waitForSelector('button:has-text("Ви ·")', { timeout: 5000 });
  console.log('Booking successfully created via touch!');

  // Click own booking to open Cancel Dialog
  const ownBookingBtn = page.locator('button:has-text("Ви ·")').first();
  await ownBookingBtn.click();

  await page.waitForSelector('[role="dialog"]');
  // 5. Screenshot Cancel Dialog (390x760)
  await page.screenshot({ path: path.join(screenshotDir, '04_cancel_dialog_390.png') });
  console.log('Captured 04_cancel_dialog_390.png');

  // Confirm cancel
  const [deleteResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/bookings/') && res.request().method() === 'DELETE'),
    page.click('button:has-text("Скасувати бронювання")'),
  ]);
  console.log(`Cancel API response status: ${deleteResponse.status()}`);

  await page.waitForSelector('button:has-text("Ви ·")', { state: 'detached', timeout: 5000 });
  console.log('Booking successfully cancelled via touch!');

  // 6. Screenshot My Bookings (390x760)
  await page.goto('http://localhost:3000/my-bookings');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(screenshotDir, '05_my_bookings_390.png') });
  console.log('Captured 05_my_bookings_390.png');

  // Breakpoint scrollWidth Audit (320, 360, 390, 420, 600, 760, 761, 1024, 1440)
  const breakpoints = [320, 360, 390, 420, 600, 760, 761, 1024, 1440];
  const auditResults = [];

  for (const width of breakpoints) {
    await page.setViewportSize({ width, height: 760 });
    let widthPass = true;
    const pageDetails = [];

    for (const pathUrl of ['/', '/my-bookings', '/rooms/1']) {
      await page.goto(`http://localhost:3000${pathUrl}`);
      await page.waitForLoadState('networkidle');

      const dimensions = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        };
      });

      pageDetails.push(`${pathUrl}: ${dimensions.scrollWidth}px <= ${dimensions.innerWidth}px`);

      if (dimensions.scrollWidth > dimensions.innerWidth) {
        widthPass = false;
        console.error(`Horizontal scroll detected at width ${width}px on ${pathUrl}: scrollWidth=${dimensions.scrollWidth}, innerWidth=${dimensions.innerWidth}`);
      }
    }

    auditResults.push({
      width,
      status: widthPass ? 'PASS' : 'FAIL',
      details: pageDetails.join(' | '),
    });
  }

  console.log('\n=== SCROLL WIDTH AUDIT RESULTS ===');
  console.table(auditResults);

  console.log('\n=== CONSOLE LOG AUDIT ===');
  if (consoleErrors.length === 0) {
    console.log('Console is completely CLEAN (0 errors).');
  } else {
    console.warn('Console errors found:', consoleErrors);
  }

  await browser.close();
}

main().catch((err) => {
  console.error('QA script error:', err);
  process.exit(1);
});
