// ============================================================
//  بنك امتحانات الثقافة المالية — محرك التطبيق
// ============================================================

const state = {
  screen: 'home',       // 'home' | 'exam' | 'results'
  examId: null,
  answers: {},           // { questionIndex: 'أ' }
  graded: false,
  history: {}            // { examId: [ {score, total, date}, ... ] }
};

const STORAGE_KEY_PREFIX = 'attempts:';

// ---------------- storage helpers (best score per exam) ----------------
async function loadBestScore(examId){
  try{
    const res = await window.storage.get(STORAGE_KEY_PREFIX + examId, false);
    if(res && res.value){
      return JSON.parse(res.value);
    }
  }catch(e){ /* no record yet */ }
  return null;
}

async function saveAttempt(examId, correctCount, total){
  const pct = Math.round((correctCount/total)*100);
  const record = { correctCount, total, pct, date: new Date().toISOString() };
  try{
    const prev = await loadBestScore(examId);
    if(!prev || pct >= prev.pct){
      await window.storage.set(STORAGE_KEY_PREFIX + examId, JSON.stringify(record), false);
    }
  }catch(e){ console.warn('storage unavailable', e); }
  return record;
}

// ---------------- utility ----------------
function findExam(id){ return EXAMS.find(e => e.id === id); }

function escapeHtml(str){
  return String(str)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

function shuffle(arr){
  // not used by default (keeps original order for fidelity), kept for potential future use
  return arr;
}

// ---------------- rendering ----------------
const appEl = document.getElementById('app');

function render(){
  if(state.screen === 'home') renderHome();
  else if(state.screen === 'exam') renderExam();
  else if(state.screen === 'results') renderResults();
  window.scrollTo({top:0, behavior:'instant'});
}

async function renderHome(){
  let cardsHtml = '';
  for(const exam of EXAMS){
    const best = await loadBestScore(exam.id);
    const bestHtml = best
      ? `<span class="best">أفضل نتيجة: ${best.correctCount}/${best.total} (${best.pct}%)</span>`
      : '';
    cardsHtml += `
      <div class="exam-card" data-exam="${exam.id}">
        <div class="index-bubble">${exam.questions.length}</div>
        <div class="info">
          <h3>${escapeHtml(exam.title)}</h3>
          <div class="meta">
            <span>✎ ${escapeHtml(exam.author || '')}</span>
            <span>◆ ${exam.questions.length} سؤال</span>
          </div>
          ${bestHtml}
        </div>
        <div class="chev">‹</div>
      </div>`;
  }

  appEl.innerHTML = `
    <div class="masthead">
      <div class="seal">دقّـة<br>وثقة</div>
      <div class="eyebrow">توجيهي · الثقافة المالية</div>
      <h1>بنك الامتحانات الإلكتروني</h1>
      <p class="tag">اختر امتحانًا لتبدأ — يُصحَّح تلقائيًا فور الانتهاء</p>
    </div>

    <div class="section-label">الامتحانات المتاحة</div>
    <div class="exam-grid">
      ${cardsHtml || '<div class="empty-note">لا توجد امتحانات بعد.</div>'}
    </div>

    <footer class="credit">صُمم لمراجعة مادة الثقافة المالية — جميع الأسئلة موثّقة من مصادرها الأصلية</footer>
  `;

  appEl.querySelectorAll('.exam-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      startExam(card.dataset.exam);
    });
  });
}

function startExam(examId){
  state.screen = 'exam';
  state.examId = examId;
  state.answers = {};
  state.graded = false;
  render();
}

function renderExam(){
  const exam = findExam(state.examId);
  const total = exam.questions.length;
  const answeredCount = Object.keys(state.answers).length;
  const pct = Math.round((answeredCount/total)*100);

  let qHtml = '';
  exam.questions.forEach((q, idx)=>{
    const letters = Object.keys(q.choices);
    const selected = state.answers[idx];
    let choicesHtml = '';
    letters.forEach(letter=>{
      const isSelected = selected === letter;
      choicesHtml += `
        <div class="choice ${isSelected ? 'selected' : ''}" data-idx="${idx}" data-letter="${letter}">
          <div class="bubble">${letter}</div>
          <div class="ctext">${escapeHtml(q.choices[letter])}</div>
        </div>`;
    });
    qHtml += `
      <div class="q-card" id="q-${idx}" data-idx="${idx}">
        <div class="q-head">
          <div class="q-num">${idx+1}</div>
          <div class="q-stem">${escapeHtml(q.q)}</div>
        </div>
        <div class="choices">${choicesHtml}</div>
      </div>`;
  });

  appEl.innerHTML = `
    <div class="topbar">
      <button class="backbtn" id="btn-back">→ رجوع</button>
      <div class="exam-title">${escapeHtml(exam.title)}</div>
      <div class="progress-wrap">
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-text">${answeredCount} من ${total} مجاب</div>
      </div>
    </div>
    <div id="q-list">${qHtml}</div>
    <div class="unanswered-note" id="unanswered-note"></div>
    <div class="submit-bar">
      <button class="btn-primary" id="btn-submit">تصحيح الامتحان ✓</button>
    </div>
  `;

  document.getElementById('btn-back').addEventListener('click', ()=>{
    if(confirm('هل تريد العودة؟ لن يتم حفظ إجاباتك الحالية.')){
      state.screen='home'; render();
    }
  });

  document.querySelectorAll('.choice').forEach(el=>{
    el.addEventListener('click', ()=>{
      const idx = el.dataset.idx;
      const letter = el.dataset.letter;
      state.answers[idx] = letter;
      renderExam(); // re-render to reflect selection + progress
      document.getElementById(`q-${idx}`).scrollIntoView({block:'nearest', behavior:'instant'});
    });
  });

  document.getElementById('btn-submit').addEventListener('click', gradeExam);
}

