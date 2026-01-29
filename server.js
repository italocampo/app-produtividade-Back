const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(cors());

// --- ROTA MESTRA (Carrega tudo de uma vez) ---
// O Frontend chama isso ao iniciar. Retorna rotina, plano e status de hoje.
app.get('/init', async (req, res) => {
  try {
    const { data } = req.query; // Espera formato YYYY-MM-DD
    const dataAlvo = data ? new Date(data) : new Date();
    
    // 1. Busca todos os hábitos
    const habitos = await prisma.habito.findMany({ orderBy: { createdAt: 'asc' } });
    
    // 2. Busca o planejamento completo
    const planosDB = await prisma.plano.findMany();
    // Transforma array do banco no objeto { seg: [], ter: [] } que o front usa
    const planoSemanal = { seg: [], ter: [], qua: [], qui: [], sex: [], sab: [], dom: [] };
    planosDB.forEach(p => {
      if (planoSemanal[p.diaSemana]) {
        planoSemanal[p.diaSemana].push(p.habitoId);
      }
    });

    // 3. Busca o que foi concluído na data solicitada
    const execucoes = await prisma.execucao.findMany({
      where: { data: dataAlvo },
      select: { habitoId: true } // Só precisamos dos IDs
    });
    const concluidasHoje = execucoes.map(e => e.habitoId);

    res.json({ rotinaBase: habitos, planoSemanal, concluidasHoje });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar dados iniciais' });
  }
});

// --- 1. GERENCIAR HÁBITOS ---
app.post('/habitos', async (req, res) => {
  const { nome, categoria } = req.body;
  const novo = await prisma.habito.create({
    data: { nome, categoria }
  });
  res.json(novo);
});

app.delete('/habitos/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.habito.delete({ where: { id } });
  res.json({ success: true });
});

// --- 2. GERENCIAR PLANEJAMENTO ---
// Adiciona ou remove um hábito de um dia específico (Toggle)
app.post('/plano/toggle', async (req, res) => {
  const { habitoId, diaSemana } = req.body;

  // Verifica se já existe
  const existente = await prisma.plano.findUnique({
    where: {
      diaSemana_habitoId: { diaSemana, habitoId }
    }
  });

  if (existente) {
    // Se existe, remove (desmarca do planejamento)
    await prisma.plano.delete({ where: { id: existente.id } });
    res.json({ acao: 'removido' });
  } else {
    // Se não existe, cria
    await prisma.plano.create({ data: { diaSemana, habitoId } });
    res.json({ acao: 'adicionado' });
  }
});

// Copiar Segunda para todos os dias
app.post('/plano/replicar', async (req, res) => {
  // Primeiro, limpa tudo de Terça a Domingo
  const diasParaLimpar = ['ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  await prisma.plano.deleteMany({ where: { diaSemana: { in: diasParaLimpar } } });

  // Pega o modelo de Segunda
  const modeloSegunda = await prisma.plano.findMany({ where: { diaSemana: 'seg' } });

  // Cria cópias
  const novasEntradas = [];
  diasParaLimpar.forEach(dia => {
    modeloSegunda.forEach(item => {
      novasEntradas.push({ diaSemana: dia, habitoId: item.habitoId });
    });
  });

  if (novasEntradas.length > 0) {
    await prisma.plano.createMany({ data: novasEntradas });
  }
  
  res.json({ success: true });
});

// --- 3. GERENCIAR EXECUÇÃO (CHECKLIST) ---
// Marca ou Desmarca como feito no dia
app.post('/execucao/toggle', async (req, res) => {
  const { habitoId, data } = req.body; // data deve ser ISO string YYYY-MM-DD
  const dataAlvo = new Date(data);

  const existente = await prisma.execucao.findUnique({
    where: {
      data_habitoId: { data: dataAlvo, habitoId }
    }
  });

  if (existente) {
    await prisma.execucao.delete({ where: { id: existente.id } });
    res.json({ status: false }); // Não feito
  } else {
    await prisma.execucao.create({ data: { data: dataAlvo, habitoId } });
    res.json({ status: true }); // Feito
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API V3 rodando na porta ${PORT}`);
});