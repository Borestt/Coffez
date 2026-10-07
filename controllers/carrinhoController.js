import { redisClient } from '../config/redis.js';

const TEMPO_EXPIRACAO_SEGUNDOS = 60 * 60;

function validarUsuario(idUsuario) {
	const id = Number(idUsuario);
	return Number.isSafeInteger(id) && id > 0 ? String(id) : null;
}

export async function adicionarAoCarrinho(req, res) {
	try {
		const idUsuario = validarUsuario(req.body?.idUsuario);
		const produto = String(req.body?.produto || '').trim();
		const quantidade = Number(req.body?.quantidade ?? 1);

		if (!idUsuario || !produto || !Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 99) {
			return res.status(400).json({ mensagem: 'Informe idUsuario, produto e uma quantidade inteira entre 1 e 99.' });
		}
		if (!redisClient.isReady) {
			return res.status(503).json({ mensagem: 'Redis não está conectado.' });
		}

		const chave = `carrinho:${idUsuario}`;
		const item = { produto, quantidade };
		await redisClient.rPush(chave, JSON.stringify(item));
		await redisClient.expire(chave, TEMPO_EXPIRACAO_SEGUNDOS);
		const itens = (await redisClient.lRange(chave, 0, -1)).map(valor => JSON.parse(valor));

		return res.status(200).json({
			mensagem: 'Item adicionado ao carrinho. Ele expira após uma hora sem atividade.',
			carrinho: itens,
			ttlSegundos: TEMPO_EXPIRACAO_SEGUNDOS
		});
	} catch (erro) {
		console.error('[CARRINHO] Falha ao adicionar item:', erro.message);
		return res.status(500).json({ mensagem: 'Não foi possível atualizar o carrinho.' });
	}
}

export async function verCarrinho(req, res) {
	try {
		const idUsuario = validarUsuario(req.params.idUsuario);
		if (!idUsuario) return res.status(400).json({ mensagem: 'idUsuario deve ser um número inteiro positivo.' });
		if (!redisClient.isReady) {
			return res.status(503).json({ mensagem: 'Redis não está conectado.' });
		}

		const itens = (await redisClient.lRange(`carrinho:${idUsuario}`, 0, -1))
			.map(valor => JSON.parse(valor));
		return res.json({ usuario: idUsuario, itens });
	} catch (erro) {
		console.error('[CARRINHO] Falha ao consultar carrinho:', erro.message);
		return res.status(500).json({ mensagem: 'Não foi possível consultar o carrinho.' });
	}
}

export async function removerDoCarrinho(req, res) {
	try {
		const idUsuario = validarUsuario(req.params.idUsuario);
		const produto = String(req.params.produtoId || '').trim();
		if (!idUsuario || !produto || produto.length > 100) {
			return res.status(400).json({ mensagem: 'Informe um usuário e um identificador de produto válidos.' });
		}
		if (!redisClient.isReady) {
			return res.status(503).json({ mensagem: 'Redis não está conectado.' });
		}

		const chave = `carrinho:${idUsuario}`;
		const valores = await redisClient.lRange(chave, 0, -1);
		const remover = valores.filter(valor => JSON.parse(valor)?.produto === produto);
		if (!remover.length) {
			return res.status(404).json({ mensagem: 'Esse produto não está no carrinho.' });
		}

		for (const valor of remover) await redisClient.lRem(chave, 0, valor);
		const restantes = (await redisClient.lRange(chave, 0, -1)).map(valor => JSON.parse(valor));
		if (restantes.length) await redisClient.expire(chave, TEMPO_EXPIRACAO_SEGUNDOS);

		return res.json({ mensagem: 'Produto removido do carrinho.', itens: restantes });
	} catch (erro) {
		console.error('[CARRINHO] Falha ao remover item:', erro.message);
		return res.status(500).json({ mensagem: 'Não foi possível remover o produto do carrinho.' });
	}
}
