import * as cheerio from "cheerio";

export interface ResearchResult {
  query: string;
  results: { title: string; url: string; snippet: string }[];
}

export async function searchPublicInterviewDiscussion(company: string): Promise<ResearchResult> {
  const query = `${company} interview process interview questions`;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 TraoInterviewPrep/1.0", Accept: "text/html" }
    });
    if (!res.ok) throw new Error(`Search HTTP ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);
    const results: ResearchResult["results"] = [];

    $(".result").each((_, el) => {
      const a = $(el).find(".result__a").first();
      const snippet = $(el).find(".result__snippet").first().text().replace(/\s+/g, " ").trim();
      const title = a.text().replace(/\s+/g, " ").trim();
      const href = a.attr("href");
      if (title && href) results.push({ title, url: href, snippet });
    });

    return { query, results: results.slice(0, 8) };
  } catch {
    return { query, results: [] };
  }
}
