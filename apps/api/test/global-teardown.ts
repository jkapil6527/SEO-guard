export default async function globalTeardown(): Promise<void> {
  const g = globalThis as Record<string, unknown>;
  const pg = g.__EMBEDDED_PG__ as { stop(): Promise<void> } | undefined;
  if (pg) await pg.stop();
}
