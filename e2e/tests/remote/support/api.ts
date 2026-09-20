import { request, type APIRequestContext } from "@playwright/test";
import { ADMIN_URL } from "./env.js";

export class MfaRequiredError extends Error {
  constructor(email: string) {
    super(`MFA_REQUIRED pour ${email} — ARRÊT : demander à l'utilisateur comment procéder.`);
  }
}

export interface ApiResult<T = any> {
  status: number;
  ok: boolean;
  body: T;
  headers: Record<string, string>;
}

/** Rejoue une requête sur erreur réseau transitoire (ECONNRESET, timeout, DNS) — jamais sur une réponse HTTP. */
async function withNetworkRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String((err as Error)?.message ?? err);
      if (!/ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|read ECONN|Timeout/i.test(msg)) throw err;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

/** Nombre d'échecs de connexion déjà provoqués par e-mail pendant ce processus (garde-fou anti-verrouillage). */
const failedLogins = new Map<string, number>();
const MAX_FAILED_PER_ACCOUNT = 2;

/**
 * Client API authentifié (Bearer). Ne journalise jamais le mot de passe ni les jetons.
 * Re-login automatique unique sur 401 (jeton d'accès de 15 min).
 */
export class ApiClient {
  private ctx?: APIRequestContext;
  private token?: string;
  user?: { id: string; role: string; siteId: string | null; teamId: string | null; email: string | null };

  constructor(
    private readonly email: string,
    private readonly password: string,
    private readonly baseURL: string = ADMIN_URL,
  ) {}

  private async context(): Promise<APIRequestContext> {
    this.ctx ??= await request.newContext({ baseURL: this.baseURL });
    return this.ctx;
  }

  async login(): Promise<void> {
    const res = await ApiClient.rawLogin(this.email, this.password, this.baseURL, await this.context());
    if (res.status === 401 && res.body?.code === "MFA_REQUIRED") throw new MfaRequiredError(this.email);
    if (!res.ok) {
      throw new Error(`Login refusé pour ${this.email} : HTTP ${res.status} ${res.body?.code ?? ""}`);
    }
    this.token = res.body.accessToken;
    this.user = res.body.user;
  }

  /** Tentative de connexion sans exception (tests d'échec). Compte les échecs par e-mail. */
  static async rawLogin(
    email: string,
    password: string,
    baseURL: string = ADMIN_URL,
    ctx?: APIRequestContext,
  ): Promise<ApiResult> {
    const key = email.toLowerCase();
    if ((failedLogins.get(key) ?? 0) >= MAX_FAILED_PER_ACCOUNT) {
      throw new Error(`Garde-fou : ${MAX_FAILED_PER_ACCOUNT} échecs de connexion déjà atteints pour ${email}.`);
    }
    const own = ctx ?? (await request.newContext({ baseURL }));
    // Retry uniquement sur erreur réseau (aucune réponse reçue) : ne compte pas comme un échec de connexion.
    const res = await withNetworkRetry(() => own.post("/api/v1/auth/login", { data: { email, password } }));
    const body = await res.json().catch(() => ({}));
    if (!ctx) await own.dispose();
    if (res.status() === 401 || res.status() === 429) {
      failedLogins.set(key, (failedLogins.get(key) ?? 0) + 1);
    }
    return { status: res.status(), ok: res.ok(), body, headers: res.headers() };
  }

  noteFailedUiLogin(): void {
    const key = this.email.toLowerCase();
    failedLogins.set(key, (failedLogins.get(key) ?? 0) + 1);
  }

  private async send(method: string, url: string, data?: unknown, retry = true): Promise<ApiResult> {
    const ctx = await this.context();
    if (!this.token) await this.login();
    const res = await withNetworkRetry(() =>
      ctx.fetch(`/api/v1${url}`, {
        method,
        data: data as any,
        headers: { Authorization: `Bearer ${this.token}` },
      }),
    );
    if (res.status() === 401 && retry) {
      await this.login();
      return this.send(method, url, data, false);
    }
    const contentType = res.headers()["content-type"] ?? "";
    let body: any;
    if (contentType.includes("application/json")) body = await res.json().catch(() => undefined);
    else body = await res.body();
    return { status: res.status(), ok: res.ok(), body, headers: res.headers() };
  }

  /** Requête avec le jeton courant, SANS re-login automatique (tests de révocation de session). */
  probe(method: string, url: string, data?: unknown) {
    return this.send(method, url, data, false);
  }

  get(url: string) {
    return this.send("GET", url);
  }
  post(url: string, data?: unknown) {
    return this.send("POST", url, data ?? {});
  }
  patch(url: string, data?: unknown) {
    return this.send("PATCH", url, data ?? {});
  }
  delete(url: string) {
    return this.send("DELETE", url);
  }

  /** GET paginé par curseur ({ data, nextCursor }) : renvoie toutes les lignes. */
  async getAllCursor<T = any>(url: string, maxPages = 50): Promise<T[]> {
    const rows: T[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < maxPages; i++) {
      const sep = url.includes("?") ? "&" : "?";
      const res: ApiResult = await this.get(`${url}${cursor ? `${sep}cursor=${cursor}` : ""}`);
      if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
      rows.push(...(res.body.data as T[]));
      cursor = res.body.nextCursor ?? null;
      if (!cursor) break;
    }
    return rows;
  }

  async dispose(): Promise<void> {
    await this.ctx?.dispose();
    this.ctx = undefined;
  }
}
