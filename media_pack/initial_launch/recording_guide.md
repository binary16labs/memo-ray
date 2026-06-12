# 📹 Browser Recording Guide: Crisp Text & High Resolution

When recording code terminals, graphs, and dashboard details, standard screen recorders often compress the video, making small text blurry and hard to read. To get crisp, high-resolution details for your Wes Anderson CRT templates, follow these methods.

---

## Method 1: OBS Studio (Best for Manual Recording)
OBS Studio is free, open-source, and produces lossless or near-lossless video recordings with zero compression blur.

### Configuration for Maximum Text Clarity:
1.  **Canvas & Output Resolution:**
    *   Go to **Settings > Video**.
    *   Set **Base (Canvas) Resolution** to your monitor's native resolution (e.g., `1920x1080`, `2560x1440`, or `3840x2160`).
    *   Set **Output (Scaled) Resolution** to match the Base resolution exactly. Do *not* downscale, as downscaling introduces text blur.
    *   Set **Common FPS Values** to `60` (or `30` if your hardware is older).
2.  **Recording Quality Settings:**
    *   Go to **Settings > Output** and change the Output Mode to **Advanced**, then select the **Recording** tab.
    *   **Encoder:** Select hardware encoding if available (e.g., `NVIDIA NVENC H.264` or `AMD HW H.264`).
    *   **Rate Control:** Change this to **CQP** (Constant Quality Parameter).
    *   **CQ Level:** Set this between **15 and 18** (lower values mean higher quality; `0` is lossless, but produces massive file sizes. `16` is indistinguishable from lossless).
3.  **Capture Source:**
    *   In the **Sources** box, click the `+` icon and choose **Window Capture** instead of Display Capture.
    *   Select your browser window (Chrome/Edge/Firefox). This keeps the capture focused strictly on the web app and avoids capturing your taskbar or notifications.

---

## Method 2: Playwright / Puppeteer (Best for Programmatic/Faceless Recording)
If you want to automate your walk-through actions exactly, you can use Node.js to record the browser page programmatically. Playwright has a native, lossless recording feature.

### 1. Initialize a quick script:
Create a script (e.g., `record.js`) in your project:

```javascript
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }, // Force crisp 1080p
    recordVideo: {
      dir: './recordings', // Output directory
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();
  await page.goto('http://localhost:5173');

  // Trigger your actions here
  await page.waitForTimeout(10000); // Record for 10 seconds

  await context.close();
  await browser.close();
})();
```

---

## Method 3: Windows 11 Snipping Tool (Quickest Setup)
Windows 11 Snipping Tool now carries a built-in screen recorder that is quick and lightweight.

1.  Press `Win + Shift + R` to open the screen recorder.
2.  Draw a boundary box exactly around your browser window viewport (excluding the tab bar and address bar).
3.  Click **Start** to record. 
4.  *Note: Snipping Tool is great for quick capture, but it compresses the video more than OBS, so very small code characters may have minor compression artifacts.*

---

## 💡 Pro Browser Tweaks for Video
*   **Zoom In:** Browsers display text at standard sizes which look tiny on 1080p video. Press `Ctrl + Plus (+)` in your browser to scale the UI to **125% or 150%**. This makes the text look massive, clear, and readable on video.
*   **Hide the Address Bar:** Press **F11** in your browser to go full-screen. This hides your URL, browser tabs, and bookmarks, leaving only the clean dashboard UI visible.
