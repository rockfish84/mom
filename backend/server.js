// server.js
require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { evalExpr, ParseError } = require('./parser');

const app = express();
const dev = process.env.NODE_ENV !== 'production';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '8kb' }));

if (process.env.CORS_ENABLED === 'true') {
    app.use(cors({ origin: process.env.CORS_ORIGIN, methods: ['POST', 'GET'] }));
}

// 정적 캐시: 개발 no-store, 운영 1년
app.use('/public', express.static(
    path.join(__dirname, 'public'),
    dev
        ? {
            etag: false, lastModified: false, cacheControl: true, maxAge: 0,
            setHeaders: res => res.setHeader('Cache-Control', 'no-store')
        }
        : { immutable: true, maxAge: '1y' }
));

// 분당 2000회
const LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '2000', 10);
app.use('/api/', rateLimit({ windowMs: 60_000, max: LIMIT_MAX }));

const PORT = process.env.PORT || 3000;
const FLAG = process.env.FLAG || 'puple{demo-flag}';
const MAX_EXPR_LEN = parseInt(process.env.MAX_EXPR_LEN || '2000', 10);
const TEST_COUNT = 100;

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/healthz', (_req, res) => res.json({ ok: true }));

function genTests() {
    const arr = [];
    for (let i = 0; i < TEST_COUNT; i++) {
        const A = 1 + Math.floor(Math.random() * 1000);
        const B = 1 + Math.floor(Math.random() * 1000);
        arr.push([A, B]);
    }
    return arr;
}

app.post('/api/check', (req, res) => {
    const expr = (req.body && req.body.expr) || '';

    // ✅ 어떤 이유든 에러/제약이면 오답으로 통일
    if (typeof expr !== 'string' || expr.length === 0 || expr.length > MAX_EXPR_LEN) {
        return res.json({ ok: false, message: '오답입니다.' });
    }

    try {
        for (const [A, B] of genTests()) {
            const v = evalExpr(expr, A, B);
            if (v !== A * B) {
                return res.json({ ok: false, message: '오답입니다.' });
            }
        }
        return res.json({ ok: true, flag: FLAG });
    } catch (_e) {
        // ParseError, 기타 오류 모두 동일 응답
        return res.json({ ok: false, message: '오답입니다.' });
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`grader listening on :${PORT}`));
