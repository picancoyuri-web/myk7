// dados fixos do app: catálogo inicial, estilos, países, paradas por país
// e a "comunidade Cassete" (resenhas de exemplo que só existem no app).

export const catalog = [
  {id:1, title:"Kind of Blue", artist:"Miles Davis", year:1959, genre:"Jazz", sp:{t:'album', id:'71OqzcxcG9UNyRAjrMO8A5'}},
  {id:2, title:"To Pimp a Butterfly", artist:"Kendrick Lamar", year:2015, genre:"Hip-Hop", sp:{t:'album', id:'6w7lqIsvDPgTChMrPw5oIL'}},
  {id:3, title:"Rumours", artist:"Fleetwood Mac", year:1977, genre:"Rock", sp:{t:'album', id:'1bt6q2SruMsBtcerNVtpZB'}},
  {id:4, title:"Discovery", artist:"Daft Punk", year:2001, genre:"Eletrônica", sp:{t:'album', id:'2noRn2Aes5aoNVsU6iWThc'}},
  {id:5, title:"What's Going On", artist:"Marvin Gaye", year:1971, genre:"Soul", sp:{t:'album', id:'6qX4eoPWGteMdJMqGOwPTs'}},
  {id:6, title:"Unknown Pleasures", artist:"Joy Division", year:1979, genre:"Post-Punk", sp:{t:'album', id:'0cbpcdI4UySacPh5RCpDfo'}},
  {id:7, title:"Getz/Gilberto", artist:"Stan Getz & João Gilberto", year:1964, genre:"Bossa Nova", sp:{t:'album', id:'3CBq7jQimIxKIOmPxIVb9v'}},
  {id:8, title:"Music for Airports", artist:"Brian Eno", year:1978, genre:"Ambiente", sp:{t:'album', id:'063f8Ej8rLVTz9KkjQKEMa'}},
  {id:9, title:"Innervisions", artist:"Stevie Wonder", year:1973, genre:"Funk/Soul", sp:{t:'album', id:'5jgI8Eminx9MmLBontDWq8'}},
  {id:10, title:"Blonde", artist:"Frank Ocean", year:2016, genre:"R&B", sp:{t:'album', id:'3mH6qwIy9crq0I9YQbOuDf'}},
  {id:11, title:"Blue", artist:"Joni Mitchell", year:1971, genre:"Folk", sp:{t:'album', id:'1vz94WpXDVYIEGja8cjFNa'}},
  {id:12, title:"Zombie", artist:"Fela Kuti", year:1976, genre:"Afrobeat", sp:{t:'album', id:'4CGGf13zt9Jva2ia4CKQi6'}},

  /* ---- ATUALIZAÇÃO: catálogo ampliado com clássicos e marcos de vários gêneros ---- */
  {id:13, title:"Thriller", artist:"Michael Jackson", year:1982, genre:"Pop", sp:{t:'album', id:'2ANVost0y2y52ema1E9xAZ'}},
  {id:14, title:"Back in Black", artist:"AC/DC", year:1980, genre:"Rock", sp:{t:'album', id:'2u8KsPfXAX8viv2KkOEWbZ'}},
  {id:15, title:"The Dark Side of the Moon", artist:"Pink Floyd", year:1973, genre:"Rock", sp:{t:'album', id:'4LH4d3cOWNNsVw41Gqt2kv'}},
  {id:16, title:"Abbey Road", artist:"The Beatles", year:1969, genre:"Rock", sp:{t:'album', id:'0ETFjACtuP2ADo6LFhL6HN'}},
  {id:17, title:"Nevermind", artist:"Nirvana", year:1991, genre:"Rock", sp:{t:'album', id:'2tqNAmW9Q61osYJM7xdutO'}},
  {id:18, title:"good kid, m.A.A.d city", artist:"Kendrick Lamar", year:2012, genre:"Hip-Hop", sp:{t:'album', id:'21EBAOQBAPvE7bMsz6sGV7'}},
  {id:19, title:"The Miseducation of Lauryn Hill", artist:"Ms. Lauryn Hill", year:1998, genre:"R&B", sp:{t:'album', id:'1BZoqf8Zje5nGdwZhOjAtD'}},
  {id:20, title:"Songs in the Key of Life", artist:"Stevie Wonder", year:1976, genre:"Soul", sp:{t:'album', id:'6YUCc2RiXcEKS9ibuZxjt0'}},
  {id:21, title:"Random Access Memories", artist:"Daft Punk", year:2013, genre:"Eletrônica", sp:{t:'album', id:'4m2880jivSbbyEGAKfITCa'}},
  {id:22, title:"Master of Puppets", artist:"Metallica", year:1986, genre:"Metal", sp:{t:'album', id:'2Lq2qX3hYhiuPckC8Flj21'}},
  {id:23, title:"1989", artist:"Taylor Swift", year:2014, genre:"Pop", sp:{t:'album', id:'64LU4c1nfjz1t4VnGhagcg'}},
  {id:24, title:"DAMN.", artist:"Kendrick Lamar", year:2017, genre:"Hip-Hop", sp:{t:'album', id:'2ZsOtrjbcxMhcOcyDzNt1V'}},
];
catalog.forEach(a => a.type = 'album');

