import { defineConfig } from 'drizzle-kit';
import { loadEnvFiles } from './src/lib/env';

loadEnvFiles();

const provider = process.env.DATABASE_PROVIDER || 'postgres';
const sqliteDialect = provider === 'sqlite';

const dialectMap: Record<string, 'sqlite' | 'postgresql'> = {
  sqlite: 'sqlite',
  postgres: 'postgresql',
  postgresql: 'postgresql',
};

export default defineConfig({
  schema: './src/config/db/schema.ts',
  out: sqliteDialect ? './drizzle/local' : './drizzle/postgres',
  dialect: dialectMap[provider] || 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'file:data/local.db',
  },
});
