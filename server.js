// =================================================================
// TypoLab Backend Server
// 역할:
// 1. public 폴더 안의 html, css, js 파일을 사용자에게 제공합니다.
// 2. .env 파일에 저장된 API 키를 안전하게 클라이언트(브라우저)에 전달합니다.
// =================================================================

const express = require('express');
const dotenv = require('dotenv');
const path = require('path');

// .env 파일의 환경 변수를 로드합니다.
dotenv.config();

const app = express();
const port = 3000;

// 'public' 폴더를 정적 파일 제공 폴더로 설정합니다.
app.use(express.static(path.join(__dirname, 'public')));

/**
 * @route   GET /api/key
 * @desc    .env 파일의 OpenAI API 키를 클라이언트에 JSON 형태로 전송합니다.
 */
app.get('/api/key', (req, res) => {
  // process.env를 통해 .env 파일의 변수에 접근합니다.
  res.json({ apiKey: process.env.OPENAI_API_KEY });
});

// 서버를 시작합니다.
app.listen(port, () => {
  console.log(`TypoLab 서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
