(function initCalculator() {
  'use strict';

  const Logic = window.GpaLogic;

  const selectors = {
    courseList: '#course-list',
    addCourse: '#add-course-btn',
    reset: '#reset-btn',
    save: '#save-semester-btn',
    history: '#history-list',
    clearHistory: '#clear-history-btn',
    previousCgpa: '#previous-cgpa',
    previousCredits: '#previous-credits',
    semesterGpa: '#semester-gpa',
    updatedCgpa: '#updated-cgpa',
    currentCredits: '#current-credits',
    totalCredits: '#total-completed-credits',
    qualityPoints: '#quality-points',
    performance: '#performance-summary',
    validation: '#validation-summary'
  };

  const state = {
    rowId: 0,
    storageKey: 'comsatsprephub_gpa_history'
  };

  const $ = (selector) => document.querySelector(selector);

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function createCourseRow(course = {}) {
    state.rowId += 1;
    const id = course.id || `course-${state.rowId}`;

    const row = document.createElement('article');
    row.className = 'course-row';
    row.dataset.courseId = id;

    row.innerHTML = `
      <div class="course-card-top">
        <div>
          <span class="course-count-label">Course ${state.rowId}</span>
          <h3>${escapeHtml(course.name) || 'New Course'}</h3>
        </div>

        <div class="course-top-actions">
          <label class="include-toggle" title="Disable for repeated/non-counted courses">
            <input class="include-course" type="checkbox" ${course.includeInGpa === false ? '' : 'checked'}>
            <span>Count</span>
          </label>

          <div class="course-result">
            <strong class="letter-grade">-</strong>
            <span class="grade-point">0.00 GP</span>
          </div>

          <button class="remove-course" type="button" aria-label="Remove course">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>

      <div class="course-fields-grid">
        <label class="field field-name">
          <span>Course name</span>
          <input class="course-name" type="text" placeholder="e.g. Programming Fundamentals" value="${escapeHtml(course.name || '')}">
        </label>

        <label class="field">
          <span>Theory credits</span>
          <input class="theory-cr" type="number" min="0" max="6" step="1" placeholder="3" value="${course.theoryCr ?? ''}">
        </label>

        <label class="field">
          <span>Theory marks %</span>
          <input class="theory-marks" type="number" min="0" max="100" step="0.01" placeholder="82" value="${course.theoryMarks ?? ''}">
        </label>

        <label class="field">
          <span>Lab credits</span>
          <input class="lab-cr" type="number" min="0" max="4" step="1" placeholder="1" value="${course.labCr ?? ''}">
        </label>

        <label class="field">
          <span>Lab marks %</span>
          <input class="lab-marks" type="number" min="0" max="100" step="0.01" placeholder="90" value="${course.labMarks ?? ''}">
        </label>
      </div>

      <p class="course-message" role="status"></p>
    `;

    const nameInput = row.querySelector('.course-name');
    const title = row.querySelector('.course-card-top h3');

    nameInput.addEventListener('input', () => {
      title.textContent = nameInput.value.trim() || 'New Course';
    });

    row.addEventListener('input', updateResults);
    row.addEventListener('change', updateResults);

    row.querySelector('.remove-course').addEventListener('click', () => {
      row.classList.add('is-removing');

      window.setTimeout(() => {
        row.remove();

        if (!document.querySelectorAll('.course-row').length) {
          addCourseRow();
        }

        renumberCourses();
        updateResults();
      }, 170);
    });

    return row;
  }

  function renumberCourses() {
    document.querySelectorAll('.course-row').forEach((row, index) => {
      const label = row.querySelector('.course-count-label');
      if (label) label.textContent = `Course ${index + 1}`;
    });
  }

  function addCourseRow(course = {}) {
    $(selectors.courseList).appendChild(createCourseRow(course));
    renumberCourses();
    updateResults();
  }

  function readCourse(row) {
    return {
      id: row.dataset.courseId,
      name: row.querySelector('.course-name').value,
      theoryCr: row.querySelector('.theory-cr').value,
      theoryMarks: row.querySelector('.theory-marks').value,
      labCr: row.querySelector('.lab-cr').value,
      labMarks: row.querySelector('.lab-marks').value,
      includeInGpa: row.querySelector('.include-course').checked
    };
  }

  function readAllCourses() {
    return Array.from(document.querySelectorAll('.course-row')).map(readCourse);
  }

  function updateResults() {
    const courses = readAllCourses();
    const semester = Logic.calculateSemesterGPA(courses);

    const cgpa = Logic.calculateCGPA(
      $(selectors.previousCgpa).value,
      $(selectors.previousCredits).value,
      semester
    );

    $(selectors.semesterGpa).textContent = semester.gpa.toFixed(2);
    $(selectors.updatedCgpa).textContent = cgpa.cgpa.toFixed(2);
    $(selectors.currentCredits).textContent = semester.totalCredits;
    $(selectors.totalCredits).textContent = cgpa.totalCredits;
    $(selectors.qualityPoints).textContent = semester.totalQualityPoints.toFixed(2);
    $(selectors.performance).textContent = Logic.getPerformanceSummary(semester.gpa);

    renderCourseResults(semester.courseResults);
    renderValidation(semester);
  }

  function renderCourseResults(courseResults) {
    document.querySelectorAll('.course-row').forEach((row, index) => {
      const result = courseResults[index];

      const letter = row.querySelector('.letter-grade');
      const point = row.querySelector('.grade-point');
      const message = row.querySelector('.course-message');

      row.classList.toggle('has-error', result.errors.length > 0);
      row.classList.toggle('is-excluded', result.included === false && !result.skipped);

      if (result.skipped) {
        letter.textContent = '-';
        point.textContent = '0.00 GP';
        message.textContent = 'Waiting for course credits and marks.';
        return;
      }

      letter.textContent = result.letter;
      point.textContent = `${result.gradePoint.toFixed(2)} GP`;

      if (result.errors.length) {
        message.textContent = result.errors[0];
        return;
      }

      if (!result.included) {
        message.textContent = 'Excluded from GPA calculation.';
        return;
      }

      message.textContent = `${result.percentage.toFixed(2)}% · ${result.credits} credit hours · ${result.qualityPoints.toFixed(2)} quality points`;
    });
  }

  function renderValidation(semester) {
    const box = $(selectors.validation);
    const messages = [...semester.errors, ...semester.warnings];

    if (!messages.length) {
      box.innerHTML = '<p class="success-text">Everything looks good. Your GPA updates automatically.</p>';
      return;
    }

    box.innerHTML = `
      <strong>Check these items</strong>
      <ul>
        ${messages.map((message) => `<li>${escapeHtml(message)}</li>`).join('')}
      </ul>
    `;
  }

  function resetCalculator() {
    $(selectors.courseList).innerHTML = '';
    $(selectors.previousCgpa).value = '';
    $(selectors.previousCredits).value = '';
    addCourseRow();
  }

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(state.storageKey)) || [];
    } catch {
      return [];
    }
  }

  function setHistory(history) {
    localStorage.setItem(state.storageKey, JSON.stringify(history));
  }

  function saveSemester() {
    const courses = readAllCourses();
    const semester = Logic.calculateSemesterGPA(courses);

    const cgpa = Logic.calculateCGPA(
      $(selectors.previousCgpa).value,
      $(selectors.previousCredits).value,
      semester
    );

    if (!semester.valid || semester.totalCredits === 0) {
      renderValidation(semester);
      alert('Please add at least one valid course before saving.');
      return;
    }

    const label = prompt('Semester name', 'Current Semester');
    if (!label) return;

    const history = getHistory();

    history.unshift({
      id: Date.now(),
      label,
      savedAt: new Date().toISOString(),
      courses,
      semesterGpa: semester.gpa,
      currentCredits: semester.totalCredits,
      updatedCgpa: cgpa.cgpa,
      totalCredits: cgpa.totalCredits
    });

    setHistory(history.slice(0, 25));
    renderHistory();
  }

  function renderHistory() {
    const list = $(selectors.history);
    const history = getHistory();

    if (!history.length) {
      list.innerHTML = '<p class="muted-text">No saved GPA calculations yet.</p>';
      return;
    }

    list.innerHTML = history.map((item) => `
      <article class="history-card">
        <div>
          <strong>${escapeHtml(item.label)}</strong>
          <span>${new Date(item.savedAt).toLocaleDateString()} · ${item.currentCredits} current credits</span>
        </div>
        <div class="history-values">
          <span>GPA ${Number(item.semesterGpa).toFixed(2)}</span>
          <span>CGPA ${Number(item.updatedCgpa).toFixed(2)}</span>
        </div>
      </article>
    `).join('');
  }

  function init() {
    if (!Logic) {
      throw new Error('GpaLogic is missing. Load js/gpa-logic.js before js/gpa-calculator.js.');
    }

    $(selectors.addCourse).addEventListener('click', () => addCourseRow());
    $(selectors.reset).addEventListener('click', resetCalculator);
    $(selectors.save).addEventListener('click', saveSemester);
    $(selectors.previousCgpa).addEventListener('input', updateResults);
    $(selectors.previousCredits).addEventListener('input', updateResults);

    $(selectors.clearHistory).addEventListener('click', () => {
      if (confirm('Clear saved GPA history from this browser?')) {
        localStorage.removeItem(state.storageKey);
        renderHistory();
      }
    });

    addCourseRow();
    renderHistory();
    updateResults();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
