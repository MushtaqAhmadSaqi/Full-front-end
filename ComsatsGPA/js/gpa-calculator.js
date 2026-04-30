/**
 * gpa-calculator.js — COMSATS PLUS GPA Calculator UI Controller
 *
 * DOM layer and overall aggregator logic with dynamic rows and live preview.
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

  const liveBadge = document.getElementById('live-preview-badge');
  const liveGpaEl = document.getElementById('live-gpa');

  function readMarkScheme() {
    return {
      theory: {
        assignmentWeight: readNumberInput('assignment-weight') || 12.5,
        quizWeight: readNumberInput('quiz-weight') || 12.5,
        midWeight: readNumberInput('theory-mid-weight') || 25,
        finalWeight: readNumberInput('theory-final-weight') || 50,
      },
      lab: {
        assignmentWeight: readNumberInput('lab-assignment-weight') || 25,
        midWeight: readNumberInput('lab-mid-weight') || 25,
        finalWeight: readNumberInput('lab-final-weight') || 50,
      },
    };
  }

  function syncLabMode() {
    const isChecked = hasLabCb.checked;
    hasLabCb.setAttribute('aria-checked', isChecked.toString());
    labSection.classList.toggle('hidden', !isChecked);
    if (labMarksSettings) labMarksSettings.classList.toggle('hidden', !isChecked);
    updateLivePreview();
  }

  // --- Dynamic Row Management ---

  function addDynamicRow(containerId, type) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'dynamic-row';
    
    let defaultTotal = '10';
    if (type === 'assignment' || type === 'lab-assignment') defaultTotal = '12.5';

    row.innerHTML = `
      <div><input type="number" step="0.5" class="gpa-input ${type}-obtained" placeholder="Obt."></div>
      <div><input type="number" step="0.5" class="gpa-input ${type}-total" value="${defaultTotal}"></div>
      <button type="button" class="remove-row-btn" title="Remove"><span class="material-symbols-outlined text-lg">delete</span></button>
    `;

    container.appendChild(row);

    const inputs = row.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        validateInput(input);
        updateLivePreview();
      });
    });

    row.querySelector('.remove-row-btn').addEventListener('click', () => {
      row.remove();
      updateLivePreview();
    });
  }

  document.querySelectorAll('.add-row-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const containerId = btn.getAttribute('data-container');
      const type = btn.getAttribute('data-type');
      addDynamicRow(containerId, type);
    });
  });

  function setupRowListeners() {
    form.querySelectorAll('.dynamic-row').forEach(row => {
      row.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => {
          validateInput(input);
          updateLivePreview();
        });
      });
      row.querySelector('.remove-row-btn')?.addEventListener('click', () => {
        row.remove();
        updateLivePreview();
      });
    });

    ['theory-mid', 'theory-final', 'lab-mid', 'lab-final'].forEach(prefix => {
      const obt = document.getElementById(`${prefix}-obtained`);
      const tot = document.getElementById(`${prefix}-total`);
      [obt, tot].forEach(el => {
        if (el) el.addEventListener('input', () => {
          validateInput(el);
          updateLivePreview();
        });
      });
    });

    [courseCreditHoursEl, ...document.querySelectorAll('#marks-settings input')].forEach(el => {
      if (el) el.addEventListener('input', updateLivePreview);
    });
  }

  function validateInput(input) {
    const row = input.closest('.dynamic-row') || input.closest('.marks-grid-pair');
    if (row) {
      const obtInput = row.querySelector('[class*="-obtained"], [id$="-obtained"]');
      const totInput = row.querySelector('[class*="-total"], [id$="-total"]');
      
      if (obtInput && totInput) {
        const obtVal = parseFloat(obtInput.value);
        const totVal = parseFloat(totInput.value);
        
        if (!isNaN(obtVal) && !isNaN(totVal)) {
          const progress = (obtVal / totVal) * 100;
          obtInput.style.setProperty('--progress', `${Math.min(progress, 100)}%`);
          
          if (obtVal > totVal) {
            obtInput.classList.add('is-invalid');
          } else {
            obtInput.classList.remove('is-invalid');
            obtInput.classList.add('is-valid');
          }
        }
      }
    }
  }

  function updateLivePreview() {
    const data = gatherFormData();
    const scheme = readMarkScheme();
    const creditHours = Math.max(Logic.toNum(courseCreditHoursEl?.value, 3), 0.5);

    const theoryTotal = Logic.calcTheoryTotal(data.theory, scheme.theory);
    const labTotal = hasLabCb.checked ? Logic.calcLabTotal(data.lab, scheme.lab) : 0;
    const finalPct = Logic.calcFinalPercentage(theoryTotal, labTotal, hasLabCb.checked, creditHours, 1);
    const gradeInfo = Logic.getGradeInfo(finalPct);

    liveGpaEl.textContent = gradeInfo.point.toFixed(2);
    liveBadge.classList.add('visible');
    
    if (gradeInfo.point >= 3.5) {
      liveBadge.className = 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800 visible p-2 rounded-lg flex items-center gap-2';
    } else if (gradeInfo.point >= 2.0) {
      liveBadge.className = 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-100 dark:border-teal-800 visible p-2 rounded-lg flex items-center gap-2';
    } else {
      liveBadge.className = 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-800 visible p-2 rounded-lg flex items-center gap-2';
    }
  }

  function gatherFormData() {
    const readRows = (containerId, obtClass, totClass) => {
      const container = document.getElementById(containerId);
      if (!container) return [];
      return Array.from(container.querySelectorAll('.dynamic-row')).map(row => ({
        obtained: Logic.toNum(row.querySelector(`.${obtClass}`).value, 0),
        total: Logic.toNum(row.querySelector(`.${totClass}`).value, 1)
      }));
    };

    const readPair = (prefix) => ({
      obtained: readNumberInput(`${prefix}-obtained`),
      total: readNumberInput(`${prefix}-total`) || 1
    });

    return {
      theory: {
        assignments: readRows('theory-assignments-list', 'assignment-obtained', 'assignment-total'),
        quizzes: readRows('theory-quizzes-list', 'quiz-obtained', 'quiz-total'),
        mid: readPair('theory-mid'),
        final: readPair('theory-final')
      },
      lab: {
        labAssignments: readRows('lab-assignments-list', 'lab-obtained', 'lab-total'),
        labMid: readPair('lab-mid'),
        labFinal: readPair('lab-final')
      }
    };
  }

  // --- Core Handlers ---

  function handleAddSubject() {
    const subjectNameInput = document.getElementById('subject-name');
    const subjectName = subjectNameInput?.value.trim() || 'Unnamed Subject';
    const hasLab = hasLabCb.checked;
    const creditHours = Math.max(Logic.toNum(courseCreditHoursEl?.value, 3), 0.5);
    
    const data = gatherFormData();
    const scheme = readMarkScheme();

    const theoryTotal = Logic.calcTheoryTotal(data.theory, scheme.theory);
    const labTotal = hasLab ? Logic.calcLabTotal(data.lab, scheme.lab) : 0;
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

    calcGpaBtn.classList.remove('hidden', 'is-pulsing');
    void calcGpaBtn.offsetWidth; 
    calcGpaBtn.classList.add('is-pulsing');
    
    resetBtn.classList.remove('hidden');
    overallResult.classList.add('hidden');
    liveBadge.classList.remove('visible');
  }

  function renderSubjectCard(subject, orderIndex) {
    emptyState.classList.add('hidden');
    const card = document.createElement('li');
    card.id = `subject-card-${subject.id}`;
    const delayClass = `slide-delay-${Math.min(orderIndex, 5)}`;
    const badgeColor = getGradeBadgeColor(subject.letter);

    card.className = `subject-card flex items-start justify-between gap-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-5 shadow-sm animate-slide-in ${delayClass} group/card hover:-translate-y-0.5 hover:shadow-md hover:border-teal-200 dark:hover:border-teal-800 transition-all`;

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
    card.querySelector('.delete-btn').addEventListener('click', () => handleDeleteSubject(subject.id));
  }

  function handleDeleteSubject(id) {
    const index = addedSubjects.findIndex(s => s.id === id);
    if (index === -1) return;
    addedSubjects.splice(index, 1);
    const card = document.getElementById(`subject-card-${id}`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        card.remove();
        if (addedSubjects.length === 0) {
          emptyState.classList.remove('hidden');
          calcGpaBtn.classList.add('hidden');
          resetBtn.classList.add('hidden');
          overallResult.classList.add('hidden');
        }
      }, 200);
    }
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
    overallPerfEl.textContent = `${Logic.getPerformanceLabel(avg)} Total Credits: ${totalCredits.toFixed(1)} | Honor Points: ${honorPoints.toFixed(2)}`;

    overallResult.classList.remove('hidden');
    calcGpaBtn.classList.remove('is-pulsing');
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
    
    // Clear dynamic lists
    document.getElementById('theory-assignments-list').innerHTML = '';
    addDynamicRow('theory-assignments-list', 'assignment');
    document.getElementById('theory-quizzes-list').innerHTML = '';
    addDynamicRow('theory-quizzes-list', 'quiz');
    const labContainer = document.getElementById('lab-assignments-list');
    if (labContainer) {
      labContainer.innerHTML = '';
      addDynamicRow('lab-assignments-list', 'lab');
    }

    hasLabCb.checked = false;
    syncLabMode();
    formErrors.classList.add('hidden');
    clearValidationStates();
    liveBadge.classList.remove('visible');
  }

  function resetFormCompletely() {
    form.reset();
    document.getElementById('theory-assignments-list').innerHTML = '';
    addDynamicRow('theory-assignments-list', 'assignment');
    document.getElementById('theory-quizzes-list').innerHTML = '';
    addDynamicRow('theory-quizzes-list', 'quiz');
    const labContainer = document.getElementById('lab-assignments-list');
    if (labContainer) {
      labContainer.innerHTML = '';
      addDynamicRow('lab-assignments-list', 'lab');
    }

    hasLabCb.checked = false;
    syncLabMode();
    formErrors.classList.add('hidden');
    clearValidationStates();
    liveBadge.classList.remove('visible');
    document.getElementById('subject-name')?.focus();
  }

  function clearValidationStates() {
    form.querySelectorAll('input[type="number"]').forEach(input => {
      input.classList.remove('is-valid', 'is-invalid');
      input.style.setProperty('--progress', '0%');
    });
    document.querySelectorAll('.field-error').forEach(el => el.remove());
  }

  // --- Logic Helpers ---

  function readNumberInput(id) {
    const el = document.getElementById(id);
    return el ? Logic.toNum(el.value, 0) : 0;
  }

  function escHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    formErrors.classList.add('hidden');
    const errors = validateForm();
    if (errors.length > 0) {
      formErrors.innerHTML = `<strong>Fix errors:</strong><ul class="list-disc pl-5 mt-1">` + errors.map(e => `<li>${escHtml(e)}</li>`).join('') + `</ul>`;
      formErrors.classList.remove('hidden');
      return;
    }
    handleAddSubject();
  });

  function validateForm() {
    const errors = [];
    form.querySelectorAll('input[type="number"]').forEach(input => {
      if (input.closest('.hidden')) return;
      if (input.classList.contains('is-invalid')) {
        errors.push("One or more fields have invalid marks (Obtained > Total).");
      }
    });
    return [...new Set(errors)]; 
  }

  hasLabCb.addEventListener('change', syncLabMode);
  clearFormBtn.addEventListener('click', resetFormCompletely);
  setupRowListeners();
  setTimeout(syncLabMode, 0);

})();
