import dotenv from "dotenv";
import http from "http";
import app from "./app.js";
import pool from "./config/db.js";
import { applyMigrations } from "../scripts/applyMigrations.js";
import { logger } from "./utils/logger.js";

dotenv.config();

const PORT = Number(process.env.PORT || 5000);

const server = http.createServer(app); // it creates an http server that listens to incoming requests and passes them to the express app

const start = async () => {
  try {
    await applyMigrations(pool);
  } catch (error) {
    logger.error("migration_failed", { message: error.message });
    process.exit(1);
  }

  server.listen(PORT, () => {
    logger.info("server_started", {
      port: PORT,
      env: process.env.NODE_ENV || "development"
    });
  });
};

start();
