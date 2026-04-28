# Deploy barato: Render + Neon

Este caminho tira a API do seu PC:

```text
Frontend: Vercel
API: Render Free
Banco: Neon Free (Postgres)
```

## 1. Criar o banco no Neon

1. Acesse https://neon.com e crie um projeto.
2. Abra o SQL Editor.
3. Cole e execute o conteudo de `docs/postgres-schema.sql`.
4. Copie a connection string do banco. Ela comeca com `postgresql://`.

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
```

O Render vai gerar uma URL parecida com:

```text
https://wikiband-api.onrender.com
```

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
