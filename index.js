require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const logger = require('./logger');

const router = require('./router');

const app = express();

app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: 'your-secret-key', // 用于对会话数据进行加密的密钥，建议使用随机字符串
  resave: false, // 是否在每次请求时重新保存会话数据
  saveUninitialized: false, // 是否自动保存未初始化的会话数据
}));

app.use('/v1', router);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.use(express.static(path.join(__dirname, '/public')));

app.listen(3000, () => {
  logger.log('App listening on port 3000.');
});
