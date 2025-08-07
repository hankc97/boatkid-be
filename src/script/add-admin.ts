import { withTrx } from "../kysely/db";
import dotenv from "dotenv";
dotenv.config();

const ADMINS_TO_BE_ADDED = [
  "0xAb0fb9ea07CC64703e7954611CF37903bF2Cacdf",
  "0x0310FCa624245cD0E8cbB842730ee946f8702a4b",
];

const main = async () => {
  return await withTrx(async (trx) => {
    for (const adminWallet of ADMINS_TO_BE_ADDED) {
      // Verify admin access
      const admin = await trx
        .insertInto("nochill_admin")
        .values({
          wallet_address: adminWallet,
        })
        .onConflict((oc) => oc.doNothing())
        .returningAll()
        .executeTakeFirst();
    }
  });
};

main()
  .then(() => {
    console.log("Done");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
