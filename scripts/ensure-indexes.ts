import "dotenv/config";
import { db } from "../lib/db";

async function main() {
  await db.ensureIndexes();
  console.log("MongoDB indexes are ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
