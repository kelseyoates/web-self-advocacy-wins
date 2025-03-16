import Typesense from 'typesense';
import ENV from './environment';

export const typesenseClient = new Typesense.Client({
  nodes: [{
    host: ENV.TYPESENSE_HOST,
    port: '443',
    protocol: 'https',
  }],
  apiKey: ENV.TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 5,
  retryIntervalSeconds: 0.5,
  numRetries: 2,
  cacheTTLSeconds: 60,
  useServerSideSearchCache: true,
}); 