FROM node:20-alpine

WORKDIR /workspace

# Copy dependency configs
COPY package*.json ./

# Install packages
RUN npm install

# Copy application files
COPY . .

# Expose port 3000
EXPOSE 3000

# Default command starts dev server
CMD ["npm", "run", "dev"]
