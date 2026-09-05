import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

/** Dev only：讓 `/join/:code`、`/host`、`/` 在 Vite dev server 上跟正式環境的 Express 路由行為一致。 */
function devRoutingPlugin(): Plugin {
  return {
    name: "dev-routing",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next();
        if (req.url === "/" || req.url.startsWith("/join/")) {
          req.url = "/player.html";
        } else if (req.url === "/host") {
          req.url = "/host.html";
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [devRoutingPlugin()],
  build: {
    rollupOptions: {
      input: {
        player: `${__dirname}player.html`,
        host: `${__dirname}host.html`,
      },
    },
  },
  server: {
    proxy: {
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
      },
    },
  },
});
