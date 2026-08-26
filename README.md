# SmartSaver Sacco

A secure, full-stack financial operations management system for SACCO (Savings and Credit Cooperative) organizations. Built with Next.js, TypeScript, and Supabase.

## Features

### Admin Dashboard
- **Member Management**: Add, update, and manage member records with status tracking (active/paused/closed/archived)
- **Transaction Recording**: Record deposits, withdrawals, loan payments, fees, and adjustments
- **Transaction Reversal**: Safe financial correction via offsetting reversals (no deletion)
- **Loan Management**: Create loan products, process applications, approve/reject loans
- **Audit Logging**: Comprehensive audit trail for all financial and administrative actions
- **User Role Management**: Secure role-based access control (admin/member)
- **Bulk Operations**: Upload multiple transactions via CSV
- **Reports**: Download transaction and member reports

### Member Portal
- View personal account balance and transaction history
- Apply for loans with eligibility checking
- Track loan status and repayment schedule
- View personal financial summary

### Security Features
- Database-driven authorization (not metadata-based)
- Row-level security (RLS) policies
- Immutable audit logs
- Financial record preservation (no deletion, only reversal)
- Input validation and SQL injection protection
- Session management with secure cookies
- Production fail-safe checks

## Tech Stack

- **Framework**: Next.js 15.1 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Styling**: CSS (custom, no framework)
- **Deployment**: Vercel

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- A Supabase account and project
- Git

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Jonard-Mbalibula/SmartSaver-Sacco.git
cd SmartSaver-Sacco
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up Supabase**
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to SQL Editor and run `supabase/schema-secure-v4.sql`
   - Enable Email authentication: Settings → Authentication → Providers → Email

4. **Configure environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get these from: Supabase Dashboard → Project Settings → API

5. **Run the development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Create First Admin User

1. Register a new account at `/register`
2. In Supabase Dashboard → Table Editor → `user_profiles` table
3. Find your user record and update the `role` column to `'admin'`
4. Sign out and sign back in

## Project Structure

```
├── app/                      # Next.js app router pages
│   ├── actions.ts           # Server actions (business logic)
│   ├── dashboard/           # Admin dashboard pages
│   ├── member/              # Member portal pages
│   ├── login/               # Authentication pages
│   └── api/                 # API routes
├── components/              # React components
├── lib/                     # Shared utilities
│   ├── authorization.ts     # Auth checks & helpers
│   ├── audit.ts            # Audit logging
│   ├── data.ts             # Data fetching
│   ├── supabase.ts         # Supabase clients
│   └── types.ts            # TypeScript types
├── supabase/               
│   └── schema-secure-v4.sql # Database schema
└── scripts/                 # Utility scripts
```

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint

# Utility scripts (requires Node.js and configured .env.local)
node scripts/test-connection.mjs           # Test database connection
node scripts/check-loan-products.mjs       # Verify loan products exist
node scripts/fix-admin-access.mjs          # Grant admin role to user
node scripts/reset-admin-password.mjs      # Reset admin password
```

## Security Notes

- Never commit `.env.local` to version control
- All admin actions require server-side authorization checks
- Financial records cannot be deleted (only reversed via audit trail)
- User roles are stored in `user_profiles` table (not user_metadata)
- Production mode requires database connection (no demo fallback)
- Monetary amounts use string handling to preserve precision

## Database Schema

The application uses a secure PostgreSQL schema with:
- **members**: Member records with lifecycle status
- **transactions**: Financial transactions with reversal tracking
- **loans**: Loan records with approval workflow
- **loan_products**: Configurable loan product definitions
- **user_profiles**: User roles and member linkage
- **audit_logs**: Immutable audit trail

See `supabase/schema-secure-v4.sql` for complete schema.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary.

## Support

For issues and questions, please open an issue on GitHub.
