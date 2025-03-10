# Dockerfile for Project Register and Information Management System
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy necessary files for installing dependencies
COPY package.json package-lock.json ./

# Install dependencies using npm
RUN npm install 

# Copy the rest of the project files
COPY . .

# Generate Prisma client and build the project
RUN npx prisma generate \
    && npm run build

# Expose the application port
EXPOSE 3000

# Command to start the application
CMD ["node", "dist/src/index.js"]
