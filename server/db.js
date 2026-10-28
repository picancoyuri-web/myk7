const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'cassete.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nationality TEXT,
  genres TEXT NOT NULL DEFAULT '[]',
  avatar TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (follower_id, followee_id)
);

CREATE TABLE IF NOT EXISTS diary_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_type TEXT,
  item_title TEXT,
  item_artist TEXT,
  item_genre TEXT,
  item_year TEXT,
  item_sp TEXT,
  item_preview_url TEXT,
  rating INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS diary_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT,
  photo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id INTEGER NOT NULL REFERENCES diary_comments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS entry_reactions (
  entry_id INTEGER NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (entry_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'follow' | 'comment' | 'like' | 'reaction' | 'memory'
  entry_id INTEGER REFERENCES diary_entries(id) ON DELETE CASCADE,
  comment_id INTEGER REFERENCES diary_comments(id) ON DELETE CASCADE,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_diary_user ON diary_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_diary_created ON diary_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(from_id, to_id);
CREATE INDEX IF NOT EXISTS idx_comments_entry ON diary_comments(entry_id);
CREATE INDEX IF NOT EXISTS idx_reactions_entry ON entry_reactions(entry_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);
`);

// migração leve: se o banco já existia antes dessa coluna existir,
// adiciona ela sem apagar nada (CREATE TABLE IF NOT EXISTS não altera
// tabelas que já existem, então isso cobre quem já tinha o banco criado)
const userColumns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
if(!userColumns.includes('email_verified')){
  db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0');
}
// muda toda vez que a senha é trocada — derruba sessões antigas (ex: de
// quem descobriu a senha antiga) sem precisar guardar lista de tokens
if(!userColumns.includes('session_version')){
  db.exec('ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0');
}

// versão da foto de perfil — entra na URL da foto (?v=) pra o navegador
// poder guardar a imagem em cache e mesmo assim pegar a nova quando ela muda
// biografia curta do perfil
if(!userColumns.includes('bio')){
  db.exec('ALTER TABLE users ADD COLUMN bio TEXT');
}

// os 4 discos favoritos do perfil (JSON com o resumo de cada um)
if(!userColumns.includes('favorites')){
  db.exec("ALTER TABLE users ADD COLUMN favorites TEXT NOT NULL DEFAULT '[]'");
}

if(!userColumns.includes('avatar_v')){
  db.exec('ALTER TABLE users ADD COLUMN avatar_v INTEGER NOT NULL DEFAULT 0');
}

// quando a pessoa aceitou os Termos de Uso e a Política de Privacidade
// (exigido pela App Store e pela Play Store pra apps com conteúdo de usuários)
if(!userColumns.includes('terms_accepted_at')){
  db.exec('ALTER TABLE users ADD COLUMN terms_accepted_at TEXT');
}

// assinatura MyK7+: até quando vale (ISO), 'lifetime' pra sem prazo, ou null
if(!userColumns.includes('premium_until')){
  db.exec('ALTER TABLE users ADD COLUMN premium_until TEXT');
}

// mensagens lidas/não lidas (as que já existiam contam como lidas)
const messageColumns = db.prepare("PRAGMA table_info(messages)").all().map(c => c.name);
if(!messageColumns.includes('read_at')){
  db.exec('ALTER TABLE messages ADD COLUMN read_at TEXT');
  db.exec("UPDATE messages SET read_at = datetime('now')");
}

// índices que faltavam pras consultas mais comuns (seguidores, notificações
// não lidas, mensagens recebidas)
db.exec(`
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);
CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_id, from_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_users_username_nocase ON users(username COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_users_email_nocase ON users(email COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(to_id, read_at);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
`);

// bloqueios, denúncias e a conexão com o Spotify
db.exec(`
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS listen_later (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_type TEXT,
  item_title TEXT,
  item_artist TEXT,
  item_genre TEXT,
  item_year TEXT,
  item_preview_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS spotify_tokens (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL -- em ms (Date.now())
);
`);

// MOMENTOS: foto + a música que estava tocando naquela hora. A foto fica em
// base64 como as outras e sai por URL com cache (/api/posts/:id/photo).
db.exec(`
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo TEXT NOT NULL,
  photo_w INTEGER,
  photo_h INTEGER,
  caption TEXT,
  item_id TEXT NOT NULL,
  item_type TEXT,
  item_title TEXT NOT NULL,
  item_artist TEXT,
  item_genre TEXT,
  item_year TEXT,
  item_preview_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id, id);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id, id);
`);

// notificação de curtida/comentário num momento aponta pro post
const notificationColumns = db.prepare("PRAGMA table_info(notifications)").all().map(c => c.name);
if(!notificationColumns.includes('post_id')){
  db.exec('ALTER TABLE notifications ADD COLUMN post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE');
}

module.exports = db;
