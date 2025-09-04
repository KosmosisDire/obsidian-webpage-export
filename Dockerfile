FROM node:16-alpine AS plugin

# copy the assets and source code
WORKDIR /app

# copy and install dependencies
COPY package*.json /app/
RUN npm install

# copy and build the app
COPY esbuild.config.mjs tsconfig*.json /app/
COPY src /app/src
RUN npm run build

# copy the rest
COPY manifest.json styles.css /app/

FROM rust:1.89.0 AS injector

RUN cargo install electron-injector

FROM debian:trixie AS run

# Set image parameters
ARG DEBIAN_FRONTEND=noninteractive
VOLUME [ "/vault", "/output", "/config.json" ]
ENV TZ=Etc/UTC

# Download and install the Obsidian package
ARG OBSIDIAN_VERSION=1.9.12
RUN apt update && apt install -y curl \
  && curl -L "https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/obsidian_${OBSIDIAN_VERSION}_amd64.deb" -o obsidian.deb \
  && apt install --no-install-recommends -y libasound2 ./obsidian.deb

# Install dependencies
RUN apt update && apt install -y xvfb

# Install patcher
COPY --from=injector \
  /usr/local/cargo/bin/electron-injector \
  /usr/local/bin/

# Copy build output
COPY --from=plugin \
  /app/main.js \
  /app/styles.css \
  /app/manifest.json \
  /plugin/

# Copy the inject scripts
COPY docker/* /

# Set up the vault
RUN mkdir -p /root/.config/obsidian
RUN mkdir /output
RUN echo '{"vaults":{"94349b4f2b2e057a":{"path":"/vault","ts":1715257568671,"open":true}}}' > /root/.config/obsidian/obsidian.json

CMD ["/run.sh"]
