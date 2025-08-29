#!/bin/bash

# Copy the plugin and config to the vault, inject script and start Obsidian on startup
mkdir -p /vault/.obsidian/plugins/webpage-html-export

if [ -f /config.json ]; then
  cp /config.json /vault/.obsidian/plugins/webpage-html-export/data.json
fi

cp /plugin/* /vault/.obsidian/plugins/webpage-html-export/

PID=$$ RUST_LOG=debug xvfb-run electron-injector \
  --delay=5000 \
  --script=/export-vault.mjs \
  obsidian \
    --arg=--remote-allow-origins=* \
    --arg=--no-sandbox \
    --arg=--no-xshm \
    --arg=--disable-dev-shm-usage \
    --arg=--disable-gpu \
    --arg=--disable-software-rasterizer \
    --arg=--enable-logging=stderr || true