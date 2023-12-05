const Router = require('koa-router');
const { koaBody } = require('koa-body');
const path = require('path');
const fs = require('fs');
const { auth } = require('./auth');

const messagesRouter = new Router();

messagesRouter.post('/messages', auth(), koaBody({
  multipart: true,
  formidable: {
    uploadDir: path.join(__dirname, '../uploads'),
    keepExtensions: true,
  },
}), async (ctx) => {
  const userId = ctx.state.jwtData.userId;
  const { type } = ctx.request.body;
  const file = ctx.request.files.file;
  const { created_at } = ctx.request.body
  const { text } = ctx.request.body

  if (!type) {
    ctx.throw(400, 'Type is required');
    return;
  }

  if (type === 'text' && file) {
    ctx.throw(400, 'Text message can not contain file');
    return;
  }

  if (type === 'file' && !file) {
    ctx.throw(400, 'File message must contain file');
    return;
  }

  if (type === 'file' && file.size > 5000000) {
    ctx.throw(400, 'File message can not be larger than 5MB');
    return;
  }

  let fileLink = null;
  let result;
  if (file) {
    const fileName = path.basename(file.filepath);
    fileLink = ctx.protocol + '://' + ctx.host + '/files/' + fileName;

    result = await ctx.db.run(
      'INSERT INTO messages (user_id, type, text, file, created_at) VALUES (?, ?, ?, ?, ?)',
      userId,
      type,
      text,
      file ? fileName : null,
      created_at ? created_at : new Date().toISOString()
    );
  } else {
    result = await ctx.db.run(
      'INSERT INTO messages (user_id, type, text, file, created_at) VALUES (?, ?, ?, ?, ?)',
      userId,
      type,
      text,
      null,
      created_at
    );
  }
  ctx.body = { id: result.lastID, type, text, file: fileLink };
});



messagesRouter.get('/messages', auth(), koaBody(), async (ctx) => {
  const userId = ctx.state.jwtData.userId;
  const limit = 10;
  const page = parseInt(ctx.query.page || 1);

  const skip = (page - 1) * limit;

  const messages = await ctx.db.all('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?', userId, limit, skip);

  ctx.body = messages;
});


messagesRouter.get('/files/:filename', koaBody(), async (ctx) => {
  const filename = ctx.params.filename;

  const message = await ctx.db.get('SELECT * FROM messages WHERE file = ?', filename);

  if (!message) {
    ctx.throw(404, 'File not found');
    return;
  }

  const filePath = path.join(__dirname, '../uploads', message.file);

  const regexRemoveExtra = /(\.\w+)\s*\(.+\)$/;

  const desiredFilename = message.text.replace(regexRemoveExtra, '$1');
  const encodedFilename = encodeURI(desiredFilename);

  ctx.set('Content-Disposition', `attachment; filename="${encodedFilename}"`);

  ctx.body = fs.createReadStream(filePath);
});

messagesRouter.get('/messages/search', auth(), async (ctx) => {
  const userId = ctx.state.jwtData.userId;
  const searchTerm = ctx.query.q;
  const messages = await searchMessagesByText(ctx.db, userId, searchTerm);
  ctx.body = messages;
});

async function searchMessagesByText(db, userId, searchTerm) {
  if (!searchTerm) {
    return [];
  }

  const query = `
    SELECT * FROM messages
    WHERE user_id = ? AND type = 'text' AND text LIKE ? COLLATE NOCASE
  `;

  const results = await db.all(query, userId, `%${searchTerm}%`);
  return results;
}

messagesRouter.get('/messages/type', auth(), koaBody(), async (ctx) => {
  const userId = ctx.state.jwtData.userId;
  const messageType = ctx.query.type;

  if (!messageType) {
    ctx.throw(400, 'Message type is required');
    return;
  }

  const messages = await ctx.db.all('SELECT * FROM messages WHERE user_id = ? AND type = ? ORDER BY created_at DESC', userId, messageType);

  ctx.body = messages;
});


messagesRouter.delete('/messages', async (ctx) => {
  const db = ctx.db;

  const messages = await db.all('SELECT * FROM messages');

  messages.forEach((message) => {
    if (message.file) {
      const filePath = path.join(__dirname, '../uploads', message.file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  });

  await db.run('DELETE FROM messages');

  ctx.body = 'All messages and their associated files deleted';
});

messagesRouter.delete('/messages/:id', async (ctx) => {
  const messageId = ctx.params.id;

  const message = await ctx.db.get('SELECT * FROM messages WHERE id = ?', messageId);

  if (!message) {
    ctx.throw(404, 'Message not found');
    return;
  }

  if (message.file) {
    const filePath = path.join(__dirname, '../uploads', message.file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  await ctx.db.run('DELETE FROM messages WHERE id = ?', messageId);

  ctx.body = `Message with id ${messageId} deleted`;
});


messagesRouter.put('/messages/:id', auth(), koaBody(), async (ctx) => {
  const messageId = ctx.params.id;
  const userId = ctx.state.jwtData.userId;
  const { created_at } = ctx.request.body;

  if (!created_at) {
    ctx.throw(400, 'New date is required');
    return;
  }

  const message = await ctx.db.get('SELECT * FROM messages WHERE id = ? AND user_id = ?', messageId, userId);

  if (!message) {
    ctx.throw(404, 'Message not found');
    return;
  }

  await ctx.db.run('UPDATE messages SET created_at = ? WHERE id = ?', created_at, messageId);

  ctx.body = `Message with id ${messageId} updated successfully`;
});



module.exports = messagesRouter;
