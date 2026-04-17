const { spawnSync } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const argv = new Set(process.argv.slice(2));
const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";

if (appEnv === "production" && !argv.has("--allow-production")) {
  throw new Error("reseed-dev-dataset.cjs blocks production by default. Use APP_ENV=development or pass --allow-production explicitly.");
}

function runStep(label, scriptName, args = []) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, [path.join(projectRoot, "scripts", scriptName), ...args], {
    stdio: "inherit",
    cwd: projectRoot,
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function main() {
  runStep("Cleanup dev dataset", "cleanup-dev-dataset.cjs", ["--execute"]);
  runStep("Seed baseline dataset", "seed-final.cjs");
  runStep("Rebuild dashboard aggregates", "rebuild-dashboard-aggregates.cjs");

  if (argv.has("--verify")) {
    runStep("Verify phase1", "verify-phase1.cjs");
    runStep("Verify phase2 mutations", "verify-phase2-mutations.cjs");
    runStep("Verify phase3 guardrails", "verify-phase3-guardrails.cjs");
    runStep("Verify image flows", "verify-image-flows.cjs");
  }
}

main();