export const singles = [
  {id:101, title:"Bohemian Rhapsody", artist:"Queen", year:1975, genre:"Rock", type:'single', sp:{t:'track', id:'7tFiyTwD0nx5a1eklYtX2J'}},
  {id:102, title:"Superstition", artist:"Stevie Wonder", year:1972, genre:"Funk", type:'single', sp:{t:'track', id:'4N0TP4Rmj6QQezWV88ARNJ'}},
  {id:103, title:"Billie Jean", artist:"Michael Jackson", year:1983, genre:"Pop", type:'single', sp:{t:'track', id:'5ChkMS8OtdzJeqyybCc9R5'}},
  {id:104, title:"Alright", artist:"Kendrick Lamar", year:2015, genre:"Hip-Hop", type:'single', sp:{t:'track', id:'33i0KOPBWURNW3l97a4QPy'}},
  {id:105, title:"Dreams", artist:"Fleetwood Mac", year:1977, genre:"Rock", type:'single', sp:{t:'track', id:'5TDZyWDfbQFQJabbPwImVY'}},
  {id:106, title:"Ain't No Sunshine", artist:"Bill Withers", year:1971, genre:"Soul", type:'single', sp:{t:'track', id:'1k1Bqnv2R0uJXQN4u6LKYt'}},
  {id:107, title:"Blue in Green", artist:"Miles Davis", year:1959, genre:"Jazz", type:'single', sp:{t:'track', id:'5bnF23L7lzQJlO3KxIVMZM'}},
  {id:108, title:"Redbone", artist:"Childish Gambino", year:2016, genre:"R&B", type:'single', sp:{t:'track', id:'3vQ4T78TTMOjQXGfXVKQJo'}},
  {id:109, title:"Blinding Lights", artist:"The Weeknd", year:2020, genre:"Pop", type:'single', sp:{t:'track', id:'0VjIjW4GlUZAMYd2vXMi3b'}},
  {id:110, title:"HUMBLE.", artist:"Kendrick Lamar", year:2017, genre:"Hip-Hop", type:'single', sp:{t:'track', id:'7KXjTSCq5nL1LoYtL7XAwS'}},
  {id:111, title:"Uptown Funk", artist:"Mark Ronson, Bruno Mars", year:2014, genre:"Funk", type:'single', sp:{t:'track', id:'32OlwWuMpZ6b0aN2RZOeMS'}},
  {id:112, title:"Despacito", artist:"Luis Fonsi, Daddy Yankee", year:2017, genre:"Reggaeton", type:'single', sp:{t:'track', id:'7CUYHcu0RnbOnMz4RuN07w'}},

  /* ---- ATUALIZAÇÃO: em alta agora (julho de 2026) ---- */
  {id:113, title:"Dai Dai", artist:"Shakira, Burna Boy", year:2026, genre:"Afrobeats", type:'single', sp:{t:'track', id:'0kosUz0jePvjiz4ctmR6wL'}},
  {id:114, title:"hate that i made you love me", artist:"Ariana Grande", year:2026, genre:"Pop", type:'single', sp:{t:'track', id:'20jbSiX29FDX4oQxBXyUEi'}},
  {id:115, title:"Choosin' Texas", artist:"Ella Langley", year:2026, genre:"Country", type:'single', sp:{t:'track', id:'7scFxt9VhL4FJwuPSfRlfN'}},
  {id:116, title:"The Fate of Ophelia", artist:"Taylor Swift", year:2025, genre:"Pop", type:'single', sp:{t:'track', id:'53iuhJlwXhSER5J2IYYv1W'}},
  {id:117, title:"Man I Need", artist:"Olivia Dean", year:2026, genre:"R&B", type:'single', sp:{t:'track', id:'1qbmS6ep2hbBRaEZFpn7BX'}},
  {id:118, title:"So Easy (To Fall In Love)", artist:"Olivia Dean", year:2026, genre:"Funk/Soul", type:'single', sp:{t:'track', id:'6sGIMrtIzQjdzNndVxe397'}},
  {id:119, title:"Dracula", artist:"Tame Impala, JENNIE", year:2026, genre:"Eletrônica", type:'single', sp:{t:'track', id:'1NXbNEAcPvY5G1xvfN57aA'}},
  {id:120, title:"I Just Might", artist:"Bruno Mars", year:2026, genre:"Funk", type:'single', sp:{t:'track', id:'6f68Ac5tt5BQOpwr0BV9oN'}},
  {id:121, title:"Janice STFU", artist:"Drake", year:2026, genre:"Hip-Hop", type:'single', sp:{t:'track', id:'514joG57v4yKTsfQmz7stz'}},
  {id:122, title:"stupid song", artist:"Olivia Rodrigo", year:2026, genre:"Rock", type:'single', sp:{t:'track', id:'49j6SvuvWfbEKZKzsHCdLJ'}},
  {id:123, title:"drop dead", artist:"Olivia Rodrigo", year:2026, genre:"Pop", type:'single', sp:{t:'track', id:'7Hc6qcJG4NtyZgbNvQyd8U'}},
  {id:124, title:"DtMF", artist:"Bad Bunny", year:2025, genre:"Reggaeton", type:'single', sp:{t:'track', id:'3sK8wGT43QFpWrvNQsrQya'}},
  {id:125, title:"Si Antes Te Hubiera Conocido", artist:"KAROL G", year:2026, genre:"Reggaeton", type:'single', sp:{t:'track', id:'6WatFBLVB0x077xWeoVc2k'}},
  {id:126, title:"APT.", artist:"ROSÉ, Bruno Mars", year:2024, genre:"K-Pop", type:'single', sp:{t:'track', id:'4wJ5Qq0jBN4ajy7ouZIV1c'}},
  {id:127, title:"Golden", artist:"HUNTR/X", year:2025, genre:"K-Pop", type:'single', sp:{t:'track', id:'1CPZ5BxNNd0n0nF4Orb9JS'}},
  {id:128, title:"Manchild", artist:"Sabrina Carpenter", year:2025, genre:"Pop", type:'single', sp:{t:'track', id:'2BwO5K8Q7EPAJSGze3AAh9'}},
  {id:129, title:"Ordinary", artist:"Alex Warren", year:2025, genre:"Pop", type:'single', sp:{t:'track', id:'2RkZ5LkEzeHGRsmDqKwmaJ'}},
  {id:130, title:"Die With A Smile", artist:"Lady Gaga, Bruno Mars", year:2024, genre:"Pop", type:'single', sp:{t:'track', id:'2plbrEY59IikOBgBGLjaoe'}},
  {id:131, title:"La Plena (W Sound 05)", artist:"W Sound, Beéle, Ovy On The Drums", year:2025, genre:"Reggaeton", type:'single', sp:{t:'track', id:'6iOndD4OFo7GkaDypWQIou'}},
  {id:132, title:"Eu Te Seguro (Ao Vivo)", artist:"Panda, MJ Records", year:2026, genre:"Sertanejo", type:'single', sp:{t:'track', id:'4V2rUOmaevK0C1bKAkeFf5'}},
  {id:133, title:"Nem Pagando", artist:"Henrique Casttro, Grupo Menos É Mais", year:2026, genre:"Sertanejo", type:'single', sp:{t:'track', id:'1haTu99Drbh0fs7d09UNPu'}},
  {id:134, title:"Cadeira Cativa (Ao Vivo)", artist:"Zé Neto & Cristiano", year:2026, genre:"Sertanejo", type:'single', sp:{t:'track', id:'7gx504HCEsTgxmyPNov5Lh'}},
  {id:135, title:"Lua Cheia", artist:"Marina Sena", year:2023, genre:"Indie/Alternativo", type:'single', sp:{t:'track', id:'6II8HGRVkvVUy0uIM4X5Qq'}},

  /* ---- ATUALIZAÇÃO: mais faixas marcantes, cobrindo estilos que ainda tinham pouca coisa ---- */
  {id:136, title:"Smells Like Teen Spirit", artist:"Nirvana", year:1991, genre:"Rock", type:'single', sp:{t:'track', id:'5ghIJDpPoe3CfHMGu71E6T'}},
  {id:137, title:"Anti-Hero", artist:"Taylor Swift", year:2022, genre:"Pop", type:'single', sp:{t:'track', id:'0V3wPSX9ygBnCm8psDIegu'}},
  {id:138, title:"Enter Sandman", artist:"Metallica", year:1991, genre:"Metal", type:'single', sp:{t:'track', id:'3DwQ7AH3xGD9h65ezslm6q'}},
  {id:139, title:"Take Five", artist:"The Dave Brubeck Quartet", year:1959, genre:"Jazz", type:'single', sp:{t:'track', id:'1YQWosTIljIvxAgHWTp7KP'}},
  {id:140, title:"Mi Gente", artist:"J Balvin, Willy William", year:2017, genre:"Reggaeton", type:'single', sp:{t:'track', id:'4qbnrGYRCop1mpsPeECWHf'}},
  {id:141, title:"Dynamite", artist:"BTS", year:2020, genre:"K-Pop", type:'single', sp:{t:'track', id:'0t1kP63rueHleOhQkYSXFY'}},
  {id:142, title:"Ai Se Eu Te Pego", artist:"Michel Teló", year:2011, genre:"Sertanejo", type:'single', sp:{t:'track', id:'46aIq2GKW7Vr6i4g2Vvycd'}},
];

