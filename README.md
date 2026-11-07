# Wikiband

Wikiband é uma vitrine de música: um lugar para conhecer artistas, ouvir prévias, ver o que está em alta no Brasil e guardar descobertas em uma biblioteca pessoal.

## Principais recursos

- **Vitrine**: ranking "Em alta no Brasil" (músicas e álbuns mais ouvidos no Apple Music), exploração por gênero e sugestões rápidas.
- **Busca** por álbuns, músicas e artistas, com filtros de gênero, país, década e ordenação.
- **Página de artista**: biografia (Wikipédia), músicas populares, discografia completa e prévias.
- **Player** com fila, rádio dos resultados, rádio dos favoritos e "tocar o ranking".
- **Biblioteca na nuvem**: favoritos, coleções, histórico e reproduções sincronizados entre dispositivos.
- **Retrospectiva**: artista, gênero e década favoritos, com compartilhamento.
- **Perfil público** opcional (`/usuario.html?u=seu_usuario`), privado por padrão.
- **MusicAI**: assistente com IA que responde, recomenda e **monta playlists** que tocam direto no player.
- **Tema escuro e claro**, layout responsivo com barra de abas no celular e PWA.

## Tecnologia

- Frontend: HTML, CSS e JavaScript puros (sem build).
- Backend: Node.js + Express, PostgreSQL (Neon) para contas e biblioteca.
- Vercel: páginas estáticas, proxy da API (`api/proxy.js`), MusicAI (`api/musicai.js`) e ranking (`api/charts.js`).
- Dados: API pública do iTunes, feed de ranking do Apple Music e Wikipédia.

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha DATABASE_URL e SESSION_SECRET
npm run dev            # http://localhost:3000
npm test               # testes da API com Postgres em memória
```

A tabela `USUARIO_BIBLIOTECA` é criada automaticamente na primeira inicialização do backend.

## Variáveis de ambiente

| Variável | Onde | Para quê |
| --- | --- | --- |
| `DATABASE_URL`, `DB_SSL*` | backend | Postgres |
| `SESSION_SECRET` | backend | assinatura das sessões (32+ caracteres) |
| `CORS_ORIGINS` | backend | origens permitidas |
| `PROXY_SHARED_SECRET` | backend **e** Vercel | o proxy repassa o IP real do usuário para o rate limit |
| `WIKIBAND_API_ORIGIN` | Vercel | endereço do backend |
| `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `AI_BASE_URL`, `GROQ_API_KEY` | Vercel | provedor da MusicAI |

### Trocando a IA da MusicAI

A MusicAI usa uma camada de provedores em `api/_lib/ai.js`. Groq é o padrão. Para trocar, mude só as variáveis:

```bash
AI_PROVIDER=openai      # ou gemini, openrouter, custom
AI_API_KEY=...
AI_MODEL=nome-do-modelo
# AI_BASE_URL=...       # só para "custom" (qualquer API compatível com OpenAI, ex.: Ollama)
```

Para uma API com formato diferente, escreva um adaptador em `api/_lib/ai.js` e registre-o em `ADAPTERS`.

## Segurança

- Senhas com bcrypt (limite de 72 bytes validado), comparação em tempo constante e hash falso para usuário inexistente.
- Sessões assinadas com HMAC e amarradas ao hash da senha: trocar a senha encerra todas as outras sessões.
- Rate limit por IP real (repassado pelo proxy com segredo compartilhado), por e-mail no login e por rota.
- CSP restritiva, HSTS, `X-Frame-Options`, `nosniff`, arquivos públicos em lista fechada.
- Proxy da Vercel com lista fechada de rotas e métodos.
- Perfil público só expõe campos selecionados (nunca o e-mail) e responde igual para perfil inexistente ou privado.
- MusicAI recusa chamadas de outros sites e tem limite de mensagens.

## Status

Projeto em desenvolvimento ativo.
