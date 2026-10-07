import { Router } from 'express';
import { listarProdutos, criarProduto } from './controllers/produtosController.js';
import { adicionarAoCarrinho, verCarrinho, removerDoCarrinho } from './controllers/carrinhoController.js';
import { finalizarPedido } from './controllers/pedidoController.js';

const router = Router();

router.get('/produtos', listarProdutos);
router.post('/produtos', criarProduto);

router.post('/carrinho', adicionarAoCarrinho);
router.get('/carrinho/:idUsuario', verCarrinho);
router.delete('/carrinho/:idUsuario/:produtoId', removerDoCarrinho);

router.post('/pedidos', finalizarPedido);

export default router;
