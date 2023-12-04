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
        const result = await client.query('SELECT * FROM usuarios WHERE usuario = $1 AND senha = $2', [usuario, senha]);

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
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT u.nome, m.data_vencimento
        FROM usuarios u
        JOIN mensalidades m ON u.id = m.usuario_id
        WHERE m.pago = false;
      `);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao recuperar mensalidades não pagas.' });
    }
  });
  app.get('/mensalidades-usuario', async (req, res) => {
    const client = await pool.connect();
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
        WHERE m.usuario_id = '${req.session.ida}' AND m.pago = false;
      `);
  
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao recuperar mensalidades do usuário.' });
    }
  });

app.get('/server/current/user', (req, res) => {
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