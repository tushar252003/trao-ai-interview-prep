import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import dns from "node:dns/promises";
import net from "node:net";
import { config } from "../config";

export interface PageResult {
  url: string;
  title: string;
  text: string;
  links: { href: string; text: string }[];
  ok: boolean;
  error?: string;
}

function isPrivateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a,b,c] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:");
}

async function assertSafeUrl(raw: string) {
  const u = new URL(raw);
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only HTTP(S) URLs are allowed");
  if (u.username || u.password) throw new Error("Credential-bearing URLs are not allowed");
  const hostname = u.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) throw new Error("Private hostname rejected");
  const records = await dns.lookup(hostname, { all: true });
  if (config.production && records.some(r => isPrivateIp(r.address))) throw new Error("Private address rejected");
  return u;
}

async function fetchText(url: string, accept = "text/html") {
  await assertSafeUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TraoInterviewPrep/1.0 (+assessment crawler)", Accept: accept }
    });
    const type = res.headers.get("content-type") || "";
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!type.includes("text/html") && !type.includes("text/plain")) throw new Error(`Unsupported content type: ${type}`);
    const len = Number(res.headers.get("content-length") || 0);
    if (len && len > config.maxPageBytes) throw new Error("Response too large");
    const text = await res.text();
    if (text.length > config.maxPageBytes) throw new Error("Response too large");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function robotsFor(origin: string) {
  try {
    const raw = await fetchText(`${origin}/robots.txt`, "text/plain");
    return robotsParser(`${origin}/robots.txt`, raw);
  } catch {
    return null;
  }
}

function normalize(base: URL, href: string) {
  try {
    const u = new URL(href, base);
    u.hash = "";
    return u;
  } catch { return null; }
}

function scoreLink(href: string, text: string) {
  const s = `${href} ${text}`.toLowerCase();
  const words = ["career","careers","jobs","job","hiring","hire","engineering","interview","handbook","about","culture"];
  return words.reduce((score, word, i) => score + (s.includes(word) ? 10 - Math.min(i, 5) : 0), 0);
}

export async function crawlCompany(startUrl: string): Promise<{ pages: PageResult[]; failures: string[] }> {
  const start = await assertSafeUrl(startUrl);
  const origin = `${start.protocol}//${start.host}`;
  const robots = await robotsFor(origin);
  const queue = [{ url: start.href, score: 100 }];
  const seen = new Set<string>();
  const pages: PageResult[] = [];
  const failures: string[] = [];

  while (queue.length && pages.length < config.maxCrawlPages) {
    queue.sort((a,b) => b.score - a.score);
    const next = queue.shift()!;
    if (seen.has(next.url)) continue;
    seen.add(next.url);

    if (robots && !robots.isAllowed(next.url, "TraoInterviewPrep")) {
      failures.push(`${next.url}: disallowed by robots.txt`);
      continue;
    }

    try {
      const html = await fetchText(next.url);
      const $ = cheerio.load(html);
      $("script,style,noscript,svg").remove();
      const title = $("title").first().text().trim();
      const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 30000);
      const links: { href: string; text: string }[] = [];

      $("a[href]").each((_, el) => {
        const raw = $(el).attr("href");
        if (!raw) return;
        const u = normalize(new URL(next.url), raw);
        if (!u || u.hostname !== start.hostname || !["http:","https:"].includes(u.protocol)) return;
        const item = { href: u.href, text: $(el).text().replace(/\s+/g, " ").trim().slice(0, 180) };
        links.push(item);
        if (!seen.has(item.href)) queue.push({ url: item.href, score: scoreLink(item.href, item.text) });
      });

      pages.push({ url: next.url, title, text, links, ok: true });
      await new Promise(r => setTimeout(r, config.crawlDelayMs));
    } catch (e: any) {
      failures.push(`${next.url}: ${e?.message || "fetch failed"}`);
    }
  }

  return { pages, failures };
}
