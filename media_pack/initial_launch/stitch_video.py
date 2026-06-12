import os
import glob

def main():
    print("[Video Stitcher] Memo-Ray Video Stitcher Helper")
    print("---------------------------------")
    
    # Locate all jpg frames in the frames directory
    frames_dir = os.path.join(os.path.dirname(__file__), 'frames')
    if not os.path.exists(frames_dir):
        print(f"Error: 'frames' directory not found at {frames_dir}")
        return
        
    search_path = os.path.join(frames_dir, '*.jpg')
    jpg_files = glob.glob(search_path)
    
    if not jpg_files:
        print(f"Error: No .jpg files found in {frames_dir}")
        return
        
    # Sort files chronologically (by filename since they are timestamps)
    jpg_files.sort()
    print(f"Found {len(jpg_files)} raw screen recording frames.")
    
    # Generate the FFmpeg concat file list
    concat_file_path = os.path.join(os.path.dirname(__file__), 'ffmpeg_concat.txt')
    
    # Assume ~10 frames per second (0.1s duration per frame)
    frame_duration = 0.1 
    
    with open(concat_file_path, 'w', encoding='utf-8') as f:
        for file_path in jpg_files:
            # Get relative path from this script's directory
            rel_path = os.path.relpath(file_path, os.path.dirname(__file__))
            # FFmpeg needs forward slashes even on Windows
            rel_path_ff = rel_path.replace('\\', '/')
            f.write(f"file '{rel_path_ff}'\n")
            f.write(f"duration {frame_duration}\n")
            
        # FFmpeg concat demuxer requires the last file to be repeated without duration or defined
        if jpg_files:
            rel_path = os.path.relpath(jpg_files[-1], os.path.dirname(__file__))
            rel_path_ff = rel_path.replace('\\', '/')
            f.write(f"file '{rel_path_ff}'\n")
            
    print(f"Generated FFmpeg manifest: {concat_file_path}")
    print("\nTo compile these frames into an MP4 video, run this command in your terminal:")
    print("-------------------------------------------------------------------------")
    print(f"cd {os.path.dirname(__file__)}")
    print("ffmpeg -f concat -safe 0 -i ffmpeg_concat.txt -c:v libx264 -pix_fmt yuv420p output.mp4")
    print("-------------------------------------------------------------------------")

if __name__ == '__main__':
    main()
