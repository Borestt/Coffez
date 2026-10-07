import mongoose from 'mongoose';
import conectarMySQL, { prepararBancoMySQL } from '../config/mysql.js';
import { redisClient } from '../config/redis.js';
import { Produto } from './produtosController.js';

function validarUsuario(valor) {
	const id = Number(valor);
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function finalizarPedido(req, res) {
	const idUsuario = validarUsuario(req.body?.idUsuario);
	if (!idUsuario) {
		return res.status(400).json({ mensagem: 'idUsuario deve ser um número inteiro positivo.' });
	}
	if (!redisClient.isReady) {
		return res.status(503).json({ mensagem: 'Redis não está conectado; não foi possível validar o carrinho.' });
	}
	if (mongoose.connection.readyState !== 1) {
		return res.status(503).json({ mensagem: 'MongoDB não está conectado; não foi possível validar os preços.' });
	}

	const chaveCarrinho = `carrinho:${idUsuario}`;
	let conexao;
	let transacaoAberta = false;

	try {
		const itensCarrinho = (await redisClient.lRange(chaveCarrinho, 0, -1))
			.map(valor => JSON.parse(valor));
		if (!itensCarrinho.length) {
			return res.status(400).json({ mensagem: 'O carrinho está vazio ou expirou.' });
		}

		const quantidades = new Map();
		for (const item of itensCarrinho) {
			const produtoId = String(item?.produto || '').trim();
			const quantidade = Number(item?.quantidade);
			if (!produtoId || !Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 99) {
				return res.status(400).json({ mensagem: 'O carrinho contém um item inválido.' });
			}
			quantidades.set(produtoId, (quantidades.get(produtoId) || 0) + quantidade);
		}

		const idsProduto = [...quantidades.keys()];
		if (idsProduto.some(id => !mongoose.isValidObjectId(id))) {
			return res.status(400).json({ mensagem: 'O carrinho contém um identificador de produto inválido.' });
		}

		const produtos = await Produto.find({ _id: { $in: idsProduto } }).lean();
		const produtosPorId = new Map(produtos.map(produto => [String(produto._id), produto]));
		const linhasPedido = [];
		let totalCalculado = 0;

		for (const [produtoId, quantidade] of quantidades) {
			const produto = produtosPorId.get(produtoId);
			const preco = Number(produto?.preco);
			if (!produto || !Number.isFinite(preco) || preco < 0) {
				return res.status(409).json({ mensagem: 'Um produto do carrinho não está mais disponível.' });
			}
			const subtotal = Math.round(preco * 100) * quantidade / 100;
			totalCalculado += subtotal;
			linhasPedido.push({
				produtoId,
				nome: String(produto.nome || 'Produto'),
				quantidade,
				precoUnitario: Math.round(preco * 100) / 100,
				subtotal
			});
		}

		// O total recebido pelo navegador nunca é usado: os valores são recalculados a partir do MongoDB.
		const total = Math.round(totalCalculado * 100) / 100;
		const banco = await conectarMySQL();
		await prepararBancoMySQL();
		conexao = await banco.getConnection();
		await conexao.beginTransaction();
		transacaoAberta = true;

		const [resultado] = await conexao.execute(
			'INSERT INTO pedidos (id_usuario, total) VALUES (?, ?)',
			[idUsuario, total]
		);
		for (const linha of linhasPedido) {
			await conexao.execute(
				`INSERT INTO pedido_itens
					(id_pedido, produto_id, nome_produto, quantidade, preco_unitario, subtotal)
				 VALUES (?, ?, ?, ?, ?, ?)`,
				[resultado.insertId, linha.produtoId, linha.nome, linha.quantidade, linha.precoUnitario, linha.subtotal]
			);
		}

		await conexao.commit();
		transacaoAberta = false;
		let avisoCarrinho = null;
		try {
			await redisClient.del(chaveCarrinho);
		} catch (erroRedis) {
			avisoCarrinho = 'Pedido salvo, mas não foi possível limpar o carrinho Redis.';
			console.error('[PEDIDOS] Falha ao limpar carrinho após commit:', erroRedis.message);
		}

		return res.status(201).json({
			mensagem: 'Pedido criado com sucesso.',
			id_pedido: resultado.insertId,
			total,
			itens: linhasPedido.map(({ produtoId, nome, quantidade, precoUnitario, subtotal }) => ({
				produto: produtoId,
				nome,
				quantidade,
				precoUnitario,
				subtotal
			})),
			...(avisoCarrinho ? { aviso: avisoCarrinho } : {})
		});
	} catch (erro) {
		if (transacaoAberta && conexao) {
			try { await conexao.rollback(); } catch (erroRollback) {
				console.error('[PEDIDOS] Falha no rollback:', erroRollback.message);
			}
		}
		console.error('[PEDIDOS] Falha ao finalizar compra:', erro.message);
		return res.status(500).json({ mensagem: 'Não foi possível finalizar o pedido.' });
	} finally {
		conexao?.release();
	}
}
