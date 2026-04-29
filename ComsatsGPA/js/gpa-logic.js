/**
 * gpa-logic.js — COMSATS GPA Calculation Engine
 *
 * Official COMSATS University Islamabad absolute grading scale.
 * Grade points are fixed (not interpolated) per the university handbook.
 *
 * Theory Component (out of 100):
 *   4 Assignments + 4 Quizzes + Midterm (25 marks) + Final (50 marks)
 *   Proportional marks from assignments/quizzes fill the remaining 25 marks.
 *   Assignments total = 12.5 marks, Quizzes total = 12.5 marks (each group contributes 12.5/100)
 *
 * Lab Component (optional, out of 100):
 *   4 Lab Assignments + Lab Midterm (25 marks) + Lab Final (50 marks)
 *   Lab Assignments total = 25 marks
 *
 * Weighting:
 *   Theory only  → Final % = Theory Total
 *   With Lab     → Final % = (Theory Total × 0.67) + (Lab Total × 0.33)
 *
 * Exposed API (window.GpaLogic):
 *   GRADING_SCALE  — the raw scale array
 *   getGradeInfo(percentage) → { letter, point, percentage }
 *   calcTheoryTotal(fields)  → number 0–100
 *   calcLabTotal(fields)     → number 0–100
 *   calcFinalPercentage(theoryTotal, labTotal, hasLab) → number
 *   getPerformanceLabel(gpa) → string
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GpaLogic = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  /* ─────────────────────────────────────────────
   * 1. OFFICIAL COMSATS GRADING SCALE
   * Fixed (absolute) grade points — no interpolation.
   * ───────────────────────────────────────────── */
  const GRADING_SCALE = Object.freeze([
    { letter: 'A',  percentMin: 85, percentMax: 100, point: 4.00 },
    { letter: 'A-', percentMin: 80, percentMax: 84,  point: 3.67 },
    { letter: 'B+', percentMin: 75, percentMax: 79,  point: 3.33 },
    { letter: 'B',  percentMin: 71, percentMax: 74,  point: 3.00 },
    { letter: 'B-', percentMin: 68, percentMax: 70,  point: 2.67 },
    { letter: 'C+', percentMin: 64, percentMax: 67,  point: 2.33 },
    { letter: 'C',  percentMin: 60, percentMax: 63,  point: 2.00 },
    { letter: 'C-', percentMin: 57, percentMax: 59,  point: 1.67 },
    { letter: 'D+', percentMin: 53, percentMax: 56,  point: 1.33 },
    { letter: 'D',  percentMin: 50, percentMax: 52,  point: 1.00 },
    { letter: 'F',  percentMin: 0,  percentMax: 49,  point: 0.00 },
  ]);

  /* ─────────────────────────────────────────────
   * 2. HELPERS
   * ───────────────────────────────────────────── */

  /** Safely parse a value to a finite number, defaulting to `fallback`. */
  function toNum(value, fallback = 0) {
    if (value === '' || value == null) return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  /** Round to 2 decimal places. */
  function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  /** Clamp a number between min and max. */
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /* ─────────────────────────────────────────────
   * 3. GRADE LOOKUP
   * ───────────────────────────────────────────── */

  /**
   * Look up grade info for a given percentage.
   * @param {number} percentage — 0 to 100
   * @returns {{ letter: string, point: number, percentage: number }}
   */
  function getGradeInfo(percentage) {
    const pct = clamp(Math.round(toNum(percentage, 0)), 0, 100);
    const band = GRADING_SCALE.find(b => pct >= b.percentMin && pct <= b.percentMax)
              || GRADING_SCALE[GRADING_SCALE.length - 1]; // fallback to F
    return { letter: band.letter, point: band.point, percentage: pct };
  }

  /* ─────────────────────────────────────────────
   * 4. MARKS CALCULATION
   *
   * Theory breakdown (total = 100 marks):
   *   ┌─────────────────────────────────────────┐
   *   │ 4 Assignments  → max 12.5 each = 50 raw │
   *   │   Contribution: (sum / 50) × 12.5        │
   *   │ 4 Quizzes      → max 10 each  = 40 raw  │
   *   │   Contribution: (sum / 40) × 12.5        │
   *   │ Midterm        → max 25                  │
   *   │ Final          → max 50                  │
   *   └─────────────────────────────────────────┘
   *
   * Lab breakdown (total = 100 marks):
   *   ┌─────────────────────────────────────────┐
   *   │ 4 Lab Assignments → max 12.5 each = 50  │
   *   │   Contribution: (sum / 50) × 25          │
   *   │ Lab Midterm    → max 25                  │
   *   │ Lab Final      → max 50                  │
   *   └─────────────────────────────────────────┘
   * ───────────────────────────────────────────── */

  /**
   * Calculate Theory Total (0–100) from raw marks fields.
   * @param {{ assignments: number[], quizzes: number[], mid: number, final: number }} fields
   * @returns {number} 0–100
   */
  function calcTheoryTotal(fields) {
    const assignMax  = 50;   // 4 × 12.5
    const quizMax    = 40;   // 4 × 10
    const assignContrib = 12.5;
    const quizContrib   = 12.5;

    const assignSum = (fields.assignments || []).reduce((s, v) => s + clamp(toNum(v), 0, 12.5), 0);
    const quizSum   = (fields.quizzes    || []).reduce((s, v) => s + clamp(toNum(v), 0, 10),   0);
    const mid       = clamp(toNum(fields.mid),   0, 25);
    const final     = clamp(toNum(fields.final), 0, 50);

    const assignScore = assignMax > 0 ? (assignSum / assignMax) * assignContrib : 0;
    const quizScore   = quizMax   > 0 ? (quizSum   / quizMax)  * quizContrib   : 0;

    return round2(clamp(assignScore + quizScore + mid + final, 0, 100));
  }

  /**
   * Calculate Lab Total (0–100) from raw marks fields.
   * @param {{ labAssignments: number[], labMid: number, labFinal: number }} fields
   * @returns {number} 0–100
   */
  function calcLabTotal(fields) {
    const labAssignMax     = 50;  // 4 × 12.5
    const labAssignContrib = 25;

    const labAssignSum = (fields.labAssignments || []).reduce((s, v) => s + clamp(toNum(v), 0, 12.5), 0);
    const labMid       = clamp(toNum(fields.labMid),   0, 25);
    const labFinal     = clamp(toNum(fields.labFinal), 0, 50);

    const labAssignScore = labAssignMax > 0 ? (labAssignSum / labAssignMax) * labAssignContrib : 0;

    return round2(clamp(labAssignScore + labMid + labFinal, 0, 100));
  }

  /**
   * Calculate final weighted percentage.
   * @param {number} theoryTotal 0–100
   * @param {number} labTotal    0–100
   * @param {boolean} hasLab
   * @returns {number} 0–100
   */
  function calcFinalPercentage(theoryTotal, labTotal, hasLab) {
    if (!hasLab) return round2(clamp(theoryTotal, 0, 100));
    return round2(clamp(theoryTotal * 0.67 + labTotal * 0.33, 0, 100));
  }

  /* ─────────────────────────────────────────────
   * 5. PERFORMANCE LABEL
   * ───────────────────────────────────────────── */

  /**
   * Returns a motivational/descriptive label for a given cumulative GPA.
   * @param {number} gpa
   * @returns {string}
   */
  function getPerformanceLabel(gpa) {
    const g = toNum(gpa, 0);
    if (g >= 3.67) return '🏆 Dean\'s List — Outstanding performance!';
    if (g >= 3.33) return '🌟 Excellent — Keep pushing for that A!';
    if (g >= 3.00) return '👍 Good standing — You\'re on track.';
    if (g >= 2.67) return '📈 Average — A few stronger courses can lift your GPA.';
    if (g >= 2.00) return '⚠️ Satisfactory — Improvement is recommended.';
    if (g >  0)    return '🚨 At-risk — Focus on your weakest courses.';
    return 'Add subjects to see your GPA.';
  }

  /* ─────────────────────────────────────────────
   * 6. PUBLIC API
   * ───────────────────────────────────────────── */
  return {
    GRADING_SCALE,
    getGradeInfo,
    calcTheoryTotal,
    calcLabTotal,
    calcFinalPercentage,
    getPerformanceLabel,
    // Utility helpers exposed for UI layer
    toNum,
    round2,
  };
});
