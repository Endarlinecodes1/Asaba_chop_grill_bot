FROM node:20-slim

# Install Chromium and all deps needed for WhatsApp Web
RUN apt-get update && apt-get install -y \
  chromium \
  fonts-liberation \
  libasound2 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  libcairo2 \
  libnss3 \
  libnspr4 \
  libxshmfence1 \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Tell puppeteer to use system chromium, not download
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Render needs port 10000
ENV PORT=10000
EXPOSE 10000

CMD ["node", "index.js"]
