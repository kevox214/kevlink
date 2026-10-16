"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
});

pool.on("error", error => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

async function migrate() {
  const migrationsPath = path.join(__dirname, "migrations");
  const migrationFiles = (await fs.readdir(migrationsPath))
    .filter(filename => /^\d+_[a-z0-9_-]+\.sql$/i.test(filename))
    .sort();
  for (const filename of migrationFiles) {
    const sql = await fs.readFile(path.join(migrationsPath, filename), "utf8");
    await pool.query(sql);
  }
}

module.exports = { migrate, pool };
