import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from qoe_scripts.get_ffmpeg_path import get_valid_ffmpeg_path
import logging as logger
import cv2
import ray
import time
import argparse

start_time = time.time()
parser = argparse.ArgumentParser(description="QoE analyzer")
parser.add_argument("--debug", action="store_true",
                    default=False, help="Enable debug mode")
parser.add_argument("--remux", action="store_true",
                    default=False, help="Enable remux mode")
parser.add_argument("--viewer", type=str, default="viewer.yuv",
                    help="Distorted viewer video")
parser.add_argument("--prefix", type=str, default="qoe_",
                    help="Prefix for output files")
parser.add_argument("--fragment_duration_secs", type=int,
                    default=5, help="Fragment duration in seconds")
parser.add_argument("--padding_duration_secs", type=int,
                    default=1, help="Padding duration in seconds")
parser.add_argument("--width", type=int, default=640,
                    help="Width of the video")
parser.add_argument("--height", type=int, default=480,
                    help="Height of the video")
parser.add_argument("--fps", type=int, default=30, help="FPS of the video")
parser.add_argument("--presenter", type=str,
                    default="presenter.yuv", help="Original video")
parser.add_argument("--presenter_audio", type=str,
                    default="presenter.wav", help="Original audio")
parser.add_argument("--max_cpus", type=int, help="Max number of CPUs to use")
parser.add_argument("--all_analysis", action="store_true", default=False,
                    help="Analyze also with PESQ and VQMT. Defaults to analyzing with VMAF and VISQOL only.")

args = parser.parse_args()
debug = args.debug
fps = args.fps
fragment_duration_secs = args.fragment_duration_secs
padding_duration_secs = args.padding_duration_secs
width = args.width
height = args.height
presenter = args.presenter
presenter_audio = args.presenter_audio
remux = args.remux
viewer = args.viewer
prefix = args.prefix
max_cpus = args.max_cpus
all_analysis = args.all_analysis

logger.basicConfig(level=logger.DEBUG if debug else logger.INFO)

# at.validate_install(all_analysis)

logger.info("Debug: %s", debug)
logger.info("FPS: %d", fps)
logger.info("Fragment duration (s): %d s", fragment_duration_secs)
logger.info("Padding duration (s): %d s", padding_duration_secs)
logger.info("Dimensions: %d x %d", width, height)
logger.info("Presenter video: %s", presenter)
logger.info("Presenter audio: %s", presenter_audio)
logger.info("Viewer video: %s", viewer)
logger.info("Prefix: %s", prefix)
logger.info("Max CPUs: %s", max_cpus)
logger.info("All analysis: %s", all_analysis)

os.makedirs("./outputs/fixed", exist_ok=True)
os.makedirs("./outputs_audio", exist_ok=True)
os.makedirs("./ocr", exist_ok=True)
os.makedirs("./frames", exist_ok=True)

logger.info("Initializing Ray")

presenter = os.path.abspath(presenter)
viewer = os.path.abspath(viewer)

if not os.path.exists(presenter):
    logger.error("Presenter video file does not exist: %s", presenter)
    sys.exit(1)

if not os.path.exists(viewer):
    logger.error("Viewer video file does not exist: %s", viewer)
    sys.exit(1)

if not os.path.exists(viewer):
    logger.error("Viewer video file does not exist: %s", viewer)
    sys.exit(1)

if ray.is_initialized():
    ray.shutdown()
if max_cpus is None:
    ray.init(ignore_reinit_error=True, include_dashboard=debug)
else:
    ray.init(ignore_reinit_error=True,
             include_dashboard=debug, num_cpus=max_cpus)

logger.info("Ray initialized")
PESQ_AUDIO_SAMPLE_RATE = "16000"

dim = (width, height)
ffmpeg_path = get_valid_ffmpeg_path()

# put into ray shared memory objects that are reused frequently between tasks so that ray doesn't have to put and get them everytime
fds_ref = ray.put(fragment_duration_secs)
fps_ref = ray.put(fps)
prefix_ref = ray.put(prefix)
pesq_ref = ray.put(PESQ_AUDIO_SAMPLE_RATE)
debug_ref = ray.put(debug)
width_ref = ray.put(width)
height_ref = ray.put(height)
ffmpeg_path_ref = ray.put(ffmpeg_path)

def get_frame_count(video_path):
    cap = cv2.VideoCapture(video_path)
    frame_count = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        frame_count += 1
    cap.release()
    return frame_count

def trim_video(input_path, output_path, frame_count):
    cap = cv2.VideoCapture(input_path)
    print(f'Processing {input_path}...')
    out = cv2.VideoWriter(output_path, 0, fps, (width, height))
    print(f'Writing to {output_path}...')

    count = 0
    while cap.isOpened() and count < frame_count:
        ret, frame = cap.read()
        if not ret:
            break
        out.write(frame)
        count += 1

    cap.release()
    out.release()

frame_count_presenter = get_frame_count(presenter)
print(f'Frame count of presenter: {frame_count_presenter}')
frame_count_viewer = get_frame_count(viewer)
print(f'Frame count of viewer: {frame_count_viewer}')

if frame_count_presenter > frame_count_viewer:
    trim_video(presenter, "presenter-fixed.yuv", frame_count_viewer)
    print(f'Trimmed {presenter} to {frame_count_viewer} frames.')
    presenter = "presenter-fixed.yuv"
else:
    trim_video(viewer, "viewer-fixed.yuv", frame_count_presenter)
    print(f'Trimmed {viewer} to {frame_count_presenter} frames.')
    viewer = "viewer-fixed.yuv"
