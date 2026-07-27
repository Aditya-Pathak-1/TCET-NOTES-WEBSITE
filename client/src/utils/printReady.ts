/**
 * Waits until a print popup window has finished layout before calling print().
 * Prevents blank body pages when export runs before multi-page HTML is painted.
 */
export async function waitForPrintWindowReady(
  win: Window,
  contentSelector = '.notes-content',
  minContentChars = 20,
  timeoutMs = 30000
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('Print window did not finish loading in time'));
    }, timeoutMs);

    const finish = () => {
      window.clearTimeout(timeout);
      resolve();
    };

    if (win.document.readyState === 'complete') {
      finish();
    } else {
      win.addEventListener('load', finish, { once: true });
    }
  });

  try {
    await win.document.fonts.ready;
  } catch {
    // Older browsers may not support FontFaceSet
  }

  // Wait until document height stabilizes (multi-page layout complete)
  let lastHeight = 0;
  for (let i = 0; i < 30; i++) {
    const height = win.document.body.scrollHeight;
    if (height > 0 && height === lastHeight) break;
    lastHeight = height;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  // Two animation frames so the browser completes its paint pass
  await new Promise<void>((resolve) => {
    win.requestAnimationFrame(() => {
      win.requestAnimationFrame(() => resolve());
    });
  });

  const contentEl = win.document.querySelector(contentSelector);
  const text = contentEl?.textContent?.trim() ?? '';
  if (text.length < minContentChars) {
    throw new Error('Notes content is not ready for export yet. Please wait for generation to finish.');
  }
}

export function printWhenReady(win: Window, contentSelector = '.notes-content'): void {
  void waitForPrintWindowReady(win, contentSelector)
    .then(() => {
      win.focus();
      win.print();
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Print failed';
      win.close();
      throw new Error(message);
    });
}
