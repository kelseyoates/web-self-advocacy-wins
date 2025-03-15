import Typesense from 'typesense';

export const typesenseClient = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST,
    port: '443',
    protocol: 'https',
  }],
  apiKey: process.env.TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 5,
  retryIntervalSeconds: 0.5,
  numRetries: 2,
  cacheTTLSeconds: 60,
  useServerSideSearchCache: true,
}); 