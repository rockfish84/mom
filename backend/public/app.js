document.addEventListener('DOMContentLoaded', () => {
  const $ = (s) => document.querySelector(s);

  const MAX_LEN = window.MAX_EXPR_LEN || 2000;
  const allowedRe = /^[AB2()▷▶\s]+$/;

  const exprEl = $('#expr');
  const validHint = $('#valid-hint');
  const lenHint = $('#len-hint');
  const btn = $('#submit-btn');
  const spinner = $('#spinner');
  const result = $('#result');

  if (!exprEl || !btn) return;

  function setValidState(ok, msg) {
    validHint.textContent = msg;
    validHint.className = ok ? 'ok' : 'bad';
    btn.disabled = !ok;          // ← 제출 가능/불가 강제
  }

  function updateHints() {
    const val = exprEl.value;
    lenHint.textContent = `${val.length}/${MAX_LEN}`;

    if (!val.length) return setValidState(false, '표현식을 입력해 주세요');
    if (val.length > MAX_LEN) return setValidState(false, `길이 초과(최대 ${MAX_LEN}자)`);

    // ✅ 공백 모두 제거 후, '22' 가 하나라도 있으면 제출 불가
    const compact = val.replace(/\s+/g, '');
    if (compact.includes('22')) {
      return setValidState(false, "제출 불가: 22, 222 같은 숫자는 사용할 수 없습니다");
    }

    if (!allowedRe.test(val)) {
      return setValidState(false, '허용되지 않은 문자가 포함되어 있습니다');
    }

    setValidState(true, '제출 가능');
  }

  exprEl.addEventListener('input', updateHints);
  updateHints();

  btn.addEventListener('click', onSubmit);

  async function onSubmit() {
    updateHints();
    if (btn.disabled) return;

    result.innerHTML = '';
    spinner.hidden = false;
    btn.disabled = true;

    try {
      const r = await fetch((window.API_BASE || '') + '/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expr: exprEl.value })
      });
      const data = await r.json().catch(() => ({}));

      if (!r.ok) return showError(data.detail || '요청 실패');

      if (data.ok) showSuccess(data.flag);
      else showNotOk(data); // code: 'syntax' | 'wrong'
    } catch {
      showError('네트워크 오류');
    } finally {
      spinner.hidden = true;
      btn.disabled = false;
    }
  }

  function showNotOk(data) {
    const msg = (data && data.code === 'syntax') ? '수식 오류입니다.' : '오답입니다.';
    result.innerHTML = `
      <div class="res-card bad">
        <div><strong>${msg}</strong></div>
      </div>`;
  }

  function showSuccess(flag) {
    result.innerHTML = `
      <div class="res-card good">
        <div><strong>정답입니다.</strong> 아래의 플래그를 제출하세요.</div>
        <div class="flag" id="flag-text">${escapeHtml(flag)}</div>
        <div style="margin-top:10px;">
          <button class="ghost" id="copy-flag">복사</button>
        </div>
      </div>`;
    document.getElementById('copy-flag')?.addEventListener('click', () => {
      const text = document.getElementById('flag-text').textContent;
      navigator.clipboard.writeText(text)
        .then(() => toast('복사되었습니다'))
        .catch(() => toast('복사 실패'));
    });
  }

  function showError(msg) {
    result.innerHTML = `
      <div class="res-card bad">
        <div><strong>오류</strong></div>
        <div style="margin-top:6px;">${escapeHtml(msg)}</div>
      </div>`;
  }

  function toast(message) {
    const el = document.createElement('div');
    el.textContent = message;
    el.style.cssText = `
      position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
      background: rgba(0,0,0,.75); color: #fff; padding: 10px 14px; border-radius: 10px;
      border: 1px solid rgba(255,255,255,.15); z-index: 9999;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"'`=\/]/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
    }[c]));
  }
});
