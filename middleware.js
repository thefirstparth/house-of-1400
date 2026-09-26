import { rewrite, next } from "@vercel/functions";

// Andaaza's own addresses: there, / is Andaaza and /poster its poster, not the paper. Vercel serves a real file before
// its rewrites, so this is done here, before the file lookup. Only / and /poster pass through this at all. To give
// Andaaza another address (a domain of its own), add it to the project's Domains and to this list.
const ANDAAZA_HOSTS = ["andaaza-live.vercel.app"];

export const config = { matcher: ["/", "/poster"] };

export default function middleware(request) {
  const url = new URL(request.url);
  if (!ANDAAZA_HOSTS.includes(url.hostname)) return next();
  return rewrite(new URL(url.pathname === "/poster" ? "/andaaza/poster" : "/andaaza", url));
}
