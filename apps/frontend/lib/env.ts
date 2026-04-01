export function getRequiredPublicEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Add it to apps/frontend/.env.local.`,
    );
  }
  return value;
}

export function getRequiredPublicEnvFromMany(names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }

  throw new Error(
    `Missing required environment variable. Set one of: ${names.join(
      ', ',
    )} in apps/frontend/.env.local.`,
  );
}

