import os
import sys
import subprocess

# Auto-install dependencies if missing
def install_dependencies():
    required = {'gtts', 'moviepy'}
    try:
        import gtts
        import moviepy
        print("All dependencies are already installed.")
    except ImportError:
        print("Installing required dependencies (gtts, moviepy)...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "gtts", "moviepy"])
        print("Dependencies installed successfully.")

# Run installation check
install_dependencies()

from gtts import gTTS
from moviepy import (
    ImageClip, VideoFileClip, AudioFileClip, CompositeVideoClip, 
    concatenate_videoclips
)

# Configurations - Modify these to fit your video scaling/cropping
USER_VIDEO_PATH = r"C:\Users\nsdha\Videos\2026-06-12 21-31-48.mp4"
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "compiled_promo_video.mp4")

# Dimensions of the CRT monitor screen inside the templates (Width, Height)
# Configured to preserve the exact 16:9 aspect ratio of screen recordings.
CRT_ZOOMED_IN = {
    "w": 1160,
    "h": 652
}

CRT_SCREEN_FILL = {
    "w": 1840,
    "h": 1035
}

def generate_voiceovers():
    print("Generating fact-driven, single-narrator TTS voiceover clips...")
    os.makedirs(os.path.join(os.path.dirname(__file__), "audio"), exist_ok=True)
    
    script_clips = {
        "act1_vo.mp3": "This is Memo-Ray, a local mission control for autonomous AI agents. When agents perform multiple tool calls and file edits across your codebase, tracking their execution path becomes a primary developer bottleneck.",
        "act2_vo.mp3": "Memo-Ray addresses this by parsing raw agent logs and compiling them into a local-only database. It keeps your operational history completely private and secure. All session data is git-ignored, ensuring your IP and conversation history never leave your local machine.",
        "act3_vo.mp3": "By visualizing the agent's memory as an organic lineage graph, you can easily audit every thought, permission, and tool call. Using the sequence slider, you can scrub chronologically through the agent's decisions to verify what was modified. The File Memory Heatmap and worktree tracker highlight exactly which files were edited, making it easy to explain and validate the entire process.",
        "act4_vo.mp3": "Memo-Ray establishes transparency for agentic workflows, helping teams scale their AI coordination safely and productively. You can run the dashboard locally to audit your workspaces."
    }
    
    for filename, text in script_clips.items():
        path = os.path.join(os.path.dirname(__file__), "audio", filename)
        print(f"Generating {filename}...")
        tts = gTTS(text=text, lang='en', slow=False)
        tts.save(path)
            
    print("TTS generation complete.")

def build_video():
    print("Starting video composition...")
    
    # Path mappings
    audio_dir = os.path.join(os.path.dirname(__file__), "audio")
    transitions_dir = os.path.join(os.path.dirname(__file__), "transitions")
    
    # Background images
    bg_desk = os.path.join(transitions_dir, "wes_landscape_zoomed_out.png")
    bg_zoom_in = os.path.join(transitions_dir, "wes_landscape_zoomed_in.png")
    bg_screen_fill = os.path.join(transitions_dir, "wes_landscape_screen_fill.png")
    
    # Check backgrounds
    for bg in [bg_desk, bg_zoom_in, bg_screen_fill]:
        if not os.path.exists(bg):
            print(f"❌ Error: Background template not found at {bg}")
            return
            
    # Check user video
    if not os.path.exists(USER_VIDEO_PATH):
        print(f"❌ Error: User video recording not found at {USER_VIDEO_PATH}")
        return

    # Load audio clips to compute durations
    act1_audio = AudioFileClip(os.path.join(audio_dir, "act1_vo.mp3"))
    act2_audio = AudioFileClip(os.path.join(audio_dir, "act2_vo.mp3"))
    act3_audio = AudioFileClip(os.path.join(audio_dir, "act3_vo.mp3"))
    act4_audio = AudioFileClip(os.path.join(audio_dir, "act4_vo.mp3"))
    
    # Load user dashboard walk-through video
    user_video = VideoFileClip(USER_VIDEO_PATH)
    
    # -------------------------------------------------------------------------
    # ACT 1: Intro Symmetrical Desk (Wide-shot)
    # -------------------------------------------------------------------------
    print("Compositing Act I...")
    act1_duration = act1_audio.duration + 1.0 # 1s padding
    act1_clip = ImageClip(bg_desk).with_duration(act1_duration).with_audio(act1_audio)
    
    # -------------------------------------------------------------------------
    # ACT 2: Zoomed-in CRT Screen (User video centered in middle of screen)
    # -------------------------------------------------------------------------
    print("Compositing Act II...")
    act2_duration = act2_audio.duration
    # Resize and position directly in the center of the canvas
    user_overlay_act2 = (user_video
                         .subclipped(0, min(act2_duration, user_video.duration))
                         .resized(width=CRT_ZOOMED_IN["w"], height=CRT_ZOOMED_IN["h"])
                         .with_position("center"))
                         
    # Create background frame clip
    act2_bg = ImageClip(bg_zoom_in).with_duration(act2_duration)
    # Overlay video on top of the background image and attach audio
    act2_clip = CompositeVideoClip([act2_bg, user_overlay_act2]).with_duration(act2_duration).with_audio(act2_audio)
    
    # -------------------------------------------------------------------------
    # ACT 3: Screen-Filling CRT (Dashboard detail walk-through)
    # -------------------------------------------------------------------------
    print("Compositing Act III...")
    act3_duration = act3_audio.duration + 1.0
    video_start_act3 = min(act2_duration, user_video.duration)
    video_end_act3 = min(video_start_act3 + act3_duration, user_video.duration)
    
    # Slice user video and position directly in the center
    user_overlay_act3 = (user_video
                         .subclipped(video_start_act3, video_end_act3)
                         .resized(width=CRT_SCREEN_FILL["w"], height=CRT_SCREEN_FILL["h"])
                         .with_position("center"))
                         
    act3_bg = ImageClip(bg_screen_fill).with_duration(act3_duration)
    act3_clip = CompositeVideoClip([act3_bg, user_overlay_act3]).with_duration(act3_duration).with_audio(act3_audio)
    
    # -------------------------------------------------------------------------
    # ACT 4: Outro Symmetrical Desk (Wide-shot)
    # -------------------------------------------------------------------------
    print("Compositing Act IV...")
    act4_duration = act4_audio.duration + 2.0
    act4_clip = ImageClip(bg_desk).with_duration(act4_duration).with_audio(act4_audio)
    
    # -------------------------------------------------------------------------
    # STITCH ALL ACTS TOGETHER
    # -------------------------------------------------------------------------
    print("Stitching acts into final timeline...")
    final_video = concatenate_videoclips([act1_clip, act2_clip, act3_clip, act4_clip])
    
    print(f"Rendering final output to: {OUTPUT_PATH}")
    # Write the result to a file (using 24fps, libx264, standard audio)
    final_video.write_videofile(
        OUTPUT_PATH,
        fps=24,
        codec="libx264",
        audio_codec="aac",
        temp_audiofile="temp-audio.m4a",
        remove_temp=True
    )
    print("[Video Stitcher] Rendering complete!")

if __name__ == "__main__":
    generate_voiceovers()
    build_video()
