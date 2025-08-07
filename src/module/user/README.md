# User Module

This module contains the user controller and service that handles game-related operations, specifically joining games with the start game functionality.

## Endpoints

### POST /user/join-game

Joins an existing game or starts a new game if needed, based on the logic from `join-game-with-start-game.ts`.

**Request Body:**
```json
{
  "wallet": "PlayerWalletPublicKey", // Player's wallet public key
  "betAmount": 5 // Optional: Bet amount in tokens (default: 5, USD amount will equal bet amount)
}
```

**Fixed Configuration:**
- Token Mint: `7fCZBjhEeB6nSktQa9381k5XHJ7SJ4bHnLfB3wgvjsYT` (hardcoded)

**Environment Variables Required:**
- `OPERATOR_SK`: The operator's private key as a base58 string
- `RPC_URL`: Solana RPC URL (defaults to devnet if not set)

**Response:**
```json
{
  "success": true,
  "message": "Transaction built successfully",
  "txn": "base58_encoded_transaction_for_frontend_to_sign",
  "gameAddress": "game_pda_address",
  "gameStatus": {
    "isNewGame": true,
    "gameAddress": "game_pda_address",
    "betAmount": 5,
    "usdAmount": 5
  }
}
```

### POST /user/health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "message": "User service is healthy"
}
```

## Implementation Notes

The service currently validates and processes join game requests with the following features:

✅ **Implemented:**
- Environment variable support for `OPERATOR_SK` and `RPC_URL`
- Full Anchor program integration
- Transaction building (following same pattern as stake.ts)
- Token balance and whitelist checking
- Game state logic (start new game vs join existing)
- Operator signing (backend signs, frontend signs player portion)
- Comprehensive validation and error handling
- All logic from original `join-game-with-start-game.ts`

## Environment Variables Required

- `OPERATOR_SK`: The operator's private key as a JSON array (e.g., "[1,2,3...]")
- `RPC_URL`: Optional Solana RPC URL (defaults to devnet)

## Usage Example

```bash
curl -X POST http://localhost:3000/user/join-game \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "YourWalletPublicKeyHere",
    "betAmount": 5
  }'
```

Make sure to set the required environment variables before starting the server:
```bash
export OPERATOR_SK="base58_encoded_private_key"
export RPC_URL="https://api.devnet.solana.com"
```

## How It Works

1. **Frontend calls the API** with the player's wallet address and optional bet parameters
2. **Backend builds the transaction** including:
   - Checking if a new game should be started or joining existing game
   - Validating token balance and whitelist status
   - Creating appropriate instructions (startGame + joinGame or just joinGame)
3. **Backend signs with operator key** and returns base58 encoded transaction
4. **Frontend receives the transaction** and prompts user to sign
5. **Frontend sends the signed transaction** to the blockchain

This follows the same pattern as the staking system where the backend builds transactions and the frontend handles user signing.

## Dependencies

- `@solana/web3.js`: Solana Web3 SDK  
- `@coral-xyz/anchor`: Anchor framework
- `@solana/spl-token`: SPL Token utilities
- `@nestjs/common`: NestJS common utilities
- `bs58`: Base58 encoding for transaction serialization
```