export const playlists = [
  {id:201, title:"Today's Top Hits", artist:"Spotify · playlist oficial", year:2026, genre:"Pop", type:'playlist', sp:{t:'playlist', id:'37i9dQZF1DXcBWIGoYBM5M'}},
  {id:202, title:"RapCaviar", artist:"Spotify · playlist oficial", year:2026, genre:"Hip-Hop", type:'playlist', sp:{t:'playlist', id:'37i9dQZF1DX0XUsuxWHRQd'}},
  {id:203, title:"Rock Classics", artist:"Spotify · playlist oficial", year:2026, genre:"Rock", type:'playlist', sp:{t:'playlist', id:'37i9dQZF1DWXRqgorJj26U'}},
  {id:204, title:"Viva Latino", artist:"Spotify · playlist oficial", year:2026, genre:"Reggaeton", type:'playlist', sp:{t:'playlist', id:'37i9dQZF1DX10zKzsJ2jva'}},
  {id:205, title:"K-Pop ON!", artist:"Spotify · playlist oficial", year:2026, genre:"K-Pop", type:'playlist', sp:{t:'playlist', id:'37i9dQZF1DX9tPFwDMOaN1'}},
  {id:206, title:"Jazz Classics", artist:"Spotify · playlist oficial", year:2026, genre:"Jazz", type:'playlist', sp:{t:'playlist', id:'37i9dQZF1DXbITWG1ZJKYt'}},
  {id:207, title:"Kickass Metal", artist:"Spotify · playlist oficial", year:2026, genre:"Metal", type:'playlist', sp:{t:'playlist', id:'37i9dQZF1DWTcqUzwhNmKv'}},
  {id:208, title:"Bossa Nova", artist:"Spotify · playlist oficial", year:2026, genre:"Bossa Nova", type:'playlist', sp:{t:'playlist', id:'37i9dQZF1DX4AyFl3yqHeK'}},
  {id:209, title:"Afro Hits", artist:"Spotify · playlist oficial", year:2026, genre:"Afrobeats", type:'playlist', sp:{t:'playlist', id:'37i9dQZF1DWX0o6sD1a6P5'}},
  {id:210, title:"Are & Be", artist:"Spotify · playlist oficial", year:2026, genre:"R&B", type:'playlist', sp:{t:'playlist', id:'37i9dQZF1DX4SBhb3fqCJd'}},
  {id:211, title:"Esquenta Sertanejo", artist:"Spotify · playlist oficial", year:2026, genre:"Sertanejo", type:'playlist', sp:{t:'playlist', id:'37i9dQZF1DXdSjVZQzv2tl'}},
  {id:212, title:"Funk Hits", artist:"Spotify · playlist oficial", year:2026, genre:"Funk", type:'playlist', sp:{t:'playlist', id:'37i9dQZF1DWTkIwO2HDifB'}},
  {id:213, title:"Hot Country", artist:"Spotify · playlist oficial", year:2026, genre:"Country", type:'playlist', sp:{t:'playlist', id:'37i9dQZF1DX1lVhptIYRda'}},
  {id:214, title:"Indie Pop", artist:"Spotify · playlist oficial", year:2026, genre:"Indie/Alternativo", type:'playlist', sp:{t:'playlist', id:'37i9dQZF1DWWEcRhUVtL8n'}},
];

