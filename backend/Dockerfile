FROM node:22-alpine

# Install Chromium, Microsoft TrueType Core Fonts (Times New Roman, Arial, Georgia), and font tools
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    fontconfig \
    msttcorefonts-installer \
    && update-ms-fonts \
    && fc-cache -f

# Configure Puppeteer environment variables to use system-installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy backend source
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
