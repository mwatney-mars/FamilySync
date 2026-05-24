import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDb, run, get, query, resetDb } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'FamilySyncSecretKey_SuperSecure123!';

app.use(cors());
app.use(express.json());

// Clientes SSE conectados agrupados por family_id
const sseClients = new Map(); // familyId -> Array<{ id, res }>

// Helper para gerar código de convite único de 6 dígitos
const generateJoinCode = () => {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
};

// Middleware para verificar JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticação ausente.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido ou expirado.' });
    }
    req.user = user;
    next();
  });
};

// --- ROTAS DE AUTENTICAÇÃO ---

// Registro
app.post('/api/auth/register', (req, res) => {
  res.status(403).json({ error: 'O registro público está desativado. Novos membros devem ser cadastrados manualmente pelo Administrador no painel de configurações da família.' });
});

// Check onboarding status (public endpoint)
app.get('/api/auth/onboarding-status', async (req, res) => {
  try {
    const adminUser = await get('SELECT id FROM users WHERE LOWER(username) = ?', ['admin']);
    res.json({ onboardingCompleted: !adminUser });
  } catch (err) {
    console.error('[Onboarding Status Error]', err);
    res.status(500).json({ error: 'Erro ao verificar status de onboarding.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password, email } = req.body;
  const loginIdentifier = username || email;

  if (!loginIdentifier || !password) {
    return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios.' });
  }

  try {
    const user = await get(
      'SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)',
      [loginIdentifier, loginIdentifier]
    );
    if (!user) {
      return res.status(400).json({ error: 'Nome de usuário ou senha incorretos.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Nome de usuário ou senha incorretos.' });
    }

    let familyDetails = null;
    if (user.family_id) {
      familyDetails = await get('SELECT * FROM families WHERE id = ?', [user.family_id]);
    }

    const token = jwt.sign({ userId: user.id, username: user.username, familyId: user.family_id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: { id: user.id, username: user.username, display_name: user.display_name, email: user.email, familyId: user.family_id, role: user.role, family_title: user.family_title, birth_date: user.birth_date, gender: user.gender },
      family: familyDetails
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
});

// Criar/Entrar em família após registro (se pulado inicialmente)
app.post('/api/auth/family', authenticateToken, async (req, res) => {
  const { familyName, joinCode } = req.body;
  const { userId } = req.user;

  try {
    let familyId = null;
    let familyDetails = null;

    if (familyName) {
      familyId = crypto.randomUUID();
      const code = generateJoinCode();
      const salt = crypto.randomBytes(16).toString('hex');

      await run(
        'INSERT INTO families (id, name, join_code, e2ee_salt, creator_id) VALUES (?, ?, ?, ?, ?)',
        [familyId, familyName, code, salt, userId]
      );
      familyDetails = { id: familyId, name: familyName, join_code: code, e2ee_salt: salt, creator_id: userId };
    } else if (joinCode) {
      const family = await get('SELECT * FROM families WHERE join_code = ?', [joinCode.toUpperCase()]);
      if (!family) {
        return res.status(400).json({ error: 'Código de família inválido.' });
      }
      familyId = family.id;
      familyDetails = family;
    } else {
      return res.status(400).json({ error: 'Nome da família ou código de convite é necessário.' });
    }

    await run('UPDATE users SET family_id = ? WHERE id = ?', [familyId, userId]);

    res.json({ family: familyDetails });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao configurar família.' });
  }
});


// --- ENDPOINTS DE GESTÃO DA FAMÍLIA (ADMIN ONLY OU LOGADO) ---

// Obter todos os membros da família logada
app.get('/api/family/members', authenticateToken, async (req, res) => {
  const { familyId } = req.user;
  if (!familyId) {
    return res.status(400).json({ error: 'Você não está associado a nenhuma família.' });
  }

  try {
    const members = await query(
      'SELECT id, username, display_name, email, role, family_title, birth_date, gender FROM users WHERE family_id = ?',
      [familyId]
    );
    res.json(members);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar membros da família.' });
  }
});

// Atualizar próprio perfil do usuário logado
app.put('/api/user/profile', authenticateToken, async (req, res) => {
  const { userId } = req.user;
  const { username, display_name, email, birth_date, gender, family_title, password } = req.body;

  try {
    // Buscar usuário atual para validar email
    const currentUser = await get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!currentUser) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Se mudou o e-mail, verificar unicidade
    if (email && email !== currentUser.email) {
      const emailCheck = await get('SELECT id FROM users WHERE email = ?', [email]);
      if (emailCheck) {
        return res.status(400).json({ error: 'Este e-mail já está em uso.' });
      }
    }

    // Se mudou o username, verificar unicidade
    if (username && username.toLowerCase() !== currentUser.username.toLowerCase()) {
      const usernameCheck = await get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [username]);
      if (usernameCheck) {
        return res.status(400).json({ error: 'Este nome de usuário já está em uso.' });
      }
    }

    let passwordHash = currentUser.password_hash;
    if (password && password.trim() !== '') {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const updatedUsername = username || currentUser.username;
    const updatedDisplayName = display_name !== undefined ? display_name : (currentUser.display_name || currentUser.username);
    const updatedEmail = email || currentUser.email;
    const updatedBirthDate = birth_date !== undefined ? birth_date : currentUser.birth_date;
    const updatedGender = gender !== undefined ? gender : currentUser.gender;
    const updatedFamilyTitle = family_title !== undefined ? family_title : currentUser.family_title;

    await run(
      'UPDATE users SET username = ?, display_name = ?, email = ?, password_hash = ?, birth_date = ?, gender = ?, family_title = ? WHERE id = ?',
      [updatedUsername, updatedDisplayName, updatedEmail, passwordHash, updatedBirthDate, updatedGender, updatedFamilyTitle, userId]
    );

    // Buscar dados atualizados
    const updatedUser = await get('SELECT id, username, display_name, email, family_id, role, family_title, birth_date, gender FROM users WHERE id = ?', [userId]);

    // SSE Broadcast para sincronizar a família (ex: se mudou nome ou título)
    broadcastSyncEvent(currentUser.family_id, null);

    const token = jwt.sign(
      { userId: updatedUser.id, username: updatedUser.username, familyId: updatedUser.family_id, role: updatedUser.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Perfil atualizado com sucesso!',
      user: updatedUser,
      token
    });
  } catch (err) {
    console.error('Erro ao atualizar perfil:', err);
    res.status(500).json({ error: 'Erro interno ao atualizar perfil.' });
  }
});

// Adicionar integrante à família manualmente (Admin only)
app.post('/api/family/members', authenticateToken, async (req, res) => {
  const { familyId, userId } = req.user;
  const { username, display_name, displayName, email, password, role, familyTitle, birthDate, gender } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Nome de usuário e senha provisória são obrigatórios.' });
  }

  const targetEmail = email || (username.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9._-]/g, '') + '@familysync.local');
  const targetDisplayName = display_name || displayName || username;

  try {
    // Verificar se quem está requisitando é admin da mesma família
    const requester = await get('SELECT role FROM users WHERE id = ?', [userId]);
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem adicionar membros à família.' });
    }

    if (!familyId) {
      return res.status(400).json({ error: 'Você não está associado a nenhuma família.' });
    }

    // Verificar se usuário com este username ou e-mail já existe
    const existingUser = await get(
      'SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)',
      [username, targetEmail]
    );
    if (existingUser) {
      return res.status(400).json({ error: 'Este nome de usuário ou e-mail já está em uso.' });
    }

    const newUserId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    const targetRole = role || 'user';
    const targetTitle = familyTitle || 'Membro';

    // Inserir usuário na família
    await run(
      'INSERT INTO users (id, username, display_name, email, password_hash, family_id, role, family_title, birth_date, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [newUserId, username, targetDisplayName, targetEmail, passwordHash, familyId, targetRole, targetTitle, birthDate || null, gender || null]
    );

    // Notificar os outros clientes para puxarem membros atualizados via SSE
    broadcastSyncEvent(familyId, null);

    res.status(201).json({
      message: 'Membro adicionado com sucesso!',
      user: { id: newUserId, username, display_name: targetDisplayName, email: targetEmail, familyId, role: targetRole, family_title: targetTitle, birth_date: birthDate || null, gender: gender || null }
    });
  } catch (err) {
    console.error('Erro ao adicionar membro manualmente:', err);
    res.status(500).json({ error: 'Erro interno ao adicionar membro.' });
  }
});

// Alterar título ou papel de um integrante da família (Admin only)
app.put('/api/family/members/:memberId', authenticateToken, async (req, res) => {
  const { familyId, userId } = req.user;
  const { memberId } = req.params;
  const { role, familyTitle } = req.body;

  try {
    // Verificar se quem está requisitando é admin da mesma família
    const requester = await get('SELECT role, family_id FROM users WHERE id = ?', [userId]);
    if (!requester || requester.family_id !== familyId || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem gerenciar usuários da família.' });
    }

    // Verificar se o membro a ser editado pertence à mesma família
    const targetMember = await get('SELECT role, family_id FROM users WHERE id = ?', [memberId]);
    if (!targetMember || targetMember.family_id !== familyId) {
      return res.status(400).json({ error: 'Usuário não pertence a esta família.' });
    }

    // Obter dados da família para verificar o criador
    const family = await get('SELECT creator_id FROM families WHERE id = ?', [familyId]);
    const creatorId = family ? family.creator_id : null;

    if (role) {
      if (memberId === creatorId && role !== 'admin') {
        return res.status(400).json({ error: 'O criador da família deve ser sempre um administrador.' });
      }

      if (role !== 'admin') {
        // Se estão tentando rebaixar este usuário, garantir que existirá pelo menos outro admin ativo na família
        const otherAdmins = await query(
          'SELECT id FROM users WHERE family_id = ? AND role = \'admin\' AND id != ?',
          [familyId, memberId]
        );
        if (otherAdmins.length === 0) {
          return res.status(400).json({ error: 'A família deve ter pelo menos um administrador ativo.' });
        }
      }

      await run('UPDATE users SET role = ? WHERE id = ?', [role, memberId]);
    }

    if (familyTitle) {
      await run('UPDATE users SET family_title = ? WHERE id = ?', [familyTitle, memberId]);
    }

    // Notificar os outros clientes para puxarem membros atualizados via SSE
    broadcastSyncEvent(familyId, null);

    res.json({ message: 'Membro atualizado com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar dados do membro.' });
  }
});

// Excluir membro da família (Admin only)
app.delete('/api/family/members/:memberId', authenticateToken, async (req, res) => {
  const { familyId, userId } = req.user;
  const { memberId } = req.params;

  try {
    // Verificar se quem está requisitando é admin da mesma família
    const requester = await get('SELECT role, family_id FROM users WHERE id = ?', [userId]);
    if (!requester || requester.family_id !== familyId || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem gerenciar usuários da família.' });
    }

    if (userId === memberId) {
      return res.status(400).json({ error: 'Você não pode se remover da própria família.' });
    }

    // Obter dados da família para verificar o criador
    const family = await get('SELECT creator_id FROM families WHERE id = ?', [familyId]);
    const creatorId = family ? family.creator_id : null;

    if (memberId === creatorId) {
      return res.status(400).json({ error: 'O criador da família não pode ser removido da família.' });
    }

    const targetMember = await get('SELECT username, role, family_id FROM users WHERE id = ?', [memberId]);
    if (!targetMember || targetMember.family_id !== familyId) {
      return res.status(400).json({ error: 'Membro não encontrado ou não pertence a esta família.' });
    }

    if (targetMember.role === 'admin') {
      // Garantir que restará outro admin ativo na família
      const otherAdmins = await query(
        'SELECT id FROM users WHERE family_id = ? AND role = \'admin\' AND id != ?',
        [familyId, memberId]
      );
      if (otherAdmins.length === 0) {
        return res.status(400).json({ error: 'Não é possível remover o único administrador da família.' });
      }
    }

    const targetUsername = targetMember.username;
    console.log(`[Evict Member] Removendo membro "${targetUsername}" (${memberId}) e limpando tarefas órfãs...`);

    // Limpar tarefas órfãs: reatribuir tarefas pendentes deste usuário para público ('all')
    const chores = await query(
      "SELECT id, encrypted_data FROM sync_items WHERE family_id = ? AND collection = 'chores' AND deleted = 0",
      [familyId]
    );

    const now = Date.now();
    let updatedCount = 0;

    for (const c of chores) {
      try {
        const choreData = JSON.parse(c.encrypted_data);
        let modified = false;

        if (choreData.assigned_to === targetUsername) {
          choreData.assigned_to = 'all';
          choreData.updated_at = now;
          modified = true;
        }

        if (choreData.co_responsible === targetUsername) {
          choreData.co_responsible = 'none';
          choreData.updated_at = now;
          modified = true;
        }

        if (modified) {
          await run(
            "UPDATE sync_items SET encrypted_data = ?, updated_at = ? WHERE id = ? AND family_id = ?",
            [JSON.stringify(choreData), now, c.id, familyId]
          );
          updatedCount++;
        }
      } catch (err) {
        console.error('Erro ao processar e-mail de tarefa no evict de membro:', err);
      }
    }

    console.log(`[Evict Member] Reatribuídas ${updatedCount} tarefas pendentes.`);

    // Remover da família (desassociar)
    await run('UPDATE users SET family_id = NULL, role = \'user\' WHERE id = ?', [memberId]);

    // SSE Broadcast para sincronizar a família (Membros e Tarefas)
    broadcastSyncEvent(familyId, null);

    res.json({ message: 'Membro removido da família e tarefas órfãs limpas com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover membro.' });
  }
});

// Redefinir senha de um integrante da família (Admin only)
app.put('/api/family/members/:memberId/reset-password', authenticateToken, async (req, res) => {
  const { familyId, userId } = req.user;
  const { memberId } = req.params;
  const { password } = req.body;

  if (!password || !password.trim()) {
    return res.status(400).json({ error: 'A nova senha não pode ser vazia.' });
  }

  try {
    // Verificar se quem está requisitando é admin da mesma família
    const requester = await get('SELECT role, family_id FROM users WHERE id = ?', [userId]);
    if (!requester || requester.family_id !== familyId || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem redefinir senhas.' });
    }

    // Verificar se o membro a ser editado pertence à mesma família
    const targetMember = await get('SELECT family_id FROM users WHERE id = ?', [memberId]);
    if (!targetMember || targetMember.family_id !== familyId) {
      return res.status(400).json({ error: 'Usuário não pertence a esta família.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, memberId]);

    res.json({ message: 'Senha redefinida com sucesso!' });
  } catch (err) {
    console.error('Erro ao redefinir senha do membro:', err);
    res.status(500).json({ error: 'Erro ao redefinir senha do membro.' });
  }
});

// Exportar backup completo da família (Admin only)
app.get('/api/family/backup/export', authenticateToken, async (req, res) => {
  const { familyId, userId } = req.user;

  try {
    // Verificar se quem está requisitando é admin
    const requester = await get('SELECT role FROM users WHERE id = ?', [userId]);
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem exportar backup.' });
    }

    if (!familyId) {
      return res.status(400).json({ error: 'Você não está associado a nenhuma família.' });
    }

    const family = await get('SELECT * FROM families WHERE id = ?', [familyId]);
    const members = await query(
      'SELECT id, username, display_name, email, password_hash, role, family_title, birth_date, gender FROM users WHERE family_id = ?',
      [familyId]
    );
    const syncItems = await query(
      'SELECT id, collection, encrypted_data, updated_at, deleted FROM sync_items WHERE family_id = ?',
      [familyId]
    );

    const backupPayload = {
      version: 1,
      exported_at: Date.now(),
      family,
      members,
      sync_items: syncItems
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=familysync_backup_${family.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.json`);
    res.json(backupPayload);
  } catch (err) {
    console.error('Erro ao exportar backup:', err);
    res.status(500).json({ error: 'Erro ao gerar backup.' });
  }
});

// Importar backup da família (Admin only)
app.post('/api/family/backup/import', authenticateToken, async (req, res) => {
  const { familyId, userId } = req.user;
  const backupData = req.body;

  if (!backupData || !backupData.family || !Array.isArray(backupData.members) || !Array.isArray(backupData.sync_items)) {
    return res.status(400).json({ error: 'Formato de arquivo de backup inválido. Certifique-se de carregar um arquivo JSON de backup válido.' });
  }

  try {
    // Verificar se quem está requisitando é admin
    const requester = await get('SELECT role FROM users WHERE id = ?', [userId]);
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem importar backups.' });
    }

    if (!familyId) {
      return res.status(400).json({ error: 'Você não está associado a nenhuma família.' });
    }

    const backupFamilyId = backupData.family.id;
    if (backupFamilyId !== familyId) {
      return res.status(400).json({ error: 'Este backup pertence a outra família e não pode ser restaurado nesta conta.' });
    }

    console.log(`[Backup Import] Iniciando restauração para família: ${familyId}`);

    // Executar operações transacionais manuais
    // 1. Atualizar informações da família
    await run(
      'UPDATE families SET name = ?, join_code = ?, e2ee_salt = ?, creator_id = ? WHERE id = ?',
      [backupData.family.name, backupData.family.join_code, backupData.family.e2ee_salt, backupData.family.creator_id, familyId]
    );

    // 2. Coletar IDs do backup para evitar deletar todos os usuários caso queira deletar órfãos da restauração
    const backupMemberIds = backupData.members.map(m => m.id);

    // Remover membros locais que não fazem parte do backup (exceto o próprio admin atual para garantir)
    if (backupMemberIds.length > 0) {
      const placeholders = backupMemberIds.map(() => '?').join(',');
      await run(
        `DELETE FROM users WHERE family_id = ? AND id NOT IN (${placeholders}) AND id != ?`,
        [familyId, ...backupMemberIds, userId]
      );
    }

    // 3. Restaurar membros
    for (const m of backupData.members) {
      // Inserir ou atualizar membro
      await run(
        `INSERT OR REPLACE INTO users (id, username, display_name, email, password_hash, family_id, role, family_title, birth_date, gender)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [m.id, m.username, m.display_name, m.email, m.password_hash, familyId, m.role, m.family_title, m.birth_date || null, m.gender || null]
      );
    }

    // 4. Limpar e restaurar sync_items da família
    await run('DELETE FROM sync_items WHERE family_id = ?', [familyId]);
    for (const item of backupData.sync_items) {
      await run(
        'INSERT INTO sync_items (id, family_id, collection, encrypted_data, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?)',
        [item.id, familyId, item.collection, item.encrypted_data, item.updated_at, item.deleted || 0]
      );
    }

    // 5. Broadcast SSE sync para forçar atualização em todos os clientes
    broadcastSyncEvent(familyId, null);

    console.log(`[Backup Import] Restauração concluída com sucesso para família: ${familyId}`);
    res.json({ message: 'Backup restaurado com sucesso! Todos os dados e membros foram restabelecidos.' });
  } catch (err) {
    console.error('Erro ao restaurar backup:', err);
    res.status(500).json({ error: 'Erro interno ao processar e restaurar o backup.' });
  }
});

// Resetar e zerar todo o banco de dados do servidor (Admin only)
app.post('/api/family/reset-database', authenticateToken, async (req, res) => {
  const { userId } = req.user;

  try {
    // Verificar se quem está requisitando é admin
    const requester = await get('SELECT role FROM users WHERE id = ?', [userId]);
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem resetar o banco de dados.' });
    }

    console.log(`[Database Reset] O administrador ${userId} solicitou o reset completo do banco de dados SQLite...`);
    
    // Disparar o resetDb
    await resetDb();

    // Desconectar todos os clientes SSE conectados de todas as famílias
    for (const [fId, clients] of sseClients.entries()) {
      for (const client of clients) {
        try {
          client.res.write('event: reset\ndata: Database reset by admin\n\n');
          client.res.end();
        } catch (e) {}
      }
    }
    sseClients.clear();

    res.json({ message: 'Banco de dados restaurado ao estado original de fábrica com sucesso! O login padrão é admin/admin.' });
  } catch (err) {
    console.error('Erro ao resetar o banco de dados:', err);
    res.status(500).json({ error: 'Erro interno ao resetar o banco de dados.' });
  }
});

// Enviar uma notificação reativa para toda a família (Authenticated)
app.post('/api/family/notify', authenticateToken, async (req, res) => {
  const { familyId } = req.user;
  const { message, clientId } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Mensagem de notificação vazia.' });
  }

  if (!familyId) {
    return res.status(400).json({ error: 'Você não pertence a uma família.' });
  }

  try {
    broadcastNotificationEvent(familyId, message, clientId || null);
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao transmitir notificação:', err);
    res.status(500).json({ error: 'Erro ao transmitir notificação.' });
  }
});

// Atualizar nome da família (Admin only)
app.put('/api/family/settings', authenticateToken, async (req, res) => {
  const { familyId, userId } = req.user;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'O nome da família não pode ser vazio.' });
  }

  try {
    // Verificar se é admin
    const requester = await get('SELECT role FROM users WHERE id = ?', [userId]);
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem alterar configurações da família.' });
    }

    await run('UPDATE families SET name = ? WHERE id = ?', [name, familyId]);

    // SSE Broadcast
    broadcastSyncEvent(familyId, null);

    res.json({ message: 'Nome da família atualizado com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar nome da família.' });
  }
});

