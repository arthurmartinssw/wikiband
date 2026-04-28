# Cloudflare Tunnel fixo para a API

O link `trycloudflare.com` dos Quick Tunnels muda a cada execucao. Para a Vercel nao precisar receber um URL novo no `vercel.json`, use um Cloudflare Tunnel nomeado com um hostname proprio, por exemplo:

```text
https://wikiband-api.seu-dominio.com
```

Na Cloudflare, crie um tunnel, publique uma aplicacao apontando para o backend local do Wikiband e use:

```text
Type: HTTP
URL: localhost:3000
```

Depois, na Vercel, configure a variavel de ambiente:

```text
WIKIBAND_API_ORIGIN=https://wikiband-api.seu-dominio.com
```

Com isso, o frontend continua chamando `/api/...`, a Function em `api/proxy.js` encaminha para o hostname fixo e o `vercel.json` nao precisa mais trocar de link quando o tunnel reiniciar.

## Quando nao quiser depender do PC

Cloudflare Tunnel apontando para `localhost:3000` depende do PC ligado. Para deixar a API online sem o computador local, hospede o backend em um servico externo.

O caminho barato recomendado para este projeto esta em:

```text
docs/render-neon-deploy.md
```

Referencias:
- https://vercel.com/docs/routing/rewrites
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/
