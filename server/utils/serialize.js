const db = require('../db');

function parseFavorites(raw){
  try{
    const list = JSON.parse(raw || '[]');
    return Array.isArray(list) ? list.slice(0, 4) : [];
  }catch(e){
    return [];
  }
}

function parseGenres(raw){
  try{
    const list = JSON.parse(raw || '[]');
    return Array.isArray(list) ? list : [];
  }catch(e){
    return [];
  }
}

// a foto de perfil fica no banco em base64, mas não vai mais dentro de toda
// resposta JSON (uma lista de 50 pessoas chegava a vários MB). O cliente
// recebe uma URL curta e o navegador guarda a imagem em cache; o ?v= muda
// quando a foto é trocada.
function avatarUrl(row){
  if(!row || !row.avatar) return null;
  return `/api/users/${encodeURIComponent(row.username)}/avatar?v=${row.avatar_v || 0}`;
}

function commentPhotoUrl(row){
  if(!row || !row.photo) return null;
  return `/api/diary/comments/${row.id}/photo`;
}

// versão "privada" — só pra retornar pro próprio dono da conta
// (inclui e-mail e as listas completas de quem segue/é seguido)
function serializeUser(row){
  if(!row) return null;
  const followers = db.prepare(
    'SELECT u.username FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.followee_id = ?'
  ).all(row.id).map(r => r.username);
  const following = db.prepare(
    'SELECT u.username FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = ?'
  ).all(row.id).map(r => r.username);

  return {
    username: row.username,
    email: row.email,
    emailVerified: !!row.email_verified,
    nationality: row.nationality,
    genres: parseGenres(row.genres),
    bio: row.bio || '',
    favorites: parseFavorites(row.favorites),
    avatar: avatarUrl(row),
    followers,
    following,
    spotifyConnected: !!db.prepare('SELECT 1 FROM spotify_tokens WHERE user_id = ?').get(row.id),
    createdAt: row.created_at ? row.created_at.replace(' ', 'T') + 'Z' : null,
  };
}

// colunas pra montar o perfil público já com as contagens, numa consulta só
// (antes eram 2 consultas extras por pessoa — 100 numa lista de 50)
const PUBLIC_COLUMNS = `
  u.id, u.username, u.nationality, u.genres, u.bio, u.favorites, u.avatar_v,
  (u.avatar IS NOT NULL) AS has_avatar,
  (SELECT COUNT(*) FROM follows WHERE followee_id = u.id) AS follower_count,
  (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) AS following_count,
  (SELECT COUNT(*) FROM diary_entries WHERE user_id = u.id) AS entry_count
`;

// versão "pública" — pra mostrar o perfil de qualquer pessoa (sem e-mail,
// só contagens de seguidores/seguindo em vez das listas inteiras). Aceita
// tanto uma linha completa de users quanto uma linha vinda de PUBLIC_COLUMNS.
function serializePublicUser(row){
  if(!row) return null;
  if(row.follower_count === undefined){
    row = db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users u WHERE u.id = ?`).get(row.id);
    if(!row) return null;
  }
  return {
    username: row.username,
    avatar: row.has_avatar ? avatarUrl({ username: row.username, avatar: true, avatar_v: row.avatar_v }) : null,
    nationality: row.nationality,
    genres: parseGenres(row.genres),
    bio: row.bio || '',
    favorites: parseFavorites(row.favorites),
    followerCount: row.follower_count,
    followingCount: row.following_count,
    entryCount: row.entry_count,
  };
}

// busca pelo nome de usuário sem diferenciar maiúsculas/minúsculas — o
// cadastro já impede "Ana" e "ana" ao mesmo tempo, então o perfil, o seguir
// e as mensagens precisam achar a pessoa do mesmo jeito
function findUserByUsername(username){
  return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(String(username));
}

module.exports = {
  serializeUser,
  serializePublicUser,
  parseGenres,
  findUserByUsername,
  avatarUrl,
  commentPhotoUrl,
  PUBLIC_COLUMNS,
};
