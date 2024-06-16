# Copy the plugin and config to the vault, inject script and start Obsidian on startup
mkdir -p /vault/.obsidian/plugins/webpage-html-export

if [ -f /config.json ]; then cp /config.json /vault/.obsidian/plugins/webpage-html-export/data.json; fi

if [ ! -f /vault/.obsidian/plugins/webpage-html-export/main.js ]; then
  cp /plugin/* /vault/.obsidian/plugins/webpage-html-export/
fi

python3 -m electron_inject -r /inject-enable.js - obsidian --remote-allow-origins=* --no-sandbox --no-xshm --disable-dev-shm-usage --disable-gpu --disable-software-rasterizer --remote-debugging-port=37941
x11vnc -forever -nopw -create
