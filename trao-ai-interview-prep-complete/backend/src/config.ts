import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/trao_interview_prep",
  jwtSecret: process.env.JWT_SECRET || "dev-only-change-me",
  geminiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  maxCrawlPages: Number(process.env.MAX_CRAWL_PAGES || 8),
  crawlDelayMs: Number(process.env.CRAWL_DELAY_MS || 600),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 12000),
  maxPageBytes: Number(process.env.MAX_PAGE_BYTES || 2_000_000),
  production: process.env.NODE_ENV === "production"
};
