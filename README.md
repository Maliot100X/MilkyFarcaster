# MilkyFarcaster

MilkyFarcaster is a production-ready Farcaster Mini App on Base Mainnet. It serves as an interactive arcade, utility hub, and AI assistant for Farcaster users.

## Full Production Release

This release upgrades the application from mocked demos to real on-chain interactions, persistent database storage, and AI agent integration.

### Key Features
- **Real Burn System**: Burn ETH or ERC-20 tokens (USDC, DEGEN, WETH) on Base to earn XP. Transactions are verified on-chain via backend with idempotency checks.
- **Game Hub**: 
  - **Daily Spin**: Persistent server-side cooldowns (24h) and rewards stored in Supabase.
  - **Milky Trivia**: Interactive quiz with score tracking and XP rewards.
- **Social Stats**: Integration with Neynar API to fetch real user followers, engagement, and calculate "Reputation".
- **AI & Bot Agent**: 
  - **MilkyBot**: Built-in AI helper for Farcaster/Base questions (powered by AIML API).
  - **MoltBot Integration**: Automated task runner agent embedded in the app (powered by Groq/OpenRouter/GitHub Models).
- **Leaderboards**: Real-time XP leaderboards powered by Supabase.
- **Coin Death Counter**: Community-driven coin status tracker.
- **Wallet Support**: Full support for Farcaster Custody, Coinbase Wallet, and MetaMask.
- **File Storage**: Pinata IPFS integration for uploads.

## Tech Stack
- **Frontend**: Vite + React + TypeScript + Tailwind CSS
- **Blockchain**: Wagmi + Viem (Base Mainnet)
- **Backend**: Vercel Serverless Functions (Node.js)
- **Database**: Supabase (Postgres)
- **Storage**: Pinata (Images/Files)
- **APIs**: Neynar (Stats), AIML (Chat), MoltBot (Agent)
- **SDK**: @farcaster/miniapp-sdk

## Configuration

The project is configured to use Vercel for deployment and Supabase for the database.

### Environment Variables
The following environment variables are required (and have been configured in `.env.local`):

```env
# Farcaster / Neynar
NEYNAR_API_KEY=...
NEYNAR_CLIENT_ID=...
NEYNAR_SNAPCHAIN_URL=...
NEYNAR_NOTIFICATION_WEBHOOK=...

# App URLs & Blockchain
NEXT_PUBLIC_APP_URL=...
NEXT_PUBLIC_CHAIN_ID=8453
BASE_RPC_URL=...

# Contracts / Burn
NEXT_PUBLIC_BURN_CONTRACT=...
NEXT_PUBLIC_BURN_TOKEN=...

# Backend / Database
DATABASE_URL=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# AI Assistant & MoltBot
AIML_API_KEY_1=...
MOLTBOT_API_KEY_1=...
MOLTBOT_REPO=...

# Storage & Tools
PINATA_JWT=...
NEXT_PUBLIC_ZORA_API_KEY=...
NEXT_PUBLIC_PLATFORM_WALLET=...
GITHUB_TOKEN=...

# Pricing & Configuration
NEXT_PUBLIC_SUBSCRIPTION_PRICE=15
NEXT_PUBLIC_TRIAL_PRICE=1
NEXT_PUBLIC_LEADERBOARD_TOP=3
```

## Database Schema (Supabase)

The app uses the following tables in Supabase:

1. **`users` table**:
   - `fid` (int8, primary key): Farcaster ID
   - `xp` (int8): Total Experience Points
   - `data` (jsonb): Stores game metadata (lastSpin, lastQuiz, etc.)
   - `last_active` (timestamptz)

2. **`burns` table**:
   - `tx_hash` (text, primary key): Transaction Hash (for idempotency)
   - `fid` (int8)
   - `token` (text)
   - `amount` (text)
   - `xp_awarded` (int8)
   - `created_at` (timestamptz)

3. **`coins` table** (for Death Counter):
   - `symbol` (text, primary key)
   - `death_count` (int8)
   - `status` (text)
   - `last_declared_by` (int8)

## Deployment

1. **Build Locally**
   ```bash
   npm install
   npm run build
   ```

2. **Push to GitHub**
   Push the `main` branch to your repository.

3. **Deploy to Vercel**
   - Connect your GitHub repository to Vercel.
   - Vercel will automatically detect the Vite settings.
   - **Important**: Copy all variables from `.env.local` to Vercel Project Settings.
   - The `vercel.json` file handles SPA routing rewrites.

## Compliance
- `/.well-known/farcaster.json` is configured for Frame/Mini App discovery.
- `sdk.actions.ready()` is called on initialization.

## License
MIT
