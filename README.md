# NewsNow
![](screenshots/preview.light.png#gh-light-mode-only)
![](screenshots/preview.dark.png#gh-dark-mode-only)

English | [简体中文](README.zh-CN.md)

***Elegant reading of real-time and hottest news***

## Deployment

If login and caching are not required, you can directly deploy to platforms like Cloudflare Pages or Vercel. Just fork the repository and import it into the respective platform. The build output directory for Cloudflare Pages is `dist/output/public`.

For login, which involves GitHub OAuth, you only need to [create a GitHub App](https://github.com/settings/applications/new). No special permissions are required. After creating the app, you will get a Client ID and Client Secret. Different platforms have different places to set environment variables; refer to the `example.env.server` file. If running locally, rename it to `.env.server` and add the necessary values.

```env
# Github Client ID
G_CLIENT_ID=
# Github Client Secret
G_CLIENT_SECRET=
# JWT Secret, usually the same as Client Secret
JWT_SECRET=
# Initialize database, must be set to true on first run, can be turned off afterward
INIT_TABLE=true
```

This project primarily supports deployment on Cloudflare Pages and Docker. For Vercel, you need to set up your own database. Supported databases can be found at https://db0.unjs.io/connectors .

Cloudflare D1 database is free to use. You can manually create a database in the Cloudflare Worker control panel and add the `database_id` and `database_name` to the corresponding positions in `wrangler.toml`. The changes will take effect on the next deployment.

For Docker deployment. In the project root directory with `docker-compose.yml`, run

```sh
docker compose up
```

## Development

> [!TIP]
> Node version >= 20

```sh
corepack enable
pnpm i
pnpm dev
```

If you want to add data sources, refer to the `shared/metadata`, `shared/sources`, and `server/sources` directories. The project has complete types and a simple structure; feel free to explore.

## License

[MIT](./LICENSE) © ourongxing
