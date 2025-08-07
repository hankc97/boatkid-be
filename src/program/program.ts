import * as anchor from "@coral-xyz/anchor";
import { Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import base58 from "bs58";
import dotenv from "dotenv";
import fs from "fs-extra";
dotenv.config();
import { idl } from "./idl";
import { Boatkid } from "./type";

export async function getProgram(
  wallet: Wallet,
  programId: PublicKey,
  connection: Connection
): Promise<anchor.Program<Boatkid>> {
  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "recent",
  });
  try {
    return new anchor.Program(idl as anchor.Idl, provider);
  } catch (errr) {
    console.log(errr);
    throw new Error("Failed to get program");
  }
}

export const PROGRAM_ID = new PublicKey(
  "DbkSY7x2S7PFRNR1XtUtJBGbo3ri3YtQ7Mj3tkGV5eSD"
);