export const famousGenres = [
  "Pop","Rock","Hip-Hop/Rap","R&B","Eletrônica","Reggaeton",
  "Sertanejo","Funk","K-Pop","Jazz","Country","Metal","Afrobeats","Indie/Alternativo",
  "Samba","MPB","Pagode","Forró","Axé","Piseiro","Trap","Soul","Blues","Folk",
  "Reggae","Punk","Gospel/Cristã","Bossa Nova","Clássica","Disco","House","Techno",
  "Trance","Dubstep","Lo-fi","Salsa","Bachata","Cumbia","Tango","Fado","Flamenco",
  "J-Pop","J-Rock","Synthwave","Ambient","World Music","Emo","Grunge","Amapiano"
];

/* ---------- PAÍSES ---------- */
export const countries = [
  "Brasil","Estados Unidos","Portugal","Reino Unido","Espanha","França",
  "Alemanha","Itália","Argentina","México","Colômbia","Japão","Coreia do Sul",
  "Índia","Canadá","Austrália","Outro"
];

export const trendingByCountry = {
  "Brasil": {
    "Sertanejo": [{t:"Eu Te Seguro (Ao Vivo)", a:"Panda, MJ Records"}, {t:"Nem Pagando", a:"Henrique Casttro, Grupo Menos É Mais"}, {t:"Cadeira Cativa (Ao Vivo)", a:"Zé Neto & Cristiano"}, {t:"Pra Sempre Vou Te Amar", a:"Luan Layzon"}],
    "Funk": [{t:"Diário de um Cafajeste", a:"DJ Oreia, Mc Lele JP e outros"}, {t:"F*DA-SE", a:"MC Duduzera, Arqui-Rival, Maza"}, {t:"Reliquia do 2T", a:"DJ Gu, MC Vine7 e outros"}],
    "Pop": [{t:"SOFIA", a:"Thalles Luna"}, {t:"É Gol", a:"Rafa Otero"}],
    "Hip-Hop/Rap": [{t:"Baco Exu do Blues — trabalho recente", a:"Baco Exu do Blues"}],
    "Indie/Alternativo": [{t:"Lua Cheia", a:"Marina Sena"}, {t:"Luedji Luna — trabalho recente", a:"Luedji Luna"}]
  },
  "Estados Unidos": {
    "Pop": [{t:"hate that i made you love me", a:"Ariana Grande"}, {t:"Manchild", a:"Sabrina Carpenter"}, {t:"The Fate of Ophelia", a:"Taylor Swift"}],
    "Hip-Hop/Rap": [{t:"Janice STFU", a:"Drake"}],
    "R&B": [{t:"Man I Need", a:"Olivia Dean"}],
    "Rock": [{t:"stupid song", a:"Olivia Rodrigo"}],
    "Country": [{t:"Choosin' Texas", a:"Ella Langley"}]
  },
  "Portugal": {
    "Pop": [{t:"sucessos recentes", a:"Mimicat"}],
    "Hip-Hop/Rap": [{t:"sucessos recentes", a:"Plutonio"}]
  },
  "Reino Unido": {
    "Pop": [{t:"So Easy (To Fall In Love)", a:"Olivia Dean"}, {t:"sucessos recentes", a:"Dua Lipa"}],
    "Rock": [{t:"sucessos recentes", a:"Fontaines D.C."}]
  },
  "Espanha": {
    "Reggaeton": [{t:"DtMF", a:"Bad Bunny"}],
    "Pop": [{t:"sucessos recentes", a:"Rosalía"}]
  },
  "Argentina": {
    "Hip-Hop/Rap": [{t:"sucessos recentes", a:"Trueno"}],
    "Pop": [{t:"sucessos recentes", a:"Tini"}]
  },
  "México": {
    "Reggaeton": [{t:"sucessos recentes", a:"Peso Pluma"}],
    "Pop": [{t:"sucessos recentes", a:"Danna"}]
  },
  "Coreia do Sul": {
    "K-Pop": [{t:"Golden", a:"HUNTR/X"}, {t:"APT.", a:"ROSÉ, Bruno Mars"}]
  },
  "Global": {
    "Pop": [{t:"hate that i made you love me", a:"Ariana Grande"}, {t:"The Fate of Ophelia", a:"Taylor Swift"}, {t:"Manchild", a:"Sabrina Carpenter"}],
    "Hip-Hop/Rap": [{t:"Janice STFU", a:"Drake"}],
    "R&B": [{t:"Man I Need", a:"Olivia Dean"}],
    "Reggaeton": [{t:"Si Antes Te Hubiera Conocido", a:"KAROL G"}, {t:"DtMF", a:"Bad Bunny"}],
    "Eletrônica": [{t:"Dracula", a:"Tame Impala, JENNIE"}],
    "Rock": [{t:"stupid song", a:"Olivia Rodrigo"}],
    "K-Pop": [{t:"Golden", a:"HUNTR/X"}, {t:"APT.", a:"ROSÉ, Bruno Mars"}],
    "Sertanejo": [{t:"Eu Te Seguro (Ao Vivo)", a:"Panda, MJ Records"}],
    "Funk": [{t:"So Easy (To Fall In Love)", a:"Olivia Dean"}],
    "Country": [{t:"Choosin' Texas", a:"Ella Langley"}],
    "Metal": [{t:"sucessos recentes", a:"Sleep Token"}],
    "Afrobeats": [{t:"Dai Dai", a:"Shakira, Burna Boy"}],
    "Jazz": [{t:"sucessos recentes", a:"Samara Joy"}],
    "Indie/Alternativo": [{t:"Lua Cheia", a:"Marina Sena"}]
  }
};
/* Última checagem contra os charts: Billboard Hot 100 (18 jul 2026),
   Spotify Weekly Global e Spotify Weekly Brasil (kworb.net, semana de 16 jul 2026). */