// Zerar pontuações de todos os membros da família (Admin only)
app.post('/api/family/reset-points', authenticateToken, async (req, res) => {
  const { familyId, userId } = req.user;

  try {
    // Verificar se é admin
    const requester = await get('SELECT role FROM users WHERE id = ?', [userId]);
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem redefinir os pontos.' });
    }

    const now = Date.now();

    // Marcar todos os sync_items da coleção 'points' desta família como deletados (deleted = 1)
    // E atualizar updated_at para agora. Assim todos os clientes sincronizarão e apagarão localmente!
    await run(
      'UPDATE sync_items SET deleted = 1, updated_at = ? WHERE family_id = ? AND collection = \'points\'',
      [now, familyId]
    );

    // SSE Broadcast para sincronização imediata nos aparelhos conectados!
    broadcastSyncEvent(familyId, null);

    res.json({ message: 'Pontuações familiares redefinidas com sucesso! Sincronizando com os dispositivos.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao zerar as pontuações familiares.' });
  }
});


// --- MECANISMO DE SINCRONIZAÇÃO OFFLINE-FIRST ---

app.post('/api/sync', authenticateToken, async (req, res) => {
  const { familyId } = req.user;
  const { lastSyncTime, items = [], clientId } = req.body;

  if (!familyId) {
    return res.status(400).json({ error: 'Este usuário não pertence a nenhuma família registrada.' });
  }

  try {
    let updatedCount = 0;

    // Processar itens recebidos do cliente
    for (const item of items) {
      const { id, collection, encrypted_data, updated_at, deleted = 0 } = item;

      // Verificar se o item já existe no servidor
      const existing = await get(
        'SELECT updated_at FROM sync_items WHERE id = ? AND family_id = ?',
        [id, familyId]
      );

      if (!existing) {
        // Novo item
        await run(
          'INSERT INTO sync_items (id, family_id, collection, encrypted_data, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?)',
          [id, familyId, collection, encrypted_data, updated_at, deleted]
        );
        updatedCount++;
      } else if (updated_at > existing.updated_at) {
        // Item existente modificado mais recentemente pelo cliente (LWW - Last Write Wins)
        await run(
          'UPDATE sync_items SET collection = ?, encrypted_data = ?, updated_at = ?, deleted = ? WHERE id = ? AND family_id = ?',
          [collection, encrypted_data, updated_at, deleted, id, familyId]
        );
        updatedCount++;
      }
    }

    // Buscar atualizações do servidor desde a última sincronização do cliente
    const serverUpdates = await query(
      'SELECT id, collection, encrypted_data, updated_at, deleted FROM sync_items WHERE family_id = ? AND updated_at > ?',
      [familyId, lastSyncTime || 0]
    );

    const serverTime = Date.now();

    // Se houve alterações salvas, notificar os outros clientes conectados da família por SSE
    if (updatedCount > 0) {
      broadcastSyncEvent(familyId, clientId);
    }

    res.json({
      serverTime,
      items: serverUpdates
    });
  } catch (err) {
    console.error('Erro na sincronização:', err);
    res.status(500).json({ error: 'Falha ao sincronizar dados.' });
  }
});


