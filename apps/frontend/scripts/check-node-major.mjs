const requiredMajor = 24;

const raw = process.versions?.node ?? '';
const major = Number.parseInt(raw.split('.')[0] ?? '', 10);

if (!Number.isFinite(major)) {
  console.error(`Could not parse Node version: "${raw}"`);
  process.exit(1);
}

if (major !== requiredMajor) {
  console.error(
    `This frontend requires Node ${requiredMajor}.x (found ${raw}).\n` +
      `Fix: run "nvm use" (repo has .nvmrc=24) and retry.`,
  );
  process.exit(1);
}

