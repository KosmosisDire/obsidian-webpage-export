#!/bin/bash

PLUGIN_DIR="/vault/.obsidian/plugins/webpage-html-export"
if [[ ! -d "$PLUGIN_DIR" ]]; then
  # Copy the plugin to the vault if it doesn't exist
  mkdir -p "$PLUGIN_DIR"
  cp /plugin/* "$PLUGIN_DIR/"
fi

RUST_LOG=debug xvfb-run electron-injector \
  --delay=5000 \
  --script=/export-vault.mjs \
  /opt/obsidian/obsidian \
    --arg=--remote-allow-origins=* \
    --arg=--no-sandbox \
    --arg=--no-xshm \
    --arg=--disable-dev-shm-usage \
    --arg=--disable-gpu \
    --arg=--disable-software-rasterizer \
    --arg=--enable-logging=stderr || true