import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const URL = 'http://localhost:3847';
const FEEDBACK_FILE = path.resolve('samples/all-blocks.lesson.feedback.json');
const FEEDBACK_FILE2 = path.resolve('samples/all-blocks.lesson.feedback2.json');

async function wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function assertEq(label: string, actual: any, expected: any) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${pass ? '✓' : '✗'} ${label}: ${JSON.stringify(actual)} ${pass ? '' : `(expected ${JSON.stringify(expected)})`}`);
  if (!pass) process.exitCode = 1;
}

async function main() {
  // Clean any leftover feedback
  if (fs.existsSync(FEEDBACK_FILE)) fs.unlinkSync(FEEDBACK_FILE);
  if (fs.existsSync(FEEDBACK_FILE2)) fs.unlinkSync(FEEDBACK_FILE2);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // ── 1. Page load ──
  await page.goto(URL, { waitUntil: 'networkidle' });
  const title = await page.locator('h1').first().textContent();
  assertEq('Lesson page title includes test', title.includes('Lesson Workbench Test'), true);

  const blockCount = await page.locator('[data-order]').count();
  assertEq('Block count', blockCount, 12);

  // ── 2. Difficulty stars ──
  const starBlock = page.locator('[data-difficulty="1"]');
  const starBtns = starBlock.locator('button');
  await starBtns.nth(3).click(); // 4-star
  await wait(100);
  // Check stars 1-4 are "on"
  for (let i = 0; i < 4; i++) {
    const cls = await starBtns.nth(i).getAttribute('class');
    assertEq(`Star ${i+1} class`, cls, 'on');
  }
  const star5 = await starBtns.nth(4).getAttribute('class');
  assertEq('Star 5 class', star5, null);

  // ── 3. Comment ──
  const commentTextarea = page.locator('[data-comment="3"] textarea');
  await commentTextarea.fill('This explanation is very clear, helped me understand thread dumps.');
  await page.locator('.block-title').first().click(); // blur the textarea
  await wait(200);

  // ── 4. Recall answer ──
  const recallTextarea = page.locator('[data-answer="8"] textarea');
  await recallTextarea.fill('It prevents concurrent access by forcing threads to acquire a monitor lock.');
  await page.locator('.block-title').first().click(); // blur
  await wait(200);

  // ── 5. Quiz ──
  const quizRadio = page.locator('input[name="q_9"][value="d"]');
  await quizRadio.click();
  await wait(100);
  const isChecked = await quizRadio.isChecked();
  assertEq('Quiz option d checked', isChecked, true);

  // ── 6. Insert note ──
  page.once('dialog', async dialog => {
    await dialog.accept('Add a diagram showing the request flow in more detail.');
  });
  await page.locator('.act-insert-note').first().click();
  await wait(200);

  // Wait for dialog handling
  await wait(500);

  // ── 7. Select text and annotate ──
  const explBlock = page.locator('[data-order="3"]');
  const textEl = explBlock.locator('p.block-text');
  // Select via evaluate — Playwright selectText doesn't trigger mouseup
  await page.evaluate(() => {
    const el = document.querySelector('[data-order="3"] p.block-text');
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    // Dispatch mouseup to trigger toolbar
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await wait(500);

  // Toolbar should appear
  const toolbar = page.locator('#hlToolbar');
  const toolbarVisible = await toolbar.isVisible();
  assertEq('Toolbar visible after selection', toolbarVisible, true);

  // Click Annotate
  page.once('dialog', async dialog => {
    assertEq('Annotation prompt default', '', '');
    await dialog.accept('This text explains the visual annotation feature.');
  });
  await page.locator('#hlAnnot').click();
  await wait(500);

  // Check that .annotated span appeared
  const annSpans = await page.locator('span.annotated').count();
  assertEq('Annotation span count', annSpans, 1);

  // Check title attribute
  const annTitle = await page.locator('span.annotated').getAttribute('title');
  assertEq('Annotation title', annTitle, 'This text explains the visual annotation feature.');

  // ── 8. Click annotation to edit ──
  page.once('dialog', async dialog => {
    assertEq('Edit dialog default', dialog.defaultValue(), 'This text explains the visual annotation feature.');
    await dialog.accept('EDITED: This text shows how visual annotation markers work.');
  });
  await page.locator('span.annotated').click();
  await wait(300);

  const editedTitle = await page.locator('span.annotated').getAttribute('title');
  assertEq('Edited annotation title', editedTitle, 'EDITED: This text shows how visual annotation markers work.');

  // ── 9. Submit feedback ──
  const btn = page.locator('#submitFeedback');
  await btn.click();
  await wait(1000);

  // Check success message
  const status = await page.locator('#submitStatus').textContent();
  assertEq('Submit status', status, 'Feedback saved! ✓');

  // Check feedback file exists
  const fbExists = fs.existsSync(FEEDBACK_FILE);
  assertEq('Feedback file exists', fbExists, true);

  // Check file contents
  const fb = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf-8'));
  const actionCount = fb.actions.length;
  console.log(`  Feedback actions: ${actionCount}`);
  assertEq('Difficulty present', fb.actions.some((a: any) => a.action === 'difficulty'), true);
  assertEq('Comment present', fb.actions.some((a: any) => a.action === 'comment'), true);
  assertEq('Answer present', fb.actions.some((a: any) => a.action === 'answer'), true);
  assertEq('Choice present', fb.actions.some((a: any) => a.action === 'choice'), true);
  assertEq('Insert note present', fb.actions.some((a: any) => a.action === 'insert_note'), true);
  assertEq('Annotation present', fb.actions.some((a: any) => a.action === 'annotation'), true);

  // ── 10. Reload — check actions are 0 (fresh start) ──
  await page.reload({ waitUntil: 'networkidle' });
  await wait(500);

  const countReload = await page.locator('#actionCount').textContent();
  assertEq('Action count after reload', countReload, '0 action(s)');

  // ── 11. Second round — make 1 action and submit ──
  // Delete old feedback
  if (fs.existsSync(FEEDBACK_FILE)) fs.unlinkSync(FEEDBACK_FILE);

  // Rate difficulty on block 12
  await page.locator('[data-difficulty="12"] button[data-star="2"]').click();
  await wait(100);

  // Submit
  await btn.click();
  await wait(1500);

  // Check only 1 action in file
  const fb2 = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf-8'));
  assertEq('Second submit actions', fb2.actions.length, 1);
  assertEq('Second submit action type', fb2.actions[0].action, 'difficulty');
  assertEq('Second submit rating', fb2.actions[0].rating, 2);

  // ── 12. Verify localStorage is empty ──
  await wait(1500); // Wait for fetch + .then() to complete
  const lsKeys = await page.evaluate(() =>
    JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith('lw_actions_')))
  );
  const lsVal = await page.evaluate(() =>
    JSON.stringify(Object.fromEntries(
      Object.entries(localStorage).filter(([k]) => k.startsWith('lw_actions_'))
    ))
  );
  console.log(`  localStorage keys: ${lsKeys}`);
  console.log(`  localStorage vals: ${lsVal}`);
  const lsCount = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('lw_actions_')).length);
  assertEq('localStorage lw_actions keys after submit', lsCount, 0);

  // ── 13. Verify annotation still visible visually in DOM ──
  // After reload, annotations are gone (no restore from localStorage)
  const annAfterReload = await page.locator('span.annotated').count();
  assertEq('Annotations after reload (no restore)', annAfterReload, 0);

  console.log('\n=== ALL PLAYWRIGHT TESTS DONE ===');
  await browser.close();
}

main().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
