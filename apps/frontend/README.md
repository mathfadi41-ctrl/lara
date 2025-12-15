# Admin Dashboard Frontend

A comprehensive Next.js 16 admin dashboard for stream monitoring and AI detection management.

## Features

- **Authentication**: Secure login/register with JWT tokens stored in localStorage
- **Role-Based Access Control**: Admin, Operator, and Viewer roles with different permissions
- **Dark/Light Theme**: Next.js themes integration with Tailwind CSS
- **Responsive Design**: Mobile-friendly UI with Tailwind CSS
- **Stream Management**: Register, monitor, and control RTSP streams
- **AI Detection**: Toggle AI detection per stream with real-time updates
- **Detection History**: View and filter AI detection events
- **Live Monitoring**: Real-time stream monitoring with WebSocket support
- **User Management**: Create and manage users (Admin only)
- **Real-time Updates**: WebSocket integration for live detection events

## Setup

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file in the frontend directory:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_AI_URL=http://localhost:8000
```

### Development

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3000`

## Project Structure

```
app/
├── (auth)/                    # Authentication pages
│   ├── login/
│   └── register/
├── (dashboard)/               # Protected dashboard pages
│   ├── dashboard/            # Overview and stats
│   ├── streams/              # Stream management
│   ├── users/                # User management (Admin only)
│   ├── detections/           # Detection history
│   ├── live-monitoring/      # Real-time stream monitoring
│   └── settings/             # User settings
├── components/
│   ├── layout/              # Layout components
│   │   ├── sidebar.tsx
│   │   └── header.tsx
│   └── ui/                  # Reusable UI components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── dialog.tsx
│       ├── select.tsx
│       ├── switch.tsx
│       └── tabs.tsx
├── lib/
│   ├── api.ts               # API client with JWT handling
│   ├── store.ts             # Zustand stores for state
│   ├── socket.ts            # WebSocket client
│   └── utils.ts             # Utility functions
├── layout.tsx               # Root layout
├── providers.tsx            # Context providers
└── globals.css              # Global styles

public/                       # Static assets
```

## Key Technologies

- **Framework**: Next.js 16 with App Router
- **UI**: Tailwind CSS 4 with @tailwindcss/postcss
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Form Handling**: React Hook Form + Zod
- **HTTP Client**: Axios
- **Real-time**: Socket.io-client
- **Theming**: next-themes
- **Charts**: Recharts
- **UI Components**: Radix UI + shadcn/ui
- **Notifications**: Sonner
- **Icons**: lucide-react

## API Integration

### Authentication Flow

1. User logs in with email/password at `/login`
2. API returns access and refresh tokens
3. Tokens are stored in localStorage
4. Access token is automatically added to API requests via Authorization header
5. When access token expires, refresh token is used to get a new one
6. Failed auth redirects to `/login`

### Protected Routes

All routes under `(dashboard)` require authentication. Unauthenticated users are redirected to `/login`.

### Role-Based Access Control

- **Admin**: Full access to all features
- **Operator**: Stream management and monitoring
- **Viewer**: View-only access to streams and detections

## API Endpoints

### Auth
- `POST /auth/login` - Login
- `POST /auth/register` - Register
- `POST /auth/refresh` - Refresh access token

### Users (Admin only)
- `GET /users/me` - Current user
- `GET /users` - List all users
- `GET /users/:id` - Get user
- `POST /users` - Create user
- `PATCH /users/:id` - Update user
- `PATCH /users/:id/role` - Set user role
- `DELETE /users/:id` - Delete user

### Streams
- `GET /streams` - List streams
- `GET /streams/:id` - Get stream
- `POST /streams` - Create stream
- `PATCH /streams/:id` - Update stream
- `POST /streams/:id/start` - Start stream
- `POST /streams/:id/stop` - Stop stream
- `GET /streams/:id/health` - Stream health

### Detections
- `GET /detections` - List detections
- `GET /detections/:id` - Get detection
- `GET /detections/:id/screenshot-metadata` - Get screenshot metadata

## WebSocket Events

The dashboard connects to WebSocket at the API URL for real-time updates:

- `detection` - New detection event
- `stream:status` - Stream status change
- `stream:health` - Stream health update

### WebSocket Actions
- `subscribe:stream` - Subscribe to stream updates
- `unsubscribe:stream` - Unsubscribe from stream
- `stream:enable-detection` - Enable detection for stream
- `stream:disable-detection` - Disable detection for stream

## Styling

The dashboard uses Tailwind CSS 4 with custom theme variables:

- Light mode: Light backgrounds with dark text
- Dark mode: Dark backgrounds with light text
- Color palette: Slate-based with custom primary/secondary colors

Theme can be toggled via the sun/moon icon in the header.

## Component Library

All UI components are built with Radix UI primitives and styled with Tailwind CSS:

- **Button**: Various styles (default, outline, ghost, destructive)
- **Card**: Container component for content
- **Input**: Text input with validation styling
- **Label**: Form labels
- **Dialog**: Modal for forms and confirmations
- **Select**: Dropdown selection
- **Switch**: Toggle switches
- **Tabs**: Tabbed content

## Authentication & Security

- JWT tokens stored in localStorage (should be httpOnly in production)
- Automatic token refresh with refresh token rotation
- Protected routes require authentication
- Role-based access control enforced client-side and server-side

## Future Enhancements

- Screenshot gallery with filtering
- Stream recording and playback
- Advanced detection filters
- Export detection reports
- User activity logs
- System metrics and performance monitoring
- Email notifications
- Mobile app
