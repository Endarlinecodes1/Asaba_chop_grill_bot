# Production Dockerfile for Render.com (Free Tier)
# Includes complete Chromium runtime packages required for whatsapp-web.js Puppeteer
FROM node:18-bullseye-slim

# Install latest chrome dev package and fonts to support major charsets
RUN apt-get update \
    && apt-get install -y wget gnupg ca-certificates procps libxss1 \
    && apt-get install -y chromium fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the installed Chromium package
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Bundle app source
COPY . .

# Ensure data directory exists
RUN mkdir -p data .wwebjs_auth

# Expose server port
EXPOSE 3000

# Start server
CMD ["node", "index.js"]
