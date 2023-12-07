const path = require('path');
const express = require('express');
const session = require('express-session');
const PORT = process.env.PORT || 3000;
const { Pool } = require('postgres-pool');
const bodyParser = require('body-parser');

const app = express();
app.use(session({
    secret: '@_bubishi_76_underground_@',
    resave: false,
    saveUninitialized: false,
}));
app.set('trust proxy', true)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public_html')))
app.use(express.static(path.join(__dirname, 'node_modules')))

const pool = new Pool({
    connectionString: 'postgres://indieuser:UEVKxfdIPZSMc5NcaB3h47K0uKGz0zGO@dpg-clmrq5nfeb2c73ebjpog-a.oregon-postgres.render.com/okinawadatabase',
    retryConnectionMaxRetries: 50,
    retryConnectionWaitMillis: 500,
    ssl: true,
});

app.get("/",async (req, res) => {
    var us = req.session.usuario || false;
    console.log(us)
     if (us) {
      return res.sendFile(path.join(__dirname, 'public_html', 'logado.html'))
     } else {
       return res.sendFile(path.join(__dirname, 'public_html', 'home.html'))
     }
    
 })
// Rota de login
app.post('/login', async (req, res) => {
    console.log(req.body)
    var usuario = req.body.usuario;
    var senha = req.body.senha;

    try {
        const client = await pool.connect();
        // Consulta para verificar o login
        const result = await client.query('SELECT * FROM usuarios WHERE usuario = $1 AND senha = $2 AND is_admin = true AND usuario_ativo = TRUE;', [usuario, senha]);

        if (result.rows.length > 0) {
            // Login bem-sucedido
            console.warn("EAS: ",result.rows[0].id)
            req.session.ida = result.rows[0].id;
            req.session.usuario = result.rows[0]; // Armazenar informações do usuário na sessão se necessário
            res.status(200).json({ success: true, message: 'Login bem-sucedido' });
        } else {
            // Credenciais inválidas
            res.status(401).json({ success: false, message: 'Credenciais inválidas' });
        }

        client.release();
    } catch (error) {
        console.error('Erro ao realizar login:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});
app.get("/create-mensalidades", (req, res) =>{
  
async function criarMensalidadesParaUsuarios() {
  const client = await pool.connect();
  var content = {
    users:[]
  };
 
  try {
   

   
    // Obter a lista de usuários
    const usuariosResult = await client.query('SELECT id FROM usuarios');
    const usuarios = usuariosResult.rows;

    // Consulta antecipada para verificar se já existem mensalidades para todos os usuários neste ano
    const usuarioIds = usuarios.map(usuario => usuario.id);
    const verificacaoResult = await client.query(`
      SELECT DISTINCT usuario_id
      FROM mensalidades
      WHERE usuario_id = ANY($1) AND EXTRACT(YEAR FROM data_vencimento) = EXTRACT(YEAR FROM CURRENT_DATE)
    `, [usuarioIds]);

    const usuariosComMensalidades = verificacaoResult.rows.map(row => row.usuario_id);

    // Loop para criar mensalidades apenas para usuários sem mensalidades neste ano
    for (const usuario of usuarios) {
      const usuarioId = usuario.id;

      if (!usuariosComMensalidades.includes(usuarioId)) {
        const dataAtual = new Date();
        const mensalidades = [];

        for (let mes = 1; mes <= 12; mes++) {
          const dataVencimento = new Date(Date.UTC(dataAtual.getFullYear(), mes - 1, 1));
          const valor = 50.00; // Substitua pelo valor desejado

          mensalidades.push([usuarioId, 1, dataVencimento, valor, false, null]);
        }

        // Bulk insert de todas as mensalidades de uma vez
        await client.query(`
          INSERT INTO mensalidades (usuario_id, plano_id, data_vencimento, valor, pago, data_pagamento)
          VALUES ${mensalidades.map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`).join(',')}
        `, mensalidades.flat());

        console.log(`Mensalidades criadas para o usuário com ID ${usuarioId}`);
      
      } else {
        console.log(`Mensalidades já existem para o usuário com ID ${usuarioId}`);
      }
    }
    res.json({
      teste: true
    });
    // Adicione um retorno aqui para evitar continuar a execução após enviar uma resposta
    return;
  } catch (error) {
    console.error('Erro ao criar mensalidades:', error);
    // Se ocorrer um erro, envie uma resposta de erro ao cliente
    res.status(500).json({ error: 'Erro ao criar mensalidades.', e: error });
  } finally {
    await client.end();
  }
}

// Chamar a função
criarMensalidadesParaUsuarios();
})
app.post('/api/app/login', async (req, res) => {
  console.log(req.body)
  var usuario = req.body.usuario;
  var senha = req.body.senha;

  try {
      const client = await pool.connect();
  
      // Consulta para verificar o login
      const result = await client.query('SELECT * FROM usuarios WHERE usuario = $1 AND senha = $2', [usuario, senha]);

      if (result.rows.length > 0) {
          // Login bem-sucedido
          console.warn("EAS: ",result.rows[0].id)
          req.session.idAPP = result.rows[0].id;
          req.session.usuarioAPP = result.rows[0]; // Armazenar informações do usuário na sessão se necessário
          res.status(200).json({ success: true, message: 'Login bem-sucedido' });
      } else {
          // Credenciais inválidas
          res.status(401).json({ success: false, message: 'Credenciais inválidas' });
      }

      client.release();
  } catch (error) {
      console.error('Erro ao realizar login:', error);
      res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

app.get("/sql", async function (req, res) {
    try {
        const client = await pool.connect();
        var sql = "UPDATE mensalidades SET pago ='true', data_pagamento = CURRENT_DATE WHERE id = '4'; ";
        res.json((await client.query(sql)).rows);
    } catch (error) {
        console.error('Erro ao realizar login:', error);
        res.status(500).json(error);
    }
})
// Rota protegida (exemplo)
app.get('/mensalidades-nao-pagas', async (req, res) => {
  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;
    const client = await pool.connect();
    try {
      const result = await client.query(`
      SELECT m.*, p.*
FROM mensalidades m
JOIN planos p ON m.plano_id = p.id
WHERE m.pago = false AND m.usuario_id = ${req.session.ida} ;`);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json(err);
    }
  });
  app.get('/mensalidades-usuario', async (req, res) => {
    const anoAtual = new Date().getFullYear();
    const mesAtual = new Date().getMonth() + 1;
    const client = await pool.connect();
    console.log(anoAtual + '-' + mesAtual +'__')
    try {
      // Verifique se o usuário está autenticado (exemplo: usando express-session)
      const userId = req.session.usuario;
        console.log(req.session.ida)
      if (!req.session.ida) {
        return res.status(401).json({ error: 'Usuário não autenticado.' });
      }
  console.log(req.session.ida)
      // Consulta para obter mensalidades não pagas do usuário específico
      const result = await client.query(`
        SELECT m.id, m.data_vencimento, m.valor, m.pago
        FROM mensalidades m
        WHERE m.usuario_id = '${req.session.ida}' AND m.pago = false;`);
  
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao recuperar mensalidades do usuário.' });
    }
  });

app.get('/perfil', (req, res) => {
    if (req.session.usuario) {
        // Se o usuário estiver autenticado, mostrar o perfil
        res.status(200).json({ success: true, perfil: req.session.usuario });
    } else {
        // Se não estiver autenticado, redirecionar para a página de login
        res.status(401).json({ success: false, message: 'Não autorizado' });
    }
});



app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});