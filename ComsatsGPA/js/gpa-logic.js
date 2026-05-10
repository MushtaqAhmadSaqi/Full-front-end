/**
 * gpa-logic.js — COMSATS Internal Marks + GPA Engine
 *
 * This logic follows the COMSATS PLUS-style flow:
 * - Add course
 * - Subject name
 * - Credit hours
 * - Optional lab
 * - Dynamic max marks
 * - Weighted internal marks
 * - Credit-hour weighted GPA
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GpaLogic = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const GRADING_SCALE = Object.freeze([
    { letter: 'A', percentMin: 85, percentMax: 100, point: 4.00 },
    { letter: 'A-', percentMin: 80, percentMax: 84, point: 3.66 },
    { letter: 'B+', percentMin: 75, percentMax: 79, point: 3.33 },
    { letter: 'B', percentMin: 71, percentMax: 74, point: 3.00 },
    { letter: 'B-', percentMin: 68, percentMax: 70, point: 2.66 },
    { letter: 'C+', percentMin: 64, percentMax: 67, point: 2.33 },
    { letter: 'C', percentMin: 60, percentMax: 63, point: 2.00 },
    { letter: 'C-', percentMin: 57, percentMax: 59, point: 1.67 },
    { letter: 'D+', percentMin: 53, percentMax: 56, point: 1.33 },
    { letter: 'D', percentMin: 50, percentMax: 52, point: 1.00 },
    { letter: 'F', percentMin: 0, percentMax: 49, point: 0.00 },
  ]);

  const DEFAULT_SCHEME = Object.freeze({
    theory: {
      assignmentMax: 10,
      assignmentWeight: 10,
      quizMax: 10,
      quizWeight: 15,
      midMax: 25,
      midWeight: 25,
      finalMax: 50,
      finalWeight: 50,
    },
    lab: {
      assignmentMax: 10,
      assignmentWeight: 25,
      midMax: 25,
      midWeight: 25,
      finalMax: 50,
      finalWeight: 50,
    },
  });

  function toNum(value, fallback = 0) {
    if (value === '' || value == null) return fallback;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
  }

  function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function positive(value, fallback) {
    const numberValue = toNum(value, fallback);
    return numberValue > 0 ? numberValue : fallback;
  }

  function getGradeInfo(percentage) {
    const pct = clamp(Math.round(toNum(percentage, 0)), 0, 100);

    const band =
      GRADING_SCALE.find(item => pct >= item.percentMin && pct <= item.percentMax) ||
      GRADING_SCALE[GRADING_SCALE.length - 1];

    return {
      letter: band.letter,
      point: band.point,
      percentage: pct,
    };
  }

  function normalizeScheme(scheme = {}) {
    return {
      theory: {
        assignmentMax: positive(scheme.theory?.assignmentMax, DEFAULT_SCHEME.theory.assignmentMax),
        assignmentWeight: clamp(toNum(scheme.theory?.assignmentWeight, DEFAULT_SCHEME.theory.assignmentWeight), 0, 100),
        quizMax: positive(scheme.theory?.quizMax, DEFAULT_SCHEME.theory.quizMax),
        quizWeight: clamp(toNum(scheme.theory?.quizWeight, DEFAULT_SCHEME.theory.quizWeight), 0, 100),
        midMax: positive(scheme.theory?.midMax, DEFAULT_SCHEME.theory.midMax),
        midWeight: clamp(toNum(scheme.theory?.midWeight, DEFAULT_SCHEME.theory.midWeight), 0, 100),
        finalMax: positive(scheme.theory?.finalMax, DEFAULT_SCHEME.theory.finalMax),
        finalWeight: clamp(toNum(scheme.theory?.finalWeight, DEFAULT_SCHEME.theory.finalWeight), 0, 100),
      },
      lab: {
        assignmentMax: positive(scheme.lab?.assignmentMax, DEFAULT_SCHEME.lab.assignmentMax),
        assignmentWeight: clamp(toNum(scheme.lab?.assignmentWeight, DEFAULT_SCHEME.lab.assignmentWeight), 0, 100),
        midMax: positive(scheme.lab?.midMax, DEFAULT_SCHEME.lab.midMax),
        midWeight: clamp(toNum(scheme.lab?.midWeight, DEFAULT_SCHEME.lab.midWeight), 0, 100),
        finalMax: positive(scheme.lab?.finalMax, DEFAULT_SCHEME.lab.finalMax),
        finalWeight: clamp(toNum(scheme.lab?.finalWeight, DEFAULT_SCHEME.lab.finalWeight), 0, 100),
      },
    };
  }

  function weightedPart(obtained, maxMarks, weight) {
    const max = positive(maxMarks, 1);
    const safeObtained = clamp(toNum(obtained, 0), 0, max);
    const safeWeight = clamp(toNum(weight, 0), 0, 100);

    return (safeObtained / max) * safeWeight;
  }

  /**
   * Helper to sum up obtained and total from an array of objects { obtained, total }
   */
  function sumMarks(items = []) {
    return items.reduce(
      (acc, item) => {
        const itemTotal = positive(item?.total, 0);
        const itemObtained = clamp(toNum(item?.obtained, 0), 0, itemTotal);
        acc.obtained += itemObtained;
        acc.total += itemTotal;
        return acc;
      },
      { obtained: 0, total: 0 }
    );
  }

  function calcTheoryTotal(fields = {}, schemeInput = {}) {
    const scheme = normalizeScheme({ theory: schemeInput }).theory;

    // fields.assignments and fields.quizzes are now arrays of { obtained, total }
    const assignmentStats = sumMarks(fields.assignments);
    const quizStats = sumMarks(fields.quizzes);

    // Mid and Final are now objects { obtained, total }
    const midObtained = toNum(fields.mid?.obtained, 0);
    const midTotal = positive(fields.mid?.total, scheme.midMax);

    const finalObtained = toNum(fields.final?.obtained, 0);
    const finalTotal = positive(fields.final?.total, scheme.finalMax);

    const parts = [
      weightedPart(assignmentStats.obtained, assignmentStats.total || 1, scheme.assignmentWeight),
      weightedPart(quizStats.obtained, quizStats.total || 1, scheme.quizWeight),
      weightedPart(midObtained, midTotal, scheme.midWeight),
      weightedPart(finalObtained, finalTotal, scheme.finalWeight),
    ];

    const totalWeight =
      scheme.assignmentWeight +
      scheme.quizWeight +
      scheme.midWeight +
      scheme.finalWeight;

    if (totalWeight <= 0) return 0;

    const weightedSum = parts.reduce((sum, value) => sum + value, 0);
    return round2(clamp((weightedSum / totalWeight) * 100, 0, 100));
  }

  function calcLabTotal(fields = {}, schemeInput = {}) {
    const scheme = normalizeScheme({ lab: schemeInput }).lab;

    const labAssignmentStats = sumMarks(fields.labAssignments);

    const midObtained = toNum(fields.labMid?.obtained, 0);
    const midTotal = positive(fields.labMid?.total, scheme.midMax);

    const finalObtained = toNum(fields.labFinal?.obtained, 0);
    const finalTotal = positive(fields.labFinal?.total, scheme.finalMax);

    const parts = [
      weightedPart(labAssignmentStats.obtained, labAssignmentStats.total || 1, scheme.assignmentWeight),
      weightedPart(midObtained, midTotal, scheme.midWeight),
      weightedPart(finalObtained, finalTotal, scheme.finalWeight),
    ];

    const totalWeight =
      scheme.assignmentWeight +
      scheme.midWeight +
      scheme.finalWeight;

    if (totalWeight <= 0) return 0;

    const weightedSum = parts.reduce((sum, value) => sum + value, 0);
    return round2(clamp((weightedSum / totalWeight) * 100, 0, 100));
  }

  function calcFinalPercentage(theoryTotal, labTotal, hasLab, creditHours = 3, labCreditHours = 1) {
    const theory = clamp(toNum(theoryTotal, 0), 0, 100);
    const lab = clamp(toNum(labTotal, 0), 0, 100);
    const totalCredits = positive(creditHours, 3);

    if (!hasLab) return round2(theory);

    const safeLabCredits = clamp(positive(labCreditHours, 1), 0, totalCredits);
    const theoryCredits = Math.max(totalCredits - safeLabCredits, 1);
    const combinedCredits = theoryCredits + safeLabCredits;

    return round2(((theory * theoryCredits) + (lab * safeLabCredits)) / combinedCredits);
  }

  function calcSubjectCredits(subject = {}) {
    return round2(positive(subject.creditHours, 3));
  }

  function calcOverallGpa(subjects = []) {
    let totalQualityPoints = 0;
    let totalCredits = 0;

    subjects.forEach(subject => {
      const credits = calcSubjectCredits(subject);
      const gpa = clamp(toNum(subject.gpa, 0), 0, 4);

      if (credits <= 0) return;

      totalCredits += credits;
      totalQualityPoints += gpa * credits;
    });

    return totalCredits > 0 ? round2(totalQualityPoints / totalCredits) : 0;
  }

  function calcOverallPercentage(subjects = []) {
    let totalWeightedPercentage = 0;
    let totalCredits = 0;

    subjects.forEach(subject => {
      const credits = calcSubjectCredits(subject);
      const percentage = clamp(toNum(subject.percentage, 0), 0, 100);

      if (credits <= 0) return;

      totalCredits += credits;
      totalWeightedPercentage += percentage * credits;
    });

    return totalCredits > 0 ? round2(totalWeightedPercentage / totalCredits) : 0;
  }

  function calcHonorPoints(subjects = []) {
    return round2(
      subjects.reduce((sum, subject) => {
        const credits = calcSubjectCredits(subject);
        const gpa = clamp(toNum(subject.gpa, 0), 0, 4);
        return sum + credits * gpa;
      }, 0)
    );
  }

  function calcTotalCredits(subjects = []) {
    return round2(
      subjects.reduce((sum, subject) => sum + calcSubjectCredits(subject), 0)
    );
  }

  function getPerformanceLabel(gpa) {
    const value = toNum(gpa, 0);

    if (value >= 3.67) return '🏆 Excellent performance.';
    if (value >= 3.33) return '🌟 Very good. Keep improving.';
    if (value >= 3.00) return '👍 Good standing.';
    if (value >= 2.67) return '📈 Average. Improve weak courses.';
    if (value >= 2.00) return '⚠️ Satisfactory, but needs work.';
    if (value > 0) return '🚨 At risk. Focus seriously.';

    return 'Add courses to calculate GPA.';
  }

  return {
    GRADING_SCALE,
    DEFAULT_SCHEME,
    toNum,
    round2,
    clamp,
    normalizeScheme,
    getGradeInfo,
    calcTheoryTotal,
    calcLabTotal,
    calcFinalPercentage,
    calcSubjectCredits,
    calcOverallGpa,
    calcOverallPercentage,
    calcHonorPoints,
    calcTotalCredits,
    getPerformanceLabel,
  };
});
