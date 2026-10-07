import { createClient } from 'redis';

export const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on('error', (err) =>
    console.error('[REDIS] - FALHA NA CONEXÃO', err)
);

redisClient.on('connect', () =>
    console.log('[REDIS] - CONECTADO COM SUCESSO!')
);

async function conectarRedis() {
    await redisClient.connect();
}

export default conectarRedis;