// --- REAL-TIME SERVER-SENT EVENTS (SSE) ---

app.get('/api/sync/stream', (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Token ausente para stream.' });
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    const { familyId, userId } = user;

    if (!familyId) {
      return res.status(400).json({ error: 'Não associado a uma família.' });
    }

    // Configurar cabeçalhos SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Content-Encoding': 'none'
    });

    res.write('retry: 10000\n\n');

    const clientId = crypto.randomUUID();
    const clientRecord = { id: clientId, res };

    if (!sseClients.has(familyId)) {
      sseClients.set(familyId, []);
    }
    sseClients.get(familyId).push(clientRecord);

    console.log(`Cliente SSE conectado: Usuário ${userId}, Família ${familyId}, Conexão ID ${clientId}`);

    // Ping para manter conexão ativa
    const pingInterval = setInterval(() => {
      res.write(': ping\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(pingInterval);
      const clients = sseClients.get(familyId) || [];
      const index = clients.findIndex(c => c.id === clientId);
      if (index !== -1) {
        clients.splice(index, 1);
      }
      if (clients.length === 0) {
        sseClients.delete(familyId);
      }
      console.log(`Cliente SSE desconectado: ${clientId}`);
    });

  } catch (err) {
    console.error('SSE Erro de autenticação:', err);
    res.status(403).json({ error: 'Token inválido ou expirado para conexão em tempo real.' });
  }
});

