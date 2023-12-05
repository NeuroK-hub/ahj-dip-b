const Router = require('koa-router');
const bcrypt = require('bcrypt');
const { koaBody } = require('koa-body');
const jwt = require('jsonwebtoken');

const usersRouter = new Router({ prefix: '/users' });

usersRouter.post('/register', koaBody(), async (ctx) => {
   const { username, password } = ctx.request.body;

   if(!username || !password) {
      ctx.response.status = 409;
      ctx.response.body = { message: 'Отсутствует логин или пароль'};
      return;
   }

   const existingUser = await ctx.db.get('SELECT * FROM users WHERE username = ?', username);
   if (existingUser) {
      ctx.response.status = 409;
      ctx.response.body = { message: 'Пользователь с таким логином уже существует' };
      return;
   }

   const hashedPassword = await bcrypt.hash(password, 10);

   const result = await ctx.db.run('INSERT INTO users (username, password) VALUES (?, ?)', username, hashedPassword);
   const user = { id: result.lastID, username };

   ctx.body = user;
});

usersRouter.post('/login', koaBody(), async (ctx) => {
   const { username, password } = ctx.request.body;

   const user = await ctx.db.get('SELECT * FROM users WHERE username = ?', username);
   if (!user) {
      ctx.response.status = 401;
      ctx.response.body = { message: 'Неверный логин или пароль' };
      return;
   }

   const passwordMatches = await bcrypt.compare(password, user.password);
   if (!passwordMatches) {
      ctx.response.status = 401;
      ctx.response.body = { message: 'Неверный логин или пароль' };
      return;
   }

   const token = jwt.sign({ userId: user.id }, 'netology-secret');

   ctx.body = { token, user };
});

module.exports = usersRouter;
