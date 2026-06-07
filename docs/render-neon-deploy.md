# Deploy barato: Render + Neon

Este caminho tira a API do seu PC:

```text
Frontend: Vercel
API: Render Free
Banco: Neon Free (Postgres)
```

## 1. Criar o banco no Neon

1. Acessar https://neon.com e criar um projeto.
2. Abrir o SQL Editor.
3. Colar e executar o conteudo de `docs/postgres-schema.sql`.
4. Copie a connection string do banco. Ela comeca com `postgresql://`.

Se a tabela `usuarios` ja existir sem `username`, execute tambem:

```text
docs/postgres-profile-migration.sql
```

## 2. Subir a API no Render

1. Acesse https://render.com.
2. Crie um Web Service a partir do repositorio do GitHub.
   - Se o Render detectar o `render.yaml`, ele ja preenche quase tudo.
3. Use:

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
Instance Type: Free
```

4. Em Environment, adicione:

```text
DB_CLIENT=postgres
DATABASE_URL=sua_connection_string_do_neon
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
SESSION_SECRET=uma_frase_longa_e_aleatoria_com_32_chars_ou_mais
CORS_ORIGINS=https://seu-projeto.vercel.app
```

O Render vai gerar uma URL parecida com:

```text
https://wikiband-api.onrender.com
```

Sem `SESSION_SECRET` forte, a API nao deve subir em producao. Use um valor longo,
aleatorio e diferente da senha/URL do banco.

Teste:

```text
https://wikiband-api.onrender.com/api/health
```

## 3. Apontar a Vercel para a API

Na Vercel, em Project Settings > Environment Variables, configure:

```text
WIKIBAND_API_ORIGIN=https://wikiband-api.onrender.com
```

Depois faca um redeploy do projeto na Vercel.

## Observacoes

- O Render Free dorme quando fica sem acesso por um tempo. O primeiro acesso depois disso pode demorar.
- Nao precisa comprar dominio para isso funcionar.
- Se quiser a API sempre acordada, troque o Render para o plano Starter.
