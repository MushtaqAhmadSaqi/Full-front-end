/**
 * gpa-calculator.js — UI Controller
 *
 * Manages the two-column form+results interface.
 * Reads from window.GpaLogic for all business logic.
 * No logic lives here — only DOM manipulation and event handling.
 */
(function initCalculatorUI() {
  'use strict';

  const Logic = window.GpaLogic;

  if (!Logic) {
    console.error('[GPA Calculator] GpaLogic not loaded. Ensure gpa-logic.js is included first.');
    return;
  }

  /* ── State ─────────────────────────────────── */
  /** @type {Array<{ name: string, percentage: number, gpa: number, letter: string }>} */
  const addedSubjects = [];

  /* ── DOM References ─────────────────────────── */
  const form         = document.getElementById('subject-form');
  const hasLabCb     = document.getElementById('has-lab');
  const labSection   = document.getElementById('lab-section');
  const subjectsList = document.getElementById('subjects-list');
  const emptyState   = document.getElementById('empty-state');
  const calcGpaBtn   = document.getElementById('calc-overall-btn');
  const overallResult= document.getElementById('overall-result');
  const overallGpaEl = document.getElementById('overall-gpa');
  const overallLblEl = document.getElementById('overall-label');
  const overallPerfEl= document.getElementById('overall-perf');
  const resetBtn     = document.getElementById('reset-all-btn');

  /* ── Lab toggle ─────────────────────────────── */
  hasLabCb.addEventListener('change', () => {
    if (hasLabCb.checked) {
      labSection.classList.remove('hidden');
    } else {
      labSection.classList.add('hidden');
    }
  });

  /* ── Form submit ─────────────────────────────── */
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleAddSubject();
  });

  function readNumberInput(id) {
    const el = document.getElementById(id);
    return el ? Logic.toNum(el.value, 0) : 0;
  }

  function readArrayInputs(prefix, count) {
    return Array.from({ length: count }, (_, i) => readNumberInput(`${prefix}-${i + 1}`));
  }

  function handleAddSubject() {
    const subjectName = document.getElementById('subject-name').value.trim() || 'Unnamed Subject';
    const hasLab = hasLabCb.checked;

    /* Read theory fields */
    const theoryFields = {
      assignments: readArrayInputs('assignment', 4),
      quizzes:     readArrayInputs('quiz', 4),
      mid:         readNumberInput('theory-mid'),
      final:       readNumberInput('theory-final'),
    };

    /* Read lab fields */
    const labFields = hasLab ? {
      labAssignments: readArrayInputs('lab-assignment', 4),
      labMid:         readNumberInput('lab-mid'),
      labFinal:       readNumberInput('lab-final'),
    } : null;

    /* Calculate */
    const theoryTotal = Logic.calcTheoryTotal(theoryFields);
    const labTotal    = hasLab ? Logic.calcLabTotal(labFields) : 0;
    const finalPct    = Logic.calcFinalPercentage(theoryTotal, labTotal, hasLab);
    const gradeInfo   = Logic.getGradeInfo(finalPct);

    /* Append to state */
    addedSubjects.push({
      name:       subjectName,
      percentage: finalPct,
      gpa:        gradeInfo.point,
      letter:     gradeInfo.letter,
      hasLab,
      theoryTotal,
      labTotal,
    });

    /* Update UI */
    renderSubjectCard(addedSubjects[addedSubjects.length - 1], addedSubjects.length - 1);
    resetForm();

    /* Show overall button only when ≥1 subject */
    calcGpaBtn.classList.remove('hidden');
    resetBtn.classList.remove('hidden');
    overallResult.classList.add('hidden'); // hide stale result until recalculated
  }

  /* ── Render a subject card on the right side ─── */
  function renderSubjectCard(subject, index) {
    emptyState.classList.add('hidden');

    const card = document.createElement('div');
    card.id = `subject-card-${index}`;
    card.className = [
      'subject-card',
      'flex items-start justify-between gap-3',
      'bg-white dark:bg-slate-800',
      'border border-slate-100 dark:border-slate-700',
      'rounded-2xl p-4 shadow-sm',
      'animate-slide-in',
    ].join(' ');

    const badgeColor = getGradeBadgeColor(subject.letter);

    card.innerHTML = `
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-slate-800 dark:text-slate-100 truncate text-sm">${escHtml(subject.name)}</p>
        <div class="mt-1.5 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Theory: <strong class="text-slate-700 dark:text-slate-200">${subject.theoryTotal.toFixed(1)}%</strong></span>
          ${subject.hasLab ? `<span>Lab: <strong class="text-slate-700 dark:text-slate-200">${subject.labTotal.toFixed(1)}%</strong></span>` : ''}
          <span>Final: <strong class="text-slate-700 dark:text-slate-200">${subject.percentage.toFixed(2)}%</strong></span>
        </div>
      </div>
      <div class="flex flex-col items-end gap-1 shrink-0">
        <span class="inline-flex items-center justify-center w-10 h-10 rounded-xl text-sm font-bold ${badgeColor}">${escHtml(subject.letter)}</span>
        <span class="text-xs font-semibold text-slate-600 dark:text-slate-300">${subject.gpa.toFixed(2)} GPA</span>
      </div>
    `;

    subjectsList.appendChild(card);
  }

  /* ── Grade badge colors ─────────────────────── */
  function getGradeBadgeColor(letter) {
    const map = {
      'A':  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
      'A-': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
      'B+': 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
      'B':  'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
      'B-': 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
      'C+': 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
      'C':  'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
      'C-': 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
      'D+': 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300',
      'D':  'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300',
      'F':  'bg-rose-200 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300',
    };
    return map[letter] || 'bg-slate-100 text-slate-600';
  }

  /* ── Calculate & display overall GPA ─────────── */
  calcGpaBtn.addEventListener('click', () => {
    if (!addedSubjects.length) return;

    const avg = Logic.round2(
      addedSubjects.reduce((sum, s) => sum + s.gpa, 0) / addedSubjects.length
    );

    overallGpaEl.textContent = avg.toFixed(2);
    overallLblEl.textContent = Logic.getGradeInfo(
      // Map GPA back to a representative % for letter lookup
      addedSubjects.reduce((sum, s) => sum + s.percentage, 0) / addedSubjects.length
    ).letter;
    overallPerfEl.textContent = Logic.getPerformanceLabel(avg);

    overallResult.classList.remove('hidden');
    overallResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  /* ── Reset all ──────────────────────────────── */
  resetBtn.addEventListener('click', () => {
    if (!confirm('Clear all added subjects and start over?')) return;
    addedSubjects.length = 0;
    subjectsList.innerHTML = '';
    subjectsList.appendChild(emptyState);
    emptyState.classList.remove('hidden');
    overallResult.classList.add('hidden');
    calcGpaBtn.classList.add('hidden');
    resetBtn.classList.add('hidden');
    resetForm();
  });

  /* ── Reset the left-side form ───────────────── */
  function resetForm() {
    form.reset();
    hasLabCb.checked = false;
    labSection.classList.add('hidden');
  }

  /* ── XSS helper ─────────────────────────────── */
  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
