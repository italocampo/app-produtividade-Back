const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(cors());

// 1. Rota para pegar metas de um dia específico (ex: 2026-01-20)
// Se não mandar data, pega as de hoje.
app.get('/metas', async (req, res) => {
  const { data } = req.query; 
  
  // Define o início e fim do dia para filtrar
  const targetDate = data ? new Date(data) : new Date();
  const startOfDay = new Date(targetDate.setHours(0,0,0,0));
  const endOfDay = new Date(targetDate.setHours(23,59,59,999));

  const metas = await prisma.meta.findMany({
    where: {
      data: {
        gte: startOfDay,
        lte: endOfDay
      }
    },
    orderBy: { id: 'asc' }
  });
  
  res.json(metas);
});

// 2. Criar Meta
app.post('/metas', async (req, res) => {
  const { titulo, categoria, data } = req.body;
  
  // Se vier data do front, usa ela, senão usa agora
  const dataMeta = data ? new Date(data) : new Date();

  const novaMeta = await prisma.meta.create({
    data: {
      titulo,
      categoria,
      data: dataMeta,
      concluida: false
    }
  });
  
  res.json(novaMeta);
});

// 3. Marcar/Desmarcar (Toggle)
app.patch('/metas/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const { concluida } = req.body; // O front manda o novo estado

  const metaAtualizada = await prisma.meta.update({
    where: { id: Number(id) },
    data: { concluida }
  });

  res.json(metaAtualizada);
});

// 4. Deletar Meta
app.delete('/metas/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.meta.delete({ where: { id: Number(id) } });
  res.json({ message: 'Deletado' });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🔥 API rodando na porta ${PORT}`);
});