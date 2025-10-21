# Home Bar System

A full-stack application for managing a home bar, including drink menus, orders, and bartender dashboard.

## Development Setup

### Prerequisites
- Node.js (v14 or higher)
- npm

### Running the Development Environment

#### 1. Initialize the Database (First Time Only)
```bash
cd backend
npm install
npm run init-db
```

#### 2. Start the Backend
```bash
cd backend
npm run dev
```
The backend will run on `http://localhost:3000`

#### 3. Start the Frontend (in a new terminal)
```bash
cd frontend
npm install
npm run dev
```
The frontend will run on `http://localhost:5173`

The frontend is configured to proxy API requests to the backend during development.

## Production Deployment

### Using Docker Compose
```bash
docker-compose up --build
```

This will start:
- Backend API on port 21030
- WebSocket server on port 21080
- Frontend on port 21000

## Project Structure

- `/backend` - Node.js/Express API server
- `/frontend` - React/TypeScript frontend with Vite
- `/data` - SQLite database storage
- `/uploads` - User uploaded files
