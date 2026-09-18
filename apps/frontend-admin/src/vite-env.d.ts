/// <reference types="vite/client" />

type VanstackDesktopServer = {
  host: string;
  port: number;
};

interface VanstackDesktop {
  getServer: () => Promise<VanstackDesktopServer>;
  setServer: (server: VanstackDesktopServer) => Promise<VanstackDesktopServer>;
}

interface Window {
  vanstackDesktop?: VanstackDesktop;
}
