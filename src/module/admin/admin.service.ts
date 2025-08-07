import { Injectable, Logger } from "@nestjs/common";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { BN, Wallet } from "@coral-xyz/anchor";
import base58 from "bs58";
import { getProgram, PROGRAM_ID } from "../../program/program";
import { MINT } from "../user/user.service";

interface Participant {
  publicKey: PublicKey;
  account: {
    user: PublicKey;
    amount: anchor.BN;
    token: PublicKey;
    game: PublicKey;
  };
}

export interface GameResolutionResult {
  success: boolean;
  transactionSignature: string;
  winner: string;
  participants: number;
  totalPrizePool: number;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly resolvingGames = new Set<string>();

  private async setupProgram() {
    // Setup connection
    const connection = new Connection(
      process.env.RPC_URL || "https://api.devnet.solana.com",
      "confirmed"
    );

    // Get operator keypair
    if (!process.env.OPERATOR_SK) {
      throw new Error("OPERATOR_SK environment variable is required");
    }

    const operatorKeypair = Keypair.fromSecretKey(
      new Uint8Array(base58.decode(process.env.OPERATOR_SK))
    );

    const wallet = new Wallet(operatorKeypair);
    const program = await getProgram(wallet, PROGRAM_ID, connection);

    return { connection, program, operatorKeypair };
  }

  private selectWinnerByWeight(participants: Participant[]): Participant {
    // Calculate total bet amount
    const totalBetAmount = participants.reduce(
      (sum, participant) => sum + participant.account.amount.toNumber(),
      0
    );

    this.logger.log(`Total bet amount: ${totalBetAmount}`);

    // Calculate probabilities and log them
    participants.forEach((participant, index) => {
      const betAmount = participant.account.amount.toNumber();
      const probability = betAmount / totalBetAmount;
      const percentage = (probability * 100).toFixed(2);

      this.logger.log(
        `Participant #${
          index + 1
        }: ${participant.account.user.toString()} - Bet: ${
          betAmount / Math.pow(10, 6)
        } tokens - Probability: ${percentage}%`
      );
    });

    // Generate random number between 0 and totalBetAmount
    const randomValue = Math.floor(Math.random() * totalBetAmount);
    this.logger.log(`Random value generated: ${randomValue}`);

    // Find winner using cumulative distribution
    let cumulativeAmount = 0;
    for (let i = 0; i < participants.length; i++) {
      cumulativeAmount += participants[i].account.amount.toNumber();
      if (randomValue < cumulativeAmount) {
        this.logger.log(
          `Winner selected: Participant #${i + 1} - ${participants[
            i
          ].account.user.toString()}`
        );
        return participants[i];
      }
    }

    // Fallback (should never happen)
    return participants[participants.length - 1];
  }

  async resolveGame(gameAddress: string): Promise<GameResolutionResult> {
    // Check if this game is already being resolved
    if (this.resolvingGames.has(gameAddress)) {
      this.logger.warn(
        `Game ${gameAddress} is already being resolved, skipping duplicate request`
      );
      throw new Error("Game resolution already in progress");
    }

    // Add to resolving set
    this.resolvingGames.add(gameAddress);

    try {
      this.logger.log(`Starting game resolution for: ${gameAddress}`);

      const { connection, program, operatorKeypair } =
        await this.setupProgram();

      // Validate game address
      let gamePda: PublicKey;
      try {
        gamePda = new PublicKey(gameAddress);
      } catch (error) {
        throw new Error("Invalid game address provided");
      }

      // Get the game data
      let gameData;
      try {
        gameData = await program.account.generalGame.fetch(gamePda);
      } catch (error) {
        throw new Error("Game not found or account does not exist");
      }

      this.logger.log(
        `Game found - Nonce: ${gameData.nonce.toString()}, Status: ${JSON.stringify(
          gameData.status
        )}`
      );

      // Check if game can be resolved
      const canResolve =
        "initialized" in gameData.status || "started" in gameData.status;

      if (!canResolve) {
        throw new Error(
          "Game cannot be resolved - already resolved or invalid status"
        );
      }

      // Get all participants for this game
      const allGameBets = await program.account.gameBet.all();
      const gameParticipants: Participant[] = allGameBets.filter((bet) =>
        bet.account.game.equals(gamePda)
      );

      if (gameParticipants.length === 0) {
        throw new Error("No participants found for this game");
      }

      this.logger.log(`Found ${gameParticipants.length} participants`);

      // Run weighted random selection
      const winner = this.selectWinnerByWeight(gameParticipants);

      // Calculate total prize pool
      const totalPrizePool = gameParticipants.reduce(
        (sum, participant) => sum + participant.account.amount.toNumber(),
        0
      );

      // Prepare resolve_game instruction
      const mint = new PublicKey(MINT);

      // Create claim data - for this implementation, we'll create rewards for all participants
      // but the winner gets the actual token transfer
      const claimData = gameParticipants.map((participant) => ({
        mint: mint,
        amount: new anchor.BN(1), // 1 token for participation
        user: participant.account.user,
      }));

      // Winner gets additional reward
      claimData.push({
        mint: mint,
        amount: new anchor.BN(10), // 10 tokens for winning
        user: winner.account.user,
      });

      this.logger.log(
        `Preparing transaction for winner: ${winner.account.user.toString()}`
      );

      // Call resolve_game instruction
      const resolveGameIx = await program.methods
        .resolveGame(claimData, winner.account.user)
        .accounts({
          operator: operatorKeypair.publicKey,
          winner: winner.account.user,
          game: gamePda,
          tokenProgram: TOKEN_PROGRAM_ID,
          mint: mint,
          winnerAta: getAssociatedTokenAddressSync(mint, winner.account.user),
        })
        .instruction();

      const { blockhash } = await connection.getLatestBlockhash("finalized");
      const messageV0 = new TransactionMessage({
        payerKey: operatorKeypair.publicKey,
        recentBlockhash: blockhash,
        instructions: [resolveGameIx],
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);
      transaction.sign([operatorKeypair]);

      // Simulate first
      this.logger.log("Simulating transaction...");
      const sim = await connection.simulateTransaction(transaction);

      if (sim.value.err) {
        this.logger.error(
          "Simulation failed:",
          JSON.stringify(sim.value.err, null, 2)
        );
        this.logger.error(
          "Simulation logs:",
          sim.value.logs?.join("\n") || "No logs available"
        );
        throw new Error(
          `Transaction simulation failed: ${JSON.stringify(sim.value.err)}`
        );
      }

      this.logger.log("Simulation successful");

      // Send transaction
      this.logger.log("Sending transaction...");
      const txSignature = await connection.sendRawTransaction(
        transaction.serialize()
      );

      // Wait for confirmation
      this.logger.log("Waiting for confirmation...");
      await connection.confirmTransaction(txSignature, "finalized");

      this.logger.log(
        `Game resolved successfully! Transaction: ${txSignature}`
      );

      return {
        success: true,
        transactionSignature: txSignature,
        winner: winner.account.user.toString(),
        participants: gameParticipants.length,
        totalPrizePool: totalPrizePool / Math.pow(10, 6), // Convert to readable format
      };
    } catch (error) {
      this.logger.error("Error resolving game:", error);
      throw error;
    } finally {
      // Always remove from resolving set
      this.resolvingGames.delete(gameAddress);
    }
  }
}
