export function getDatabaseConfig() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL_NOT_CONFIGURED");
  }

  // pg v8 会把 sslmode=require 当成 verify-full，Supabase 的证书链会报
  // self-signed certificate in certificate chain。这里去掉 sslmode，
  // 由下面的 ssl 选项统一控制。
  const url = new URL(raw);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("uselibpqcompat");

  return {
    connectionString: url.toString(),
    ssl:
      process.env.PGSSL === "disable"
        ? undefined
        : { rejectUnauthorized: false }
  };
}
