# Dockerfile for Project Register and Information Management System
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy necessary files for installing dependencies
COPY package.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm \
    && pnpm install --frozen-lockfile

# Copy the rest of the project files
COPY . .

# Generate Prisma client and build the project
RUN npx prisma generate \
    && pnpm run build

# Expose the application port
EXPOSE 3000

# Command to start the application
CMD ["pnpm", "start"]
