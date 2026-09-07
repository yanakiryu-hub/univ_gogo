import { crawlAndPersistAll } from "./persist.js";

async function main() {
  const results = await crawlAndPersistAll();
  for (const r of results) {
    const icon = r.status === "ok" ? "✅" : r.status === "skipped" ? "⏳" : "❌";
    console.log(`${icon} ${r.target} - ${r.detail ?? ""}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
