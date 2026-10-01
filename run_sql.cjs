const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    await client.connect();
    // Re-apply the RPC to update COUNT(*) changes
    const rpcSql = fs.readFileSync('supabase_schema.sql', 'utf8');
    // Extract just the get_dashboard_service_stats_mv function
    const matches = rpcSql.match(/CREATE OR REPLACE FUNCTION public\.get_dashboard_service_stats_mv[\s\S]*?\$\$ LANGUAGE plpgsql;/);
    if (matches) {
        console.log("Found function definition, executing...");
        await client.query(matches[0]);
        console.log("Updated RPC function successfully.");
    } else {
        console.log("Could not find function definition.");
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
