/**
 * gpa-calculator.js — COMSATS PLUS GPA Calculator UI Controller
 *
 * DOM layer and overall aggregator logic.
 */
(function initCalculatorUI() {
  'use strict';

  const Logic = window.GpaLogic;

  if (!Logic) {
    console.error('[GPA Calculator] GpaLogic not loaded.');
    return;
  }

  const addedSubjects = [];
  let nextSubjectId = 1;

  const form = document.getElementById('subject-form');
  const hasLabCb = document.getElementById('has-lab');
  const labSection = document.getElementById('lab-section');
  const subjectsList = document.getElementById('subjects-list');
  const emptyState = document.getElementById('empty-state');
  const calcGpaBtn = document.getElementById('calc-overall-btn');
  const overallResult = document.getElementById('overall-result');
  const overallGpaEl = document.getElementById('overall-gpa');
  const overallLblEl = document.getElementById('overall-label');
  const overallPerfEl = document.getElementById('overall-perf');
  const resetBtn = document.getElementById('reset-all-btn');
  const clearFormBtn = document.getElementById('clear-form-btn');
  const formErrors = document.getElementById('form-errors');
  const emptyStateCta = document.getElementById('empty-state-cta');

  const courseCreditHoursEl = document.getElementById('course-credit-hours');
  const labMarksSettings = document.getElementById('lab-marks-settings');

  const dynamicMarksInputs = [
    'assignment-max',
    'assignment-weight',
    'quiz-max',
    'quiz-weight',
    'theory-mid-max',
    'theory-mid-weight',
    'theory-final-max',
    'theory-final-weight',
    'lab-assignment-max',
    'lab-assignment-weight',
    'lab-mid-max',
    'lab-mid-weight',
    'lab-final-max',
    'lab-final-weight',
  ]
    .map(id => document.getElementById(id))
    .filter(Boolean);

  function readMarkScheme() {
    return {
      theory: {
        assignmentMax: readNumberInput('assignment-max') || 12.5,
        assignmentWeight: readNumberInput('assignment-weight') || 12.5,
        quizMax: readNumberInput('quiz-max') || 10,
        quizWeight: readNumberInput('quiz-weight') || 12.5,
        midMax: readNumberInput('theory-mid-max') || 25,
        midWeight: readNumberInput('theory-mid-weight') || 25,
        finalMax: readNumberInput('theory-final-max') || 50,
        finalWeight: readNumberInput('theory-final-weight') || 50,
      },
      lab: {
        assignmentMax: readNumberInput('lab-assignment-max') || 12.5,
        assignmentWeight: readNumberInput('lab-assignment-weight') || 25,
        midMax: readNumberInput('lab-mid-max') || 25,
        midWeight: readNumberInput('lab-mid-weight') || 25,
        finalMax: readNumberInput('lab-final-max') || 50,
        finalWeight: readNumberInput('lab-final-weight') || 50,
      },
    };
  }

  function setInputMax(inputId, maxValue) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.max = String(maxValue);
    input.step = '0.1';

    const currentValue = Logic.toNum(input.value, 0);

    if (input.value !== '' && currentValue > maxValue) {
      input.classList.add('is-invalid');
    }
  }

  function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  function syncDynamicMarksUI() {
    const scheme = readMarkScheme();

    for (let i = 1; i <= 4; i += 1) {
      setInputMax(`assignment-${i}`, scheme.theory.assignmentMax);
      setInputMax(`quiz-${i}`, scheme.theory.quizMax);
      setInputMax(`lab-assignment-${i}`, scheme.lab.assignmentMax);
    }

    setInputMax('theory-mid', scheme.theory.midMax);
    setInputMax('theory-final', scheme.theory.finalMax);
    setInputMax('lab-mid', scheme.lab.midMax);
    setInputMax('lab-final', scheme.lab.finalMax);

    setText('assignment-max-label', `(max ${scheme.theory.assignmentMax} each, weight ${scheme.theory.assignmentWeight})`);
    setText('quiz-max-label', `(max ${scheme.theory.quizMax} each, weight ${scheme.theory.quizWeight})`);
    setText('theory-mid-max-label', `(max ${scheme.theory.midMax}, weight ${scheme.theory.midWeight})`);
    setText('theory-final-max-label', `(max ${scheme.theory.finalMax}, weight ${scheme.theory.finalWeight})`);

    setText('lab-assignment-max-label', `(max ${scheme.lab.assignmentMax} each, weight ${scheme.lab.assignmentWeight})`);
    setText('lab-mid-max-label', `(max ${scheme.lab.midMax}, weight ${scheme.lab.midWeight})`);
    setText('lab-final-max-label', `(max ${scheme.lab.finalMax}, weight ${scheme.lab.finalWeight})`);
  }

  function syncLabMode() {
    const isChecked = hasLabCb.checked;

    hasLabCb.setAttribute('aria-checked', isChecked.toString());
    labSection.classList.toggle('hidden', !isChecked);

    if (labMarksSettings) {
      labMarksSettings.classList.toggle('hidden', !isChecked);
    }

    syncDynamicMarksUI();
  }

  hasLabCb.addEventListener('change', syncLabMode);

  dynamicMarksInputs.forEach(input => {
    input.addEventListener('input', syncDynamicMarksUI);
  });

  setTimeout(syncLabMode, 0);

  if (!form || !hasLabCb || !subjectsList) {
    console.error('[GPA Calculator] Required elements are missing.');
    return;
  }

  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const labLabel = document.querySelector('label[for="has-lab"]');
  if (labLabel) {
    labLabel.setAttribute('tabindex', '0');
    labLabel.addEventListener('keydown', event => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        hasLabCb.checked = !hasLabCb.checked;
        hasLabCb.dispatchEvent(new Event('change'));
      }
    });
  }

  const gradingDetails = document.getElementById('grading-scale-details');
  const gradingSummary = document.getElementById('grading-scale-summary');
  if (gradingDetails && gradingSummary) {
    gradingDetails.addEventListener('toggle', () => {
      gradingSummary.setAttribute('aria-expanded', String(gradingDetails.open));
    });
  }

  if (emptyStateCta) {
    emptyStateCta.addEventListener('click', () => {
      document.getElementById('subject-name')?.focus();
    });
  }

  if (clearFormBtn) {
    clearFormBtn.addEventListener('click', resetFormCompletely);
  }

  const allInputs = form.querySelectorAll('input[type="number"]');
  allInputs.forEach(input => {
    input.addEventListener('input', event => {
      const el = event.target;
      const value = parseFloat(el.value);
      const max = parseFloat(el.max || '100');
      const min = parseFloat(el.min || '0');

      const inlineError = el.parentElement.querySelector('.field-error');
      if (inlineError) inlineError.remove();

      if (!Number.isNaN(value) && value >= min && value <= max) {
        const progress = (value / max) * 100;
        el.style.setProperty('--progress', `${progress}%`);
        el.classList.remove('is-invalid');
        el.classList.add('is-valid');
      } else if (el.value === '') {
        el.style.setProperty('--progress', '0%');
        el.classList.remove('is-invalid', 'is-valid');
      } else {
        el.style.setProperty('--progress', '0%');
        el.classList.add('is-invalid');
        el.classList.remove('is-valid');
      }
    });
  });

  function validateForm() {
    const errors = [];
    document.querySelectorAll('.field-error').forEach(el => el.remove());

    allInputs.forEach(input => {
      if (input.closest('.hidden')) return;

      const value = parseFloat(input.value);
      const max = parseFloat(input.max || '100');
      const min = parseFloat(input.min || '0');
      const label = input.previousElementSibling?.textContent?.trim() || input.id;

      if (input.value !== '' && (Number.isNaN(value) || value < min || value > max)) {
        errors.push(`${label} must be between ${min} and ${max}.`);
        input.classList.add('is-invalid');

        const errorEl = document.createElement('p');
        errorEl.className = 'field-error';
        errorEl.textContent = `Must be ${min}-${max}`;
        input.parentElement.appendChild(errorEl);
      }
    });

    return errors;
  }

  form.addEventListener('submit', event => {
    event.preventDefault();

    formErrors.classList.add('hidden');
    formErrors.innerHTML = '';

    const errors = validateForm();

    if (errors.length > 0) {
      formErrors.innerHTML =
        `<strong>Please fix the following errors:</strong><ul class="list-disc pl-5 mt-1">` +
        errors.map(error => `<li>${escHtml(error)}</li>`).join('') +
        `</ul>`;

      formErrors.classList.remove('hidden');
      return;
    }

    handleAddSubject();
  });

  function readNumberInput(id) {
    const el = document.getElementById(id);
    return el ? Logic.toNum(el.value, 0) : 0;
  }

  function readArrayInputs(prefix, count) {
    return Array.from({ length: count }, (_, index) => readNumberInput(`${prefix}-${index + 1}`));
  }

  function handleAddSubject() {
    const subjectNameInput = document.getElementById('subject-name');
    const subjectName = subjectNameInput?.value.trim() || 'Unnamed Subject';
    const hasLab = hasLabCb.checked;

    const creditHours = Math.max(Logic.toNum(courseCreditHoursEl?.value, 3), 0.5);
    const markScheme = readMarkScheme();

    const theoryFields = {
      assignments: readArrayInputs('assignment', 4),
      quizzes: readArrayInputs('quiz', 4),
      mid: readNumberInput('theory-mid'),
      final: readNumberInput('theory-final'),
    };

    const labFields = hasLab
      ? {
          labAssignments: readArrayInputs('lab-assignment', 4),
          labMid: readNumberInput('lab-mid'),
          labFinal: readNumberInput('lab-final'),
        }
      : null;

    const theoryTotal = Logic.calcTheoryTotal(theoryFields, markScheme.theory);
    const labTotal = hasLab ? Logic.calcLabTotal(labFields, markScheme.lab) : 0;
    const finalPct = Logic.calcFinalPercentage(theoryTotal, labTotal, hasLab, creditHours, 1);
    const gradeInfo = Logic.getGradeInfo(finalPct);

    const newSubject = {
      id: nextSubjectId++,
      name: subjectName,
      creditHours,
      percentage: finalPct,
      gpa: gradeInfo.point,
      letter: gradeInfo.letter,
      hasLab,
      theoryTotal,
      labTotal,
    };

    addedSubjects.push(newSubject);

    renderSubjectCard(newSubject, addedSubjects.length);
    resetFormKeepName();

    calcGpaBtn.classList.remove('hidden');
    calcGpaBtn.classList.add('is-pulsing');
    resetBtn.classList.remove('hidden');
    overallResult.classList.add('hidden');

    subjectsList.setAttribute('aria-label', `Added ${subjectName} with ${creditHours} credit hours and GPA ${gradeInfo.point}`);
  }

  function renderSubjectCard(subject, orderIndex) {
    emptyState.classList.add('hidden');

    const card = document.createElement('li');
    card.id = `subject-card-${subject.id}`;

    const delayClass = `slide-delay-${Math.min(orderIndex, 5)}`;
    const badgeColor = getGradeBadgeColor(subject.letter);

    card.className = [
      'subject-card',
      'flex items-start justify-between gap-4',
      'bg-white dark:bg-slate-800',
      'border border-slate-100 dark:border-slate-700',
      'rounded-2xl p-5 shadow-sm',
      'animate-slide-in',
      delayClass,
      'group/card hover:-translate-y-0.5 hover:shadow-md hover:border-teal-200 dark:hover:border-teal-800 transition-all',
    ].join(' ');

    card.innerHTML = `
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <p class="font-semibold text-slate-800 dark:text-slate-100 truncate text-sm" title="${escHtml(subject.name)}">
            ${escHtml(subject.name)}
          </p>
          <button type="button" class="delete-btn opacity-0 group-hover/card:opacity-100 transition-opacity text-slate-400 hover:text-rose-500 focus:opacity-100 p-1" data-id="${subject.id}" aria-label="Delete ${escHtml(subject.name)}">
            <span class="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        <div class="mt-1.5 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Credits: <strong class="text-slate-700 dark:text-slate-200">${subject.creditHours.toFixed(1)}</strong></span>
          <span>Theory: <strong class="text-slate-700 dark:text-slate-200">${subject.theoryTotal.toFixed(1)}%</strong></span>
          ${subject.hasLab ? `<span>Lab: <strong class="text-slate-700 dark:text-slate-200">${subject.labTotal.toFixed(1)}%</strong></span>` : ''}
          <span>Final: <strong class="text-slate-700 dark:text-slate-200">${subject.percentage.toFixed(2)}%</strong></span>
        </div>
      </div>

      <div class="flex flex-col items-end gap-1 shrink-0">
        <span class="inline-flex items-center justify-center w-10 h-10 rounded-xl text-sm font-bold ${badgeColor}">
          ${escHtml(subject.letter)}
        </span>
        <span class="text-xs font-semibold text-slate-600 dark:text-slate-300">
          ${subject.gpa.toFixed(2)} GPA
        </span>
      </div>
    `;

    subjectsList.appendChild(card);

    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => handleDeleteSubject(subject.id));
  }

  function handleDeleteSubject(id) {
    const index = addedSubjects.findIndex(subject => subject.id === id);
    if (index === -1) return;

    addedSubjects.splice(index, 1);

    const card = document.getElementById(`subject-card-${id}`);
    if (!card) return;

    card.style.opacity = '0';
    card.style.transform = 'translateY(-10px)';
    card.style.pointerEvents = 'none';

    window.setTimeout(() => {
      card.remove();

      if (addedSubjects.length === 0) {
        emptyState.classList.remove('hidden');
        calcGpaBtn.classList.add('hidden');
        resetBtn.classList.add('hidden');
        overallResult.classList.add('hidden');
      } else {
        calcGpaBtn.classList.add('is-pulsing');
        overallResult.classList.add('hidden');
      }
    }, 200);
  }

  function getGradeBadgeColor(letter) {
    const map = {
      A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
      'A-': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
      'B+': 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
      B: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
      'B-': 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
      'C+': 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
      C: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
      'C-': 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
      'D+': 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300',
      D: 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300',
      F: 'bg-rose-200 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300',
    };

    return map[letter] || 'bg-slate-100 text-slate-600';
  }

  calcGpaBtn.addEventListener('click', () => {
    if (!addedSubjects.length) return;

    const avg = Logic.calcOverallGpa(addedSubjects);
    const weightedPercentage = Logic.calcOverallPercentage(addedSubjects);
    const totalCredits = Logic.calcTotalCredits(addedSubjects);
    const honorPoints = Logic.calcHonorPoints(addedSubjects);

    overallGpaEl.textContent = avg.toFixed(2);
    overallLblEl.textContent = Logic.getGradeInfo(weightedPercentage).letter;
    overallPerfEl.textContent =
      `${Logic.getPerformanceLabel(avg)} Total Credits: ${totalCredits.toFixed(1)} | Honor Points: ${honorPoints.toFixed(2)}`;

    overallResult.classList.remove('hidden');
    calcGpaBtn.classList.remove('is-pulsing');
    overallResult.setAttribute('aria-live', 'assertive');
    overallResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  resetBtn.addEventListener('click', () => {
    if (!window.confirm('Clear all added subjects and start over?')) return;

    addedSubjects.length = 0;

    Array.from(subjectsList.children).forEach(child => {
      if (child.id !== 'empty-state') child.remove();
    });

    emptyState.classList.remove('hidden');
    overallResult.classList.add('hidden');
    calcGpaBtn.classList.add('hidden');
    resetBtn.classList.add('hidden');
    resetFormCompletely();
  });

  function resetFormKeepName() {
    const subjectNameInput = document.getElementById('subject-name');
    const name = subjectNameInput?.value || '';

    form.reset();

    if (subjectNameInput) subjectNameInput.value = name;

    hasLabCb.checked = false;
    syncLabMode();
    syncDynamicMarksUI();
    formErrors.classList.add('hidden');

    clearValidationStates();
  }

  function resetFormCompletely() {
    form.reset();

    hasLabCb.checked = false;
    syncLabMode();
    syncDynamicMarksUI();
    formErrors.classList.add('hidden');

    clearValidationStates();

    document.getElementById('subject-name')?.focus();
  }

  function clearValidationStates() {
    allInputs.forEach(input => {
      input.classList.remove('is-valid', 'is-invalid');
      input.style.setProperty('--progress', '0%');
    });

    document.querySelectorAll('.field-error').forEach(el => el.remove());
  }
})();
