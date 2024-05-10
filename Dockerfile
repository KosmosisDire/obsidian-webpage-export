FROM node:16-alpine AS Build

# copy the assets and source code
COPY . /app
WORKDIR /app

# install dependencies
RUN npm install

# build the app
RUN npm run build

FROM ubuntu:20.04 AS Run

# Set image parameters
ARG OBSIDIAN_VERSION=1.5.12
ARG DEBIAN_FRONTEND=noninteractive
VOLUME [ "/vault" ]
ENV TZ=Etc/UTC

# Copy build output
COPY --from=Build /app/main.js /plugin/main.js
COPY --from=Build /app/styles.css /plugin/styles.css
COPY --from=Build /app/manifest.json /plugin/manifest.json

# Copy the inject scripts
COPY docker/inject-open.js /inject-open.js
COPY docker/inject-enable.js /inject-enable.js

# Install dependencies
RUN apt update
RUN apt install -y python3 python3-pip curl x11vnc xvfb tzdata

# Download the Obsidian package
RUN curl -L "https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/obsidian_${OBSIDIAN_VERSION}_amd64.deb" -o obsidian.deb

# Install patcher
RUN pip3 install electron-inject

# Install Obsidian
RUN apt install -y ./obsidian.deb

# Inject trust vault script and run Obsidian on start
RUN echo "exec python3 -m electron_inject -r ./inject-enable.js - obsidian --remote-allow-origins=* --no-sandbox --no-xshm --disable-dev-shm-usage --disable-gpu --disable-software-rasterizer" > ~/.xinitrc && chmod +x ~/.xinitrc

# Set up the vault
RUN mkdir -p /root/.config/obsidian
RUN mkdir /output
RUN echo '{"vaults":{"94349b4f2b2e057a":{"path":"/vault","ts":1715257568671,"open":true}}}' > /root/.config/obsidian/obsidian.json

RUN cp /plugin/main.js /vault/.obsidian/plugins/obsidian-remote-plugin/main.js
RUN cp /plugin/styles.css /vault/.obsidian/plugins/obsidian-remote-plugin/styles.css
RUN cp /plugin/manifest.json /vault/.obsidian/plugins/obsidian-remote-plugin/manifest.json

CMD x11vnc -ncache 10 -create -forever -ncache_cr