// Broadcast para a família avisando que dados mudaram e estimulando um "sync"
function broadcastSyncEvent(familyId, excludeClientId) {
  const clients = sseClients.get(familyId) || [];
  clients.forEach(client => {
    if (client.id !== excludeClientId) {
      try {
        client.res.write('event: sync\ndata: trigger\n\n');
      } catch (err) {
        console.error('Erro ao enviar mensagem SSE para cliente:', client.id, err);
      }
    }
  });
}

// Broadcast de notificações customizadas para a família via SSE
function broadcastNotificationEvent(familyId, message, excludeClientId) {
  const clients = sseClients.get(familyId) || [];
  clients.forEach(client => {
    if (client.id !== excludeClientId) {
      try {
        client.res.write(`event: notification\ndata: ${JSON.stringify({ message, id: crypto.randomUUID(), timestamp: Date.now() })}\n\n`);
      } catch (err) {
        console.error('Erro ao enviar notificação SSE para cliente:', client.id, err);
      }
    }
  });
}



// Servir os arquivos estáticos compilados do React frontend em produção
app.use(express.static(join(__dirname, '../frontend/dist')));

// Fallback para index.html do React (essencial para roteamento SPA no cliente)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(join(__dirname, '../frontend/dist/index.html'), (err) => {
    if (err) {
      // Se o dist não estiver compilado ainda, retornar mensagem informativa
      res.status(200).send('<h1>FamilySync Backend Ativo</h1><p>O servidor está rodando perfeitamente. O frontend ainda não foi compilado ou colocado em "../frontend/dist".</p>');
    }
  });
});

// --- INICIALIZAÇÃO ---

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize Database:', err);
});
