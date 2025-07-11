# Football Game Generator Backend

A Node.js/Express backend with PostgreSQL database for the Football Game Generator application.

## Features

- **PostgreSQL Database**: Full persistence with proper schema and migrations
- **User Management**: User creation and profile management
- **Authentication**: Token-based authentication middleware
- **Profile System**: Complete profile creation with validation
- **Nickname Uniqueness**: Database-level uniqueness constraints
- **Graceful Shutdown**: Proper database connection handling

## Setup

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v13 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up PostgreSQL database:
```bash
createdb football_game_generator
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your PostgreSQL connection details:
```
DATABASE_URL=postgresql://username:password@localhost:5432/football_game_generator
DB_HOST=localhost
DB_PORT=5432
DB_NAME=football_game_generator
DB_USER=postgres
DB_PASSWORD=your_password
PORT=3001
NODE_ENV=development
```

### Database Setup

The database schema will be automatically created when you start the server. Alternatively, you can run migrations manually:

```bash
npm run db:migrate
```

### Running the Server

Development mode (with auto-restart):
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## API Endpoints

### Authentication
All API endpoints require a `Bearer` token in the Authorization header.

### Endpoints

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### GET /api/me
Get current user with profile.

**Response:**
```json
{
  "userId": "user_123",
  "profile": {
    "userId": "user_123",
    "firstName": "John",
    "lastName": "Doe",
    "nickname": "johndoe",
    "selfRating": 7,
    "primaryPosition": "MID",
    "secondaryPosition": "ATT",
    "source": "SELF",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### POST /api/profile
Create user profile.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "nickname": "johndoe",
  "selfRating": 7,
  "primaryPosition": "MID",
  "secondaryPosition": "ATT"
}
```

**Response:**
```json
{
  "userId": "user_123",
  "firstName": "John",
  "lastName": "Doe",
  "nickname": "johndoe",
  "selfRating": 7,
  "primaryPosition": "MID",
  "secondaryPosition": "ATT",
  "source": "SELF",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `400`: Validation errors
- `409`: Nickname already taken

## Database Schema

### Users Table
- `id` (VARCHAR): Primary key, user identifier
- `created_at` (TIMESTAMP): When user was created
- `updated_at` (TIMESTAMP): When user was last updated

### Profiles Table
- `id` (SERIAL): Primary key
- `user_id` (VARCHAR): Foreign key to users table
- `first_name` (VARCHAR): User's first name
- `last_name` (VARCHAR): User's last name
- `nickname` (VARCHAR): Unique nickname
- `self_rating` (INTEGER): Self-assessed skill rating (1-10)
- `primary_position` (VARCHAR): Primary position (GK, DEF, MID, ATT)
- `secondary_position` (VARCHAR): Optional secondary position
- `source` (VARCHAR): Always 'SELF' for user-created profiles
- `created_at` (TIMESTAMP): When profile was created
- `updated_at` (TIMESTAMP): When profile was last updated

## Development

### Running Tests
```bash
npm test
```

### Building
```bash
npm run build
```

### Database Migrations
```bash
npm run db:migrate
```

## Architecture

- **Express.js**: Web framework
- **PostgreSQL**: Database with proper schema
- **TypeScript**: Type safety
- **Connection Pooling**: Efficient database connections
- **Graceful Shutdown**: Proper cleanup on exit
- **Error Handling**: Comprehensive error responses 