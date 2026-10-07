import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path'; //
import { fileURLToPath } from 'node:url'; //

import conectarMongo from './config/mongodb.js';
import conectarRedis from './config/redis.js';
import conectarMySQL, { prepararBancoMySQL } from './config/mysql.js';
import rotas from './routes.js';

const app = express();
const diretorioAtual = path.dirname(fileURLToPath(import.meta.url)); //

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(diretorioAtual, 'public'))); //
app.use('/api', rotas);

async function iniciarBancos() {
    console.log('---INICIANDO CONEXÃO POLIGLOTA---');

    await conectarMongo();
    try {
        await conectarRedis();
    } catch (erro) {
        console.error('[REDIS] - Inicialização falhou. Confira REDIS_URL:', erro.message);
    }
    try {
        await conectarMySQL();
        await prepararBancoMySQL();
    } catch (erro) {
        console.error('[MYSQL] - Inicialização falhou. Confira o serviço e as variáveis MYSQL_*:', erro.message);
    }
}

iniciarBancos();

app.get('/status', (req, res) => {
    res.json({ status: "API DA LOJA RODANDO..." });
});

const PORTA = process.env.PORTA_API || 3000;

app.listen(PORTA, () => {
    console.log(`Servidor rodando na porta: ${PORTA}`);
});