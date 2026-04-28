/*
 * COMSATS GPA/CGPA calculation utilities.
 *
 * Confirmed from available COMSATS/CUI handbook and grading notification copies:
 * - Theory/lab overall percentage is weighted by theory/practical credit hours.
 * - F is below 50 and carries 0.00 grade points.
 * - Current Fall 2021+ CUI/HEC grading notification lists grade-point ranges.
 *
 * Assumption kept in one place:
 * - Because the public notification lists grade-point ranges but does not publish the
 *   exact mark-to-point formula, this module uses linear interpolation inside each
 *   grade band. To switch to fixed grade points later, update getGradeInfo only.
 */
(function initGpaLogic(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GpaLogic = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function createGpaLogic() {
  'use strict';

  const MIN_GPA = 0;
  const MAX_GPA = 4;
  const MAX_PERCENTAGE = 100;
  const MAX_COURSE_CREDITS = 6;

  const GRADING_SCALE = Object.freeze([
    { letter: 'A', percentMin: 85, percentMax: 100, pointMin: 3.67, pointMax: 4.00 },
    { letter: 'A-', percentMin: 80, percentMax: 84, pointMin: 3.34, pointMax: 3.66 },
    { letter: 'B+', percentMin: 75, percentMax: 79, pointMin: 3.01, pointMax: 3.33 },
    { letter: 'B', percentMin: 71, percentMax: 74, pointMin: 2.67, pointMax: 3.00 },
    { letter: 'B-', percentMin: 68, percentMax: 70, pointMin: 2.34, pointMax: 2.66 },
    { letter: 'C+', percentMin: 64, percentMax: 67, pointMin: 2.01, pointMax: 2.33 },
    { letter: 'C', percentMin: 61, percentMax: 63, pointMin: 1.67, pointMax: 2.00 },
    { letter: 'C-', percentMin: 58, percentMax: 60, pointMin: 1.31, pointMax: 1.66 },
    { letter: 'D+', percentMin: 54, percentMax: 57, pointMin: 1.01, pointMax: 1.30 },
    { letter: 'D', percentMin: 50, percentMax: 53, pointMin: 0.10, pointMax: 1.00 },
    { letter: 'F', percentMin: 0, percentMax: 49, pointMin: 0.00, pointMax: 0.00 }
  ]);

  function toNumber(value, fallback = 0) {
    if (value === '' || value === null || value === undefined) return fallback;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function roundTo(value, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round((toNumber(value) + Number.EPSILON) * factor) / factor;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, toNumber(value)));
  }

  function isEmptyCourse(course = {}) {
    return !String(course.name || '').trim()
      && !toNumber(course.theoryCr)
      && !toNumber(course.theoryMarks)
      && !toNumber(course.labCr)
      && !toNumber(course.labMarks);
  }

  function getGradeInfo(percentage) {
    const rawPercentage = toNumber(percentage, NaN);

    if (!Number.isFinite(rawPercentage)) {
      return { letter: 'F', grade: 'F', point: 0, points: 0, percentage: 0 };
    }

    const clampedPercentage = clamp(rawPercentage, 0, MAX_PERCENTAGE);
    const roundedPercentage = Math.round(clampedPercentage);

    const band = GRADING_SCALE.find((item) => (
      roundedPercentage >= item.percentMin && roundedPercentage <= item.percentMax
    )) || GRADING_SCALE[GRADING_SCALE.length - 1];

    if (band.letter === 'F' || band.percentMin === band.percentMax) {
      return {
        letter: band.letter,
        grade: band.letter,
        point: band.pointMin,
        points: band.pointMin,
        percentage: roundTo(clampedPercentage, 2)
      };
    }

    const span = band.percentMax - band.percentMin;
    const ratio = span === 0 ? 1 : (clampedPercentage - band.percentMin) / span;
    const interpolatedPoint = band.pointMin + ratio * (band.pointMax - band.pointMin);
    const point = roundTo(clamp(interpolatedPoint, band.pointMin, band.pointMax), 2);

    return {
      letter: band.letter,
      grade: band.letter,
      point,
      points: point,
      percentage: roundTo(clampedPercentage, 2)
    };
  }

  function getGradePoint(percentage) {
    return getGradeInfo(percentage).point;
  }

  function getLetterGrade(percentage) {
    return getGradeInfo(percentage).letter;
  }

  function normalizeCourseInput(course = {}) {
    return {
      id: course.id || '',
      name: String(course.name || '').trim(),
      theoryCr: toNumber(course.theoryCr),
      theoryMarks: toNumber(course.theoryMarks),
      labCr: toNumber(course.labCr),
      labMarks: toNumber(course.labMarks),
      includeInGpa: course.includeInGpa !== false
    };
  }

  function validateCourseInput(course = {}) {
    const normalized = normalizeCourseInput(course);
    const errors = [];
    const warnings = [];

    if (isEmptyCourse(normalized)) {
      return {
        valid: false,
        skipped: true,
        errors: [],
        warnings: [],
        course: normalized
      };
    }

    const original = course || {};

    const theoryMarksMissing =
      normalized.theoryCr > 0 &&
      (original.theoryMarks === '' || original.theoryMarks === null || original.theoryMarks === undefined);

    const labMarksMissing =
      normalized.labCr > 0 &&
      (original.labMarks === '' || original.labMarks === null || original.labMarks === undefined);

    if (theoryMarksMissing) {
      errors.push('Theory marks are required when theory credits are added.');
    }

    if (labMarksMissing) {
      errors.push('Lab marks are required when lab credits are added.');
    }

    const totalCredits = normalized.theoryCr + normalized.labCr;

    if (totalCredits <= 0) errors.push('Add at least 1 theory or lab credit hour.');
    if (totalCredits > MAX_COURSE_CREDITS) {
      errors.push(`Total course credits cannot exceed ${MAX_COURSE_CREDITS}.`);
    }

    if (normalized.theoryCr < 0 || normalized.labCr < 0) {
      errors.push('Credit hours cannot be negative.');
    }

    if (!Number.isInteger(normalized.theoryCr) || !Number.isInteger(normalized.labCr)) {
      errors.push('Credit hours must be whole numbers.');
    }

    if (
      normalized.theoryCr > 0
      && (normalized.theoryMarks < 0 || normalized.theoryMarks > MAX_PERCENTAGE)
    ) {
      errors.push('Theory marks must be between 0 and 100.');
    }

    if (
      normalized.labCr > 0
      && (normalized.labMarks < 0 || normalized.labMarks > MAX_PERCENTAGE)
    ) {
      errors.push('Lab marks must be between 0 and 100.');
    }

    if (normalized.theoryCr === 0 && normalized.theoryMarks > 0) {
      warnings.push('Theory marks ignored because theory credits are 0.');
    }

    if (normalized.labCr === 0 && normalized.labMarks > 0) {
      warnings.push('Lab marks ignored because lab credits are 0.');
    }

    return {
      valid: errors.length === 0,
      skipped: false,
      errors,
      warnings,
      course: normalized
    };
  }

  function calculateCoursePercentage(course = {}) {
    const normalized = normalizeCourseInput(course);
    const theoryCr = Math.max(0, normalized.theoryCr);
    const labCr = Math.max(0, normalized.labCr);
    const totalCredits = theoryCr + labCr;

    if (totalCredits === 0) return 0;

    const weightedMarks = (theoryCr * normalized.theoryMarks) + (labCr * normalized.labMarks);
    return roundTo(weightedMarks / totalCredits, 2);
  }

  function calculateCourseQualityPoints(course = {}) {
    const validation = validateCourseInput(course);

    if (!validation.valid || validation.skipped || validation.course.includeInGpa === false) {
      return {
        valid: validation.valid,
        skipped: validation.skipped,
        included: false,
        errors: validation.errors,
        warnings: validation.warnings,
        name: validation.course.name,
        credits: 0,
        percentage: 0,
        letter: '-',
        gradePoint: 0,
        qualityPoints: 0
      };
    }

    const percentage = calculateCoursePercentage(validation.course);
    const grade = getGradeInfo(percentage);
    const credits = validation.course.theoryCr + validation.course.labCr;
    const qualityPoints = roundTo(credits * grade.point, 2);

    return {
      valid: true,
      skipped: false,
      included: true,
      errors: [],
      warnings: validation.warnings,
      name: validation.course.name,
      credits,
      percentage,
      letter: grade.letter,
      gradePoint: grade.point,
      qualityPoints
    };
  }

  function calculateSemesterGPA(courses = []) {
    const courseResults = courses.map(calculateCourseQualityPoints);
    const includedCourses = courseResults.filter((course) => course.valid && course.included);
    const totalCredits = includedCourses.reduce((sum, course) => sum + course.credits, 0);
    const totalQualityPoints = includedCourses.reduce(
      (sum, course) => sum + course.qualityPoints,
      0
    );

    const gpa = totalCredits > 0 ? roundTo(totalQualityPoints / totalCredits, 2) : 0;

    return {
      gpa,
      totalCredits,
      totalQualityPoints: roundTo(totalQualityPoints, 2),
      courseResults,
      valid: courseResults.every((course) => course.valid || course.skipped),
      errors: courseResults.flatMap((course, index) => (
        course.errors.map((message) => `Course ${index + 1}: ${message}`)
      )),
      warnings: courseResults.flatMap((course, index) => (
        course.warnings.map((message) => `Course ${index + 1}: ${message}`)
      ))
    };
  }

  function calculateCGPA(previousCgpa, previousCredits, semesterGpaOrResult, semesterCreditsOverride) {
    const prevCgpa = clamp(previousCgpa, MIN_GPA, MAX_GPA);
    const prevCredits = Math.max(0, toNumber(previousCredits));

    const currentGpa = typeof semesterGpaOrResult === 'object'
      ? clamp(semesterGpaOrResult.gpa, MIN_GPA, MAX_GPA)
      : clamp(semesterGpaOrResult, MIN_GPA, MAX_GPA);

    const currentCredits = typeof semesterGpaOrResult === 'object'
      ? Math.max(0, toNumber(semesterGpaOrResult.totalCredits))
      : Math.max(0, toNumber(semesterCreditsOverride));

    const previousQualityPoints = prevCgpa * prevCredits;
    const currentQualityPoints = currentGpa * currentCredits;
    const totalCredits = prevCredits + currentCredits;

    const cgpa = totalCredits > 0
      ? roundTo((previousQualityPoints + currentQualityPoints) / totalCredits, 2)
      : 0;

    return {
      cgpa,
      totalCredits,
      previousQualityPoints: roundTo(previousQualityPoints, 2),
      currentQualityPoints: roundTo(currentQualityPoints, 2),
      totalQualityPoints: roundTo(previousQualityPoints + currentQualityPoints, 2)
    };
  }

  function getPerformanceSummary(gpa) {
    const value = toNumber(gpa);

    if (value >= 3.67) return 'Excellent standing — keep targeting A/A- performance.';
    if (value >= 3.00) return 'Good standing — a few stronger courses can lift your CGPA quickly.';
    if (value >= 2.00) return 'Satisfactory, but improvement is recommended.';
    if (value > 0) return 'At-risk range — focus on failed/low-credit courses and seek academic support.';

    return 'Add valid courses to see your semester performance.';
  }

  return {
    GRADING_SCALE,
    getGradeInfo,
    getGradePoint,
    getLetterGrade,
    validateCourseInput,
    calculateCoursePercentage,
    calculateCourseQualityPoints,
    calculateSemesterGPA,
    calculateCGPA,
    getPerformanceSummary,
    roundTo
  };
});
