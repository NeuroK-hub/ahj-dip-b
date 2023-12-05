const Koa = require('koa');
const cors = require('@koa/cors');
const errorHandler = require('koa-error');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');


const app = new Koa();
const messagesRouter = require('./routes/messagesRouter');
const usersRouter = require('./routes/usersRouter');

(async () => {
  const db = await open({
    filename: './mydb.sqlite',
    driver: sqlite3.Database
  });

  await db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )`
  );

  await db.run(
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT,
      text TEXT,
      file TEXT,
      created_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`
  );

  app.context.db = db;

  app.listen(3000, () => {
    console.log('Server started on port 3000');
  });
})();

app.use(cors());
app.use(errorHandler()); 


app.use(messagesRouter.routes());
app.use(usersRouter.routes());