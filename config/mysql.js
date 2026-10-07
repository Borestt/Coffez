import mysql from 'mysql2/promise';

let pool;
let inicializacao;

function obterConfiguracao() {
	const nomeBanco = process.env.MYSQL_DB || 'ecommerce';
	const porta = Number(process.env.MYSQL_PORT || 3306);
	const limiteConexoes = Number(process.env.MYSQL_CONNECTION_LIMIT || 10);
	if (!/^[a-zA-Z0-9_$]+$/.test(nomeBanco)) {
		throw new Error('MYSQL_DB aceita somente letras, números, _ e $.');
	}
	if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
		throw new Error('MYSQL_PORT deve ser uma porta entre 1 e 65535.');
	}
	if (!Number.isInteger(limiteConexoes) || limiteConexoes < 1 || limiteConexoes > 100) {
		throw new Error('MYSQL_CONNECTION_LIMIT deve ser um inteiro entre 1 e 100.');
	}

	return {
		host: process.env.MYSQL_HOST || 'localhost',
		port: porta,
		user: process.env.MYSQL_USER || 'root',
		password: process.env.MYSQL_PASS || '',
		database: nomeBanco,
		connectionLimit: limiteConexoes,
		connectTimeout: Number(process.env.MYSQL_CONNECT_TIMEOUT || 10000)
	};
}

async function inicializarBanco() {
	const configuracao = obterConfiguracao();
	const conexaoInicial = await mysql.createConnection({
		host: configuracao.host,
		port: configuracao.port,
		user: configuracao.user,
		password: configuracao.password
	});

	try {
		await conexaoInicial.query(
			`CREATE DATABASE IF NOT EXISTS \`${configuracao.database}\`
			 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
		);
	} finally {
		await conexaoInicial.end();
	}

	pool = mysql.createPool({
		...configuracao,
		waitForConnections: true,
		queueLimit: 0,
		decimalNumbers: true,
		charset: 'utf8mb4'
	});

	await pool.query('SELECT 1');
	return pool;
}

export async function conectarMySQL() {
	if (!inicializacao) {
		inicializacao = inicializarBanco().catch(erro => {
			pool = undefined;
			inicializacao = undefined;
			throw erro;
		});
	}
	const banco = await inicializacao;
	const conexao = await banco.getConnection();
	conexao.release();
	console.log(`[MYSQL] - Conectado ao banco "${obterConfiguracao().database}".`);
	return banco;
}

export async function prepararBancoMySQL() {
	const banco = await conectarMySQL();
	await banco.execute(`
		CREATE TABLE IF NOT EXISTS pedidos (
			id INT AUTO_INCREMENT PRIMARY KEY,
			id_usuario INT NOT NULL,
			total DECIMAL(10, 2) NOT NULL,
			data_compra TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`);
	await banco.execute(`
		CREATE TABLE IF NOT EXISTS pedido_itens (
			id INT AUTO_INCREMENT PRIMARY KEY,
			id_pedido INT NOT NULL,
			produto_id VARCHAR(100) NOT NULL,
			nome_produto VARCHAR(255) NOT NULL,
			quantidade INT NOT NULL,
			preco_unitario DECIMAL(10, 2) NOT NULL,
			subtotal DECIMAL(10, 2) NOT NULL,
			CONSTRAINT fk_pedido_itens_pedido
				FOREIGN KEY (id_pedido) REFERENCES pedidos(id) ON DELETE CASCADE
		)
	`);
	return banco;
}

export default conectarMySQL;
