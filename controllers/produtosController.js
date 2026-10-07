import mongoose from 'mongoose';

const produtoSchema = new mongoose.Schema({
	nome: { type: String, required: true },
	preco: { type: Number, required: true },
	categoria: String,
	descricao: String,
	origem: String
}, { strict: false, versionKey: false });

export const Produto = mongoose.models.Produto || mongoose.model('Produto', produtoSchema, 'produtos');

export async function listarProdutos(req, res) {
	try {
		if (mongoose.connection.readyState !== 1) {
			return res.status(503).json({ mensagem: 'MongoDB não está conectado.' });
		}
		const produtos = await Produto.find().lean();
		return res.json(produtos);
	} catch (erro) {
		console.error('[PRODUTOS] Falha ao consultar catálogo:', erro.message);
		return res.status(500).json({ mensagem: 'Não foi possível carregar o catálogo.' });
	}
}

export async function criarProduto(req, res) {
	try {
		const nome = String(req.body?.nome || '').trim();
		const preco = Number(req.body?.preco);
		if (!nome || !Number.isFinite(preco) || preco < 0) {
			return res.status(400).json({ mensagem: 'Informe nome e preço válido para o produto.' });
		}
		if (mongoose.connection.readyState !== 1) {
			return res.status(503).json({ mensagem: 'MongoDB não está conectado.' });
		}
		const produto = await Produto.create({ ...req.body, nome, preco });
		return res.status(201).json({ mensagem: 'Produto criado com sucesso.', produto });
	} catch (erro) {
		console.error('[PRODUTOS] Falha ao cadastrar produto:', erro.message);
		return res.status(500).json({ mensagem: 'Não foi possível cadastrar o produto.' });
	}
}
