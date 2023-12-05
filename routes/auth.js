const jwt = require('jsonwebtoken');
const SECRET = 'netology-secret'; 

function auth() {
  return async function (ctx, next) {
    const token = ctx.headers.authorization?.split(' ')[1];
    const verifiedToken = verifyToken(token);
    if (!verifiedToken) {
      ctx.throw(401, 'Invalid token');
      return;
    }
    ctx.state.jwtData = verifiedToken;
    await next();
  };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (error) {
    console.log(error);
    return null;
  }
}

module.exports = { auth };
