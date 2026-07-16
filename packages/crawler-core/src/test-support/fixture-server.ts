/**
 * Local HTTP fixture server for crawler tests. Never touches the network
 * beyond 127.0.0.1.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FixtureServer {
  port: number;
  /** Absolute URL for a path on this server. */
  url(path: string): string;
  /** host:port allowlist entry for SafeFetcher. */
  allowTarget: string;
  close(): Promise<void>;
}

export async function startFixtureServer(handler: http.RequestListener): Promise<FixtureServer> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    port,
    url: (path: string) => `http://127.0.0.1:${port}${path}`,
    allowTarget: `127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