async function gradeExam(){
  const exam = findExam(state.examId);
  const total = exam.questions.length;
  const answeredCount = Object.keys(state.answers).length;

  if(answeredCount < total){
    const note = document.getElementById('unanswered-note');
    const missing = total - answeredCount;
    note.textContent = `تبقّى ${missing} سؤالًا بلا إجابة. يمكنك إكمالها أو المتابعة للتصحيح.`;
    if(!document.getElementById('btn-force-submit')){
      const bar = document.querySelector('.submit-bar');
      const forceBtn = document.createElement('button');
      forceBtn.className = 'btn-ghost';
      forceBtn.id = 'btn-force-submit';
      forceBtn.style.marginRight = '10px';
      forceBtn.textContent = 'صحّح رغم النقص';
      forceBtn.addEventListener('click', finalizeGrading);
      bar.appendChild(forceBtn);
    }
    return;
  }
  finalizeGrading();
}

async function finalizeGrading(){
  const exam = findExam(state.examId);
  let correctCount = 0;
  exam.questions.forEach((q, idx)=>{
    if(state.answers[idx] === q.correct) correctCount++;
  });
  state.graded = true;
  state.lastResult = { correctCount, total: exam.questions.length };
  await saveAttempt(exam.id, correctCount, exam.questions.length);
  state.screen = 'results';
  state.reviewFilter = 'all';
  render();
}

function renderResults(){
  const exam = findExam(state.examId);
  const { correctCount, total } = state.lastResult;
  const pct = Math.round((correctCount/total)*100);
  const wrongCount = total - correctCount;

  let pctClass = 'bad';
  let encouragement = 'محاولة جيدة، راجع الأسئلة الخاطئة وأعد المحاولة!';
  if(pct >= 85){ pctClass='good'; encouragement='ممتاز! إتقان واضح للمادة.'; }
  else if(pct >= 60){ pctClass='mid'; encouragement='جيد، مع القليل من المراجعة ستتقنها بالكامل.'; }

  let reviewHtml = '';
  exam.questions.forEach((q, idx)=>{
    const userAns = state.answers[idx];
    const isCorrect = userAns === q.correct;
    if(state.reviewFilter === 'wrong' && isCorrect) return;

    let choicesHtml = '';
    Object.keys(q.choices).forEach(letter=>{
      let cls = '';
      if(letter === q.correct) cls = 'correct-answer';
      else if(letter === userAns && !isCorrect) cls = 'wrong-answer';
      choicesHtml += `
        <div class="choice ${cls}">
          <div class="bubble">${letter}</div>
          <div class="ctext">${escapeHtml(q.choices[letter])}</div>
        </div>`;
    });

    reviewHtml += `
      <div class="q-card graded">
        <div class="q-head">
          <div class="q-num" style="background:${isCorrect ? 'var(--correct)' : 'var(--incorrect)'}">${idx+1}</div>
          <div class="q-stem">${escapeHtml(q.q)}</div>
        </div>
        <div class="choices">${choicesHtml}</div>
      </div>`;
  });

  appEl.innerHTML = `
    <div class="topbar">
      <button class="backbtn" id="btn-home">→ الرئيسية</button>
      <div class="exam-title">نتيجة: ${escapeHtml(exam.title)}</div>
    </div>

    <div class="result-hero">
      <div class="stamp">
        <div class="score-num">${correctCount}/${total}</div>
        <div class="score-den">إجابة صحيحة</div>
      </div>
      <h2>النتيجة النهائية</h2>
      <div class="pct ${pctClass}">${pct}%</div>
      <div class="encouragement">${encouragement} (${wrongCount} إجابة خاطئة)</div>
      <div class="result-actions">
        <button class="btn-primary" id="btn-retry">إعادة المحاولة</button>
        <button class="btn-ghost" id="btn-home2">العودة للرئيسية</button>
      </div>
    </div>

    <div class="filter-row">
      <div class="filter-chip ${state.reviewFilter==='all'?'active':''}" data-f="all">كل الأسئلة (${total})</div>
      <div class="filter-chip ${state.reviewFilter==='wrong'?'active':''}" data-f="wrong">الأخطاء فقط (${wrongCount})</div>
    </div>

    <div id="review-list">${reviewHtml}</div>

    <footer class="credit">صُمم لمراجعة مادة الثقافة المالية</footer>
  `;

  document.getElementById('btn-home').addEventListener('click', ()=>{ state.screen='home'; render(); });
  document.getElementById('btn-home2').addEventListener('click', ()=>{ state.screen='home'; render(); });
  document.getElementById('btn-retry').addEventListener('click', ()=>{ startExam(exam.id); });
  document.querySelectorAll('.filter-chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      state.reviewFilter = chip.dataset.f;
      renderResults();
    });
  });
}

// ---------------- init ----------------
render();
