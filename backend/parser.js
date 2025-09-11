// parser.js
class ParseError extends Error { }

// 공백 제거 후 허용 문자만 토큰화
function tokenize(input) {
    const s = input.replace(/\s+/g, '');
    const tokens = [];
    for (let i = 0; i < s.length;) {
        const ch = s[i];
        if (ch === '2') {
            // ✅ 2가 여러 개 연속이어도 하나의 '2' 토큰으로 처리
            while (i < s.length && s[i] === '2') i++;
            tokens.push({ t: '2' });
            continue;
        }
        if ('AB()▷▶'.includes(ch)) {
            tokens.push({ t: ch });
            i++;
            continue;
        }
        throw new ParseError(`허용되지 않은 문자: ${JSON.stringify(ch)}`);
    }
    return tokens;
}

/**
 * Grammar (▷, ▶ 동일 우선순위·좌결합)
 * expr := term (op term)*
 * term := 'A' | 'B' | '2' | '(' expr ')'
 * op   := '▷' | '▶'
 */
class Parser {
    constructor(tokens) { this.toks = tokens; this.pos = 0; }
    peek() { return this.pos < this.toks.length ? this.toks[this.pos] : null; }
    eat(t = null) {
        const tok = this.peek();
        if (!tok) throw new ParseError('입력이 예상보다 짧습니다');
        if (t !== null && tok.t !== t) throw new ParseError(`'${t}'를 기대했으나 '${tok.t}'`);
        this.pos++; return tok;
    }
    parse() {
        const node = this.parseExpr();
        if (this.peek() !== null) throw new ParseError('여분의 토큰이 있습니다');
        return node;
    }
    parseExpr() {
        let node = this.parseTerm();
        while (true) {
            const tok = this.peek();
            if (tok && (tok.t === '▷' || tok.t === '▶')) {
                const op = this.eat().t, rhs = this.parseTerm();
                node = ['binop', op, node, rhs]; // 좌결합
            } else break;
        }
        return node;
    }
    parseTerm() {
        const tok = this.peek();
        if (!tok) throw new ParseError('표현식이 비었습니다');
        if (tok.t === 'A' || tok.t === 'B' || tok.t === '2') { this.eat(); return ['var', tok.t]; }
        if (tok.t === '(') { this.eat('('); const n = this.parseExpr(); this.eat(')'); return n; }
        throw new ParseError(`잘못된 토큰: '${tok.t}'`);
    }
}

function countPos(L, U) { L = Math.max(L, 1); if (U < L) return 0; return U - L + 1; }
function sumPos(L, U) { L = Math.max(L, 1); if (U < L) return 0; const n = U - L + 1; return Math.floor((n * (L + U)) / 2); }

function evalAst(ast, A, B) {
    const k = ast[0];
    if (k === 'var') { const v = ast[1]; if (v === 'A') return A; if (v === 'B') return B; if (v === '2') return 2; throw new Error('알 수 없는 변수'); }
    if (k === 'binop') {
        const op = ast[1], x = evalAst(ast[2], A, B), y = evalAst(ast[3], A, B);
        if (op === '▷') return countPos(x, y);
        if (op === '▶') return sumPos(x, y);
        throw new Error('알 수 없는 연산자');
    }
    throw new Error('잘못된 AST');
}

function evalExpr(expr, A, B) {
    // 허용 문자 빠른 검사(연속된 '2'도 통과)
    for (const ch of expr) {
        if (!'AB2()▷▶ \t\r\n'.includes(ch)) {
            throw new ParseError(`허용되지 않은 문자: ${JSON.stringify(ch)}`);
        }
    }
    const ast = new Parser(tokenize(expr)).parse();
    return evalAst(ast, A, B);
}

module.exports = { evalExpr, ParseError };
