# 📺 Wes Anderson Transition Frames Guide

This guide details how to use the generated transition templates to create a seamless, cinematic zoom effect for your faceless video presentation in either Premiere Pro, DaVinci Resolve, CapCut, or After Effects.

---

## 📁 Transition Assets Overview

The assets are saved in the `transitions/` directory:

*   **Landscape (16:9) Templates:**
    *   `transitions/wes_landscape_zoomed_out.png` — Overhead bird's-eye desk view (metronome, keyboard, tape deck) with a centered retro CRT monitor.
    *   `transitions/wes_landscape_zoomed_in.png` — Snap-zoomed direct front view of the CRT monitor frame.
    *   `transitions/wes_landscape_screen_fill.png` — Screen-filling CRT frame. The CRT screen takes up 95% of the frame, leaving only a thin curved bezel at the edges. Perfect for showing detailed code and dashboard text.
    *   `transitions/wes_crt_overlay_medium.png` — **(NEW)** Medium workstation frame (50% screen size). Excellent balance of desk elements and dashboard details.
    *   `transitions/wes_crt_overlay_close.png` — **(NEW)** Close workstation frame (75% screen size). Focuses heavily on the screen while keeping the keyboard and tape reels visible.
    *   `transitions/wes_crt_overlay_extreme.png` — **(NEW)** Extreme close-up workstation frame (90% screen size). Focuses purely on the monitor casing, maximizing code clarity.
*   **Portrait (9:16) Templates:**
    *   `transitions/wes_portrait_zoomed_out.png` — Overhead vertical desk view with CRT monitor.
    *   `transitions/wes_portrait_zoomed_in.png` — Snap-zoomed vertical direct front view of the CRT monitor frame.
    *   `transitions/wes_portrait_screen_fill.png` — **(NEW)** Screen-filling vertical CRT frame. Maximizes vertical detail space for Shorts/Tiktok.

---

## 📽️ Editing Timeline Workflow (Stitching & Overlay)

Follow these steps to stitch your raw screen-recordings inside the templates:

```
[Track 3: Overlays]  |                                 [Screen-Grab Video (Scaled & Cropped)]  |
[Track 2: Templates] | [Zoomed-Out Desk PNG] [Whip Zoom Transition] [Zoomed-In CRT Frame PNG]   |
[Track 1: Audio]     | [Metronome Tick]      [Surf Rock Guitar Blast] [Harpsichord Loop & TTS]  |
```

### Step 1: Place the Templates on Track 2
1. Add the **Zoomed-Out Desk** image to your timeline (approx. 5–8 seconds during your deadpan intro voiceover).
2. Directly append the **Zoomed-In CRT Frame** image to the timeline for the transition.
3. Switch to the **Screen-Filling CRT Frame** image when you need to showcase small, detailed code, files, or telemetry graphs. This expands the viewable area to 95% of the screen while maintaining the retro aesthetic.

### Step 2: Overlay your Screen Recordings on Track 3
1. Place the stitched `output.mp4` (or your recorded walkthrough clips) on **Track 3 (above the templates)**.
2. Align the video start time to match the transition point where the camera snaps to the close-up CRT frame.
3. **Scale & Position:**
    * Scale your dashboard screen recording down so it fits perfectly *inside* the black inner bezel of the CRT screen.
    * For the **Screen-Filling** templates, scale your video up to cover almost the entire canvas, keeping it nested just behind the thin curved outer border.
    * Use a **Crop** effect or a **rectangular mask** to feather or cut out any excess edges so it sits naturally "behind" the CRT glass bezel.
    * *Optional: Add a "Bad TV" or "CRT Scanline" overlay effect at 5% opacity to make your screen grab look like it is physically projected by the vintage monitor tube.*

### Step 3: Create the Whip-Zoom Transition
To link the Zoomed-Out desk to the Zoomed-In frame:
1. In your editor, apply a **Whip Zoom** (or a very fast scale-in transition with motion blur) over the cut between the Zoomed-Out PNG and the Zoomed-In PNG.
2. **Audio Sync:** Sync this visual snap-zoom with a loud **surf-rock guitar riff** or a **whip-sfx** and the click of the tape deck starting.

---

## 💡 Pro Editing Tips for Wes Anderson Style
*   **Snap whip-pans:** Keep your transition durations between the desk and the screen extremely short—around **6 to 8 frames** maximum.
*   **Perfect Centering:** Because the CRT screen is perfectly centered in both templates, your overlay video position coordinates will align precisely on the X and Y axes.
*   **Shorts Crop (9:16):** When using the Portrait templates, crop your screen-grab video to a vertical column so it fits inside the vertical CRT frame.
