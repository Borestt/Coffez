import mongoose from "mongoose";

async function conectarMongo() {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('[MONGO] - CONECTADO COM SUCESSO!');
    } catch (error) {
        console.log('[MONGO - FALHA NA CONEXÃO', error.message);
    }
}

export default conectarMongo;