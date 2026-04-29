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
  /** @type {Array<{ id: number, name: string, percentage: number, gpa: number, letter: string, hasLab: boolean, theoryTotal: number, labTotal: number }>} */
  const addedSubjects = [];
  let nextSubjectId = 1;

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
  const clearFormBtn = document.getElementById('clear-form-btn');
  const formErrors   = document.getElementById('form-errors');
  const emptyStateCta= document.getElementById('empty-state-cta');

  /* ── XSS helper ─────────────────────────────── */
  /**
   * Escapes HTML characters to prevent XSS.
   * @param {string|null} str 
   * @returns {string}
   */
  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* ── Keyboard Accessibility for Lab Toggle ──── */
  hasLabCb.addEventListener('change', () => {
    const isChecked = hasLabCb.checked;
    hasLabCb.setAttribute('aria-checked', isChecked.toString());
    if (isChecked) {
      labSection.classList.remove('hidden');
    } else {
      labSection.classList.add('hidden');
    }
  });

  const labLabel = document.querySelector('label[for="has-lab"]');
  if (labLabel) {
    // Make label focusable if it isn't automatically via the input
    labLabel.setAttribute('tabindex', '0');
    labLabel.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        hasLabCb.checked = !hasLabCb.checked;
        hasLabCb.dispatchEvent(new Event('change'));
      }
    });
  }

  /* ── Grading Scale ARIA ────────────────────── */
  const gradingDetails = document.getElementById('grading-scale-details');
  const gradingSummary = document.getElementById('grading-scale-summary');
  if (gradingDetails && gradingSummary) {
    gradingDetails.addEventListener('toggle', () => {
      gradingSummary.setAttribute('aria-expanded', gradingDetails.open.toString());
    });
  }

  /* ── Form Interactions ─────────────────────── */
  
  if (emptyStateCta) {
    emptyStateCta.addEventListener('click', () => {
      document.getElementById('subject-name').focus();
    });
  }

  if (clearFormBtn) {
    clearFormBtn.addEventListener('click', resetFormCompletely);
  }

  /* ── Real-time Validation & Progress Bar ────── */
  const allInputs = form.querySelectorAll('input[type="number"]');
  allInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      const el = e.target;
      const val = parseFloat(el.value);
      const max = parseFloat(el.max || '100');
      const min = parseFloat(el.min || '0');
      
      // Remove inline error if exists
      const inlineError = el.parentElement.querySelector('.field-error');
      if (inlineError) inlineError.remove();

      // Update progress bar
      if (!isNaN(val) && val >= min && val <= max) {
        const progress = (val / max) * 100;
        el.style.setProperty('--progress', `${progress}%`);
        el.classList.remove('is-invalid');
        el.classList.add('is-valid');
      } else if (el.value === '') {
        el.style.setProperty('--progress', `0%`);
        el.classList.remove('is-invalid', 'is-valid');
      } else {
        el.style.setProperty('--progress', `0%`);
        el.classList.add('is-invalid');
        el.classList.remove('is-valid');
      }
    });
  });

  /**
   * Validates all numeric inputs before submission.
   * @returns {string[]} Array of error messages
   */
  function validateForm() {
    const errors = [];
    // Clear previous inline errors
    document.querySelectorAll('.field-error').forEach(el => el.remove());

    allInputs.forEach(input => {
      // Only validate visible inputs
      if (input.closest('.hidden')) return;
      
      const val = parseFloat(input.value);
      const max = parseFloat(input.max || '100');
      const min = parseFloat(input.min || '0');
      const label = input.previousElementSibling?.textContent || input.id;
      
      if (input.value !== '' && (isNaN(val) || val < min || val > max)) {
        errors.push(`${label} must be between ${min} and ${max}.`);
        input.classList.add('is-invalid');

        // Add inline error
        const errorEl = document.createElement('p');
        errorEl.className = 'field-error';
        errorEl.textContent = `Must be ${min}-${max}`;
        input.parentElement.appendChild(errorEl);
      }
    });
    return errors;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    formErrors.classList.add('hidden');
    formErrors.innerHTML = '';
    
    const errors = validateForm();
    if (errors.length > 0) {
      formErrors.innerHTML = `<strong>Please fix the following errors:</strong><ul class="list-disc pl-5 mt-1">` + errors.map(err => `<li>${escHtml(err)}</li>`).join('') + `</ul>`;
      formErrors.classList.remove('hidden');
      return;
    }
    
    handleAddSubject();
  });

  /**
   * Reads a numeric input safely.
   */
  function readNumberInput(id) {
    const el = document.getElementById(id);
    return el ? Logic.toNum(el.value, 0) : 0;
  }

  /**
   * Reads an array of numeric inputs.
   */
  function readArrayInputs(prefix, count) {
    return Array.from({ length: count }, (_, i) => readNumberInput(`${prefix}-${i + 1}`));
  }

  /**
   * Handles adding a subject to the state and UI.
   */
  function handleAddSubject() {
    const subjectNameInput = document.getElementById('subject-name');
    const subjectName = subjectNameInput.value.trim() || 'Unnamed Subject';
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

    const subjectId = nextSubjectId++;

    /* Append to state */
    const newSubject = {
      id:         subjectId,
      name:       subjectName,
      percentage: finalPct,
      gpa:        gradeInfo.point,
      letter:     gradeInfo.letter,
      hasLab,
      theoryTotal,
      labTotal,
    };
    addedSubjects.push(newSubject);

    /* Update UI */
    renderSubjectCard(newSubject, addedSubjects.length);
    resetFormKeepName();

    /* Show overall button and pulse */
    calcGpaBtn.classList.remove('hidden');
    calcGpaBtn.classList.add('is-pulsing');
    resetBtn.classList.remove('hidden');
    overallResult.classList.add('hidden'); // hide stale result until recalculated
    
    // Announce to screen readers
    subjectsList.setAttribute('aria-label', `Added ${subjectName} with GPA ${gradeInfo.point}`);
  }

  /* ── Render a subject card on the right side ─── */
  /**
   * Renders a subject card to the DOM.
   * @param {Object} subject 
   * @param {number} orderIndex 
   */
  function renderSubjectCard(subject, orderIndex) {
    emptyState.classList.add('hidden');

    const card = document.createElement('li');
    card.id = `subject-card-${subject.id}`;
    
    // Staggered delay class (max out at 5)
    const delayClass = `slide-delay-${Math.min(orderIndex, 5)}`;
    
    card.className = [
      'subject-card',
      'flex items-start justify-between gap-4', // Increased gap
      'bg-white dark:bg-slate-800',
      'border border-slate-100 dark:border-slate-700',
      'rounded-2xl p-5 shadow-sm', // Increased padding
      'animate-slide-in',
      delayClass,
      'group/card hover:-translate-y-0.5 hover:shadow-md hover:border-teal-200 dark:hover:border-teal-800 transition-all'
    ].join(' ');

    const badgeColor = getGradeBadgeColor(subject.letter);

    card.innerHTML = `
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <p class="font-semibold text-slate-800 dark:text-slate-100 truncate text-sm" title="${escHtml(subject.name)}">${escHtml(subject.name)}</p>
          <button type="button" class="delete-btn opacity-0 group-hover/card:opacity-100 transition-opacity text-slate-400 hover:text-rose-500 focus:opacity-100 p-1" data-id="${subject.id}" aria-label="Delete ${escHtml(subject.name)}">
            <span class="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
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
    
    // Add delete listener
    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => handleDeleteSubject(subject.id));
  }
  
  /**
   * Handles deletion of a single subject card
   */
  function handleDeleteSubject(id) {
    const index = addedSubjects.findIndex(s => s.id === id);
    if (index === -1) return;
    
    // Remove from array
    addedSubjects.splice(index, 1);
    
    // Remove from DOM with animation
    const card = document.getElementById(`subject-card-${id}`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'translateY(-10px)';
      card.style.pointerEvents = 'none';
      setTimeout(() => {
        card.remove();
        
        // Show empty state if none left
        if (addedSubjects.length === 0) {
          emptyState.classList.remove('hidden');
          calcGpaBtn.classList.add('hidden');
          resetBtn.classList.add('hidden');
          overallResult.classList.add('hidden');
        } else {
          // Pulse calc button again as recalculation is needed
          calcGpaBtn.classList.add('is-pulsing');
          overallResult.classList.add('hidden');
        }
      }, 200); // Wait for transition
    }
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
    calcGpaBtn.classList.remove('is-pulsing'); // Stop pulsing
    
    // Update live region so screen readers announce it immediately
    overallResult.setAttribute('aria-live', 'assertive');
    
    overallResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  /* ── Reset all ──────────────────────────────── */
  resetBtn.addEventListener('click', () => {
    if (!confirm('Clear all added subjects and start over?')) return;
    addedSubjects.length = 0;
    
    // Remove all subject cards but keep empty state
    Array.from(subjectsList.children).forEach(child => {
      if (child.id !== 'empty-state') child.remove();
    });
    
    emptyState.classList.remove('hidden');
    overallResult.classList.add('hidden');
    calcGpaBtn.classList.add('hidden');
    resetBtn.classList.add('hidden');
    resetFormCompletely();
  });

  /* ── Reset the left-side form ───────────────── */
  /**
   * Resets the form but preserves the subject name to speed up data entry
   */
  function resetFormKeepName() {
    const name = document.getElementById('subject-name').value;
    form.reset();
    document.getElementById('subject-name').value = name;
    
    hasLabCb.checked = false;
    hasLabCb.setAttribute('aria-checked', 'false');
    labSection.classList.add('hidden');
    formErrors.classList.add('hidden');
    
    // Clear validation states and inline errors
    allInputs.forEach(input => {
      input.classList.remove('is-valid', 'is-invalid');
      input.style.setProperty('--progress', '0%');
    });
    document.querySelectorAll('.field-error').forEach(el => el.remove());
  }
  
  /**
   * Completely clears the form including subject name
   */
  function resetFormCompletely() {
    form.reset();
    hasLabCb.checked = false;
    hasLabCb.setAttribute('aria-checked', 'false');
    labSection.classList.add('hidden');
    formErrors.classList.add('hidden');
    
    // Clear validation states and inline errors
    allInputs.forEach(input => {
      input.classList.remove('is-valid', 'is-invalid');
      input.style.setProperty('--progress', '0%');
    });
    document.querySelectorAll('.field-error').forEach(el => el.remove());
    
    // Focus first input
    document.getElementById('subject-name').focus();
  }

})();
