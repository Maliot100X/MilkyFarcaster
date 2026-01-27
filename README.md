# MilkyFarcaster (Phase 1)

MilkyFarcaster is a Farcaster Mini App built with Vite, React, and Tailwind CSS. It is designed to be an arcade-style hub for Farcaster users.

## Phase 1 Overview

Phase 1 focuses on the UI and user flow, with mocked logic for blockchain transactions and backend interactions.

### Features
- **Home**: User profile, XP, Level, and activity feed.
- **Burn**: Simulate burning $MILKY tokens to reveal secrets and earn XP.
- **Play**: Daily spin/loot mechanics (mocked).
- **Stats**: View reputation, caster archetype, and follower insights.
- **More**: Coin Death Counter, Leaderboards (soon), Notifications (soon), Settings.

## Tech Stack
- **Framework**: Vite + React + TypeScript
- **Styling**: Tailwind CSS
- **SDK**: @farcaster/miniapp-sdk
- **Web3**: wagmi + viem
- **State**: React Context + React Query

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Maliot100X/MilkyFarcaster.git
   cd MilkyFarcaster
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open the app in your browser or Farcaster client.
   - For local development, the app mocks the Farcaster context if not running inside a frame.

## Deployment

This project is ready for deployment on Vercel.

1. Push to GitHub.
2. Import project into Vercel.
3. Deploy.

## License

MIT
