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

## Design Tokens & Theme System

The dashboard implements a comprehensive design token system defined in `app/globals.css` for consistent styling across all pages and components.

### Design Tokens

#### Spacing Scale (8px base)
```css
--spacing-1: 0.25rem (4px)
--spacing-2: 0.5rem (8px)
--spacing-3: 0.75rem (12px)
--spacing-4: 1rem (16px)
--spacing-6: 1.5rem (24px)
--spacing-8: 2rem (32px)
--spacing-12: 3rem (48px)
--spacing-16: 4rem (64px)
```

#### Border Radius Scale
```css
--radius-sm: 0.375rem (6px)
--radius-md: 0.5rem (8px)
--radius-lg: 0.75rem (12px)
--radius-xl: 1rem (16px)
```

#### Transition Durations
```css
--duration-fast: 150ms
--duration-base: 200ms
--duration-slow: 300ms
```

#### Focus States
The dashboard uses consistent focus ring styling for accessibility (WCAG AA compliant):
- Focus ring: 2px blue-500 (dark: blue-400)
- Ring offset: 2px
- Applied via `.focus-ring` and `.focus-ring-sm` utility classes

#### Semantic Colors (Light/Dark Mode)
```css
Light mode:
--color-background: white
--color-foreground: dark slate
--color-surface: light slate (50)
--color-text-primary: dark slate (950)
--color-text-secondary: medium slate (600)

Dark mode:
--color-background: dark slate (950)
--color-foreground: near white
--color-surface: medium slate (800)
--color-text-primary: near white
--color-text-secondary: light slate (400)
```

### Reusable Component System

#### Layout Components
- **PageHeader**: Consistent page header with title, description, and optional action
  ```tsx
  <PageHeader
    title="Streams"
    description="Manage your RTSP streams"
    action={<Button>Add Stream</Button>}
  />
  ```

- **PageSection**: Wrapper providing consistent spacing between sections
  ```tsx
  <PageSection>
    {/* Content with automatic spacing */}
  </PageSection>
  ```

- **EmptyState**: Consistent empty state styling with icon, title, description, and action
  ```tsx
  <EmptyState
    title="No items"
    description="Create your first item to get started"
    action={<Button>Create</Button>}
  />
  ```

- **LoadingSkeletonCard**: Skeleton loaders matching card design
  ```tsx
  <LoadingSkeletonCard count={3} variant="grid" />
  ```

#### UI Components
All UI components use consistent design tokens for:
- **Button**: Focus rings, hover states, dark mode variants
- **Input**: Consistent padding (h-10, px-3, py-2), focus states
- **Card**: Uniform spacing (p-6), dark mode support, transitions

### Shell Layout

The dashboard shell (`app/(dashboard)/layout.tsx`) implements:
- Responsive design (mobile ≤1024px, desktop >1024px)
- Consistent padding: p-4 (mobile), p-6 (tablet), p-8 (desktop)
- Unified background colors (no duplication)
- Smooth mobile navigation with overlay
- Focus states on all interactive elements

### CSS Classes

Utility classes available in `globals.css`:
- `.focus-ring` - Default focus ring (2px offset)
- `.focus-ring-sm` - Compact focus ring (0px offset)
- `.page-section` - Page container with spacing (space-y-8)
- `.page-header` - Header section (space-y-2)
- `.page-title` - Page title styling (text-3xl, bold, tracked)
- `.page-description` - Description text (text-base, secondary color)
- `.skeleton` - Pulse skeleton loader
- `.empty-state` - Empty state container
- `.empty-state-icon` - Icon styling for empty states
- `.empty-state-title` - Title in empty states
- `.empty-state-description` - Description in empty states

### Styling Best Practices

1. **Use PageHeader** for all dashboard page titles
2. **Use PageSection** to wrap page content for consistent spacing
3. **Use EmptyState** for no-data states instead of custom cards
4. **Use LoadingSkeletonCard** for loading states
5. Apply `.focus-ring` to custom interactive elements
6. Use semantic color variables for light/dark mode consistency

## Styling

The dashboard uses Tailwind CSS 4 with custom design tokens:

- Light mode: Light backgrounds with dark text
- Dark mode: Dark backgrounds with light text
- Color palette: Slate-based with accessibility-focused focus states

Theme can be toggled via the sun/moon icon in the header.

## Component Library

All UI components are built with Radix UI primitives and styled with Tailwind CSS:

- **Button**: Various styles (default, outline, ghost, destructive) with accessible focus states
- **Card**: Container component with consistent padding and spacing
- **Input**: Text input with consistent height, padding, and focus styling
- **Label**: Form labels
- **Dialog**: Modal for forms and confirmations
- **Select**: Dropdown selection
- **Switch**: Toggle switches
- **Tabs**: Tabbed content

### Layout Components

- **PageHeader**: Reusable header with title, description, and action
- **PageSection**: Container for consistent spacing
- **EmptyState**: Empty state display with icon and action
- **LoadingSkeletonCard**: Loading skeleton matching card design

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
