const Pool = require('pg').Pool

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "notification_poc_db_local",
  password: "postgres",
  port: "5433",
})

module.exports = pool;