// parser.js
class ParseError extends Error { }

/**
 * 토크나이저
 * - 공백 제거
 * - A, B, (, ), ▷, ▶ 그대로 토큰화
 * - [2]+ (연속된 '2') 는 하나의 정수 리터럴(NUM)로 토큰화
 */
function tokenize(input) {
    const s = input.replace(/\s+/g, '');
    const tokens = [];
    for (let i = 0; i < s.length;) {
        const ch = s[i];
        if (ch === '2') {
            const start = i;
            while (i < s.length && s[i] === '2') i++;
            tokens.push({ t: 'NUM', v: BigInt(s.slice(start, i)) }); // "222" -> 222n
            continue;
        }
        if (ch === 'A' || ch === 'B' || ch === '(' || ch === ')' || ch === '▷' || ch === '▶') {
            tokens.push({ t: ch }); i++; continue;
        }
        throw new ParseError(`허용되지 않은 문자: ${JSON.stringify(ch)}`);
    }
    return tokens;
}

/**
 * Grammar (▷, ▶ 동일 우선순위 · 좌결합)
 * expr := term (op term)*
 * term := 'A' | 'B' | NUM | '(' expr ')'
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
                node = ['binop', op, node, rhs];
            } else break;
        }
        return node;
    }
    parseTerm() {
        const tok = this.peek();
        if (!tok) throw new ParseError('표현식이 비었습니다');
        if (tok.t === 'A') { this.eat(); return ['var', 'A']; }
        if (tok.t === 'B') { this.eat(); return ['var', 'B']; }
        if (tok.t === 'NUM') { const v = this.eat().v; return ['num', v]; }
        if (tok.t === '(') { this.eat('('); const n = this.parseExpr(); this.eat(')'); return n; }
        throw new ParseError(`잘못된 토큰: '${tok.t}'`);
    }
}

/** BigInt 헬퍼 */
const ONE = 1n, ZERO = 0n;
function maxBI(a, b) { return a > b ? a : b; }

/** A 이상 B 이하 양의 정수의 개수 */
function count_pos(L, U) {
    L = maxBI(L, ONE);
    if (U < L) return ZERO;
    return U - L + ONE;
}

/** A 이상 B 이하 양의 정수의 합 (없으면 0) */
function sum_pos(L, U) {
    L = maxBI(L, ONE);
    if (U < L) return ZERO;
    const n = U - L + ONE;
    const s = L + U;
    // (n*s)/2 (짝수 나눠 overflow 없이)
    if ((n & ONE) === ZERO) return (n / 2n) * s;
    else return n * (s / 2n);
}

function eval_ast(ast, A, B) {
    const k = ast[0];
    if (k === 'var') {
        const v = ast[1];
        if (v === 'A') return A;
        if (v === 'B') return B;
        throw new Error('알 수 없는 변수');
    }
    if (k === 'num') return ast[1];
    if (k === 'binop') {
        const op = ast[1], x = eval_ast(ast[2], A, B), y = eval_ast(ast[3], A, B);
        if (op === '▷') return count_pos(x, y);
        if (op === '▶') return sum_pos(x, y);
        throw new Error('알 수 없는 연산자');
    }
    throw new Error('잘못된 AST');
}

/** 외부 API */
function evalExpr(expr, A_num, B_num) {
    // 빠른 허용문자 스캔
    for (const ch of expr) {
        if (!'AB2()▷▶ \t\r\n'.includes(ch))
            throw new ParseError(`허용되지 않은 문자: ${JSON.stringify(ch)}`);
    }
    const ast = new Parser(tokenize(expr)).parse();
    const A = BigInt(A_num), B = BigInt(B_num);
    return eval_ast(ast, A, B); // BigInt
}

module.exports = { evalExpr, ParseError };