export const reviewers = [
  {name:"Marina", color:"#B0512F"}, {name:"Théo", color:"#3C6459"},
  {name:"Duda", color:"#8156A8"}, {name:"Rafa", color:"#D6A62C"},
  {name:"Ana", color:"#2C6E8E"}, {name:"Bruno", color:"#C77B2E"},
  {name:"Cami", color:"#9A3B3B"}, {name:"Léo", color:"#4C8C6B"},
];

export const communityReviews = [
  {user:0, itemId:1, rating:5, text:"Ouço isso todo domingo de manhã, é quase um ritual.", time:"2h", comments:[
    {name:"Théo", text:"Track 2 sozinha já é uma aula de fraseado.", likes:3, liked:false}
  ]},
  {user:1, itemId:104, rating:5, text:"O baixo dessa faixa carrega o disco inteiro sozinho.", time:"4h", comments:[
    {name:"Cami", text:"Concordo, groove insano do início ao fim.", likes:5, liked:false},
    {name:"Ana", text:"Melhor faixa do álbum sem dúvida.", likes:2, liked:false}
  ]},
  {user:2, itemId:6, rating:4, text:"Frio, seco, perfeito pra andar sozinho à noite.", time:"6h", comments:[]},
  {user:3, itemId:2, rating:5, text:"Cada faixa é uma aula de arranjo. Revisitei três vezes essa semana.", time:"9h", comments:[
    {name:"Rafa", text:"Essa produção não envelhece nunca.", likes:1, liked:false}
  ]},
  {user:4, itemId:11, rating:5, text:"Doeu ouvir de novo. Continua doendo do mesmo jeito.", time:"11h", comments:[]},
  {user:5, itemId:102, rating:4, text:"Impossível ficar parado, mesmo sem querer dançar.", time:"1d", comments:[]},
  {user:6, itemId:9, rating:5, text:"A produção envelheceu melhor que muita coisa lançada ontem.", time:"1d", comments:[
    {name:"Duda", text:"Concordo total, é atemporal.", likes:2, liked:false}
  ]},
  {user:7, itemId:7, rating:4, text:"Trilha sonora obrigatória pra qualquer tarde de calor.", time:"1d", comments:[]},
  {user:0, itemId:103, rating:5, text:"O groove entra e não sai mais da cabeça.", time:"2d", comments:[]},
  {user:2, itemId:10, rating:4, text:"Estrutura estranha, letras mais estranhas ainda — e funciona.", time:"2d", comments:[]},
  {user:3, itemId:12, rating:5, text:"Energia que não cabe no formato de disco de estúdio.", time:"3d", comments:[]},
  {user:5, itemId:8, rating:4, text:"Não é pra ouvir com atenção, é pra ouvir com o ambiente.", time:"3d", comments:[]},
];
