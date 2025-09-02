#!/bin/bash
# Copy the plugin and config to the vault, inject script and start Obsidian on startup
mkdir -p /vault/.obsidian/plugins/webpage-html-export

if [ -f /config.json ]; then cp /config.json /vault/.obsidian/plugins/webpage-html-export/data.json; fi

if [ ! -f /vault/.obsidian/plugins/webpage-html-export/main.js ]; then
  cp /plugin/* /vault/.obsidian/plugins/webpage-html-export/
else
  sed -i 's|callback: () => {|callback: async () => {|1' /vault/.obsidian/plugins/webpage-html-export/main.js
  sed -i 's|HTMLExporter.export(true)|await HTMLExporter.export(true)|1' /vault/.obsidian/plugins/webpage-html-export/main.js
fi

# Cleanup function
cleanup() {
    echo "Cleaning up processes..."
    pkill -f x11vnc
    pkill -f obsidian
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Start VNC server in the background
x11vnc -forever -nopw -create &
VNC_PID=$!

# Wait a moment for VNC to start
sleep 2

echo "VNC server started on port 5900"

# Run Obsidian with electron inject in the background
python3 -m electron_inject -r /inject-enable.js - obsidian --remote-allow-origins=* --no-sandbox --no-xshm --disable-dev-shm-usage --disable-gpu --disable-software-rasterizer --remote-debugging-port=37941 &
OBSIDIAN_PID=$!

echo "Obsidian started, keeping container alive..."

# Keep the container running
wait $OBSIDIAN_PID