import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const GpaLogic = require('../js/gpa-logic.js');

const {
  getGradeInfo,
  validateCourseInput,
  calculateCoursePercentage,
  calculateCourseQualityPoints,
  calculateSemesterGPA,
  calculateCGPA
} = GpaLogic;

function approx(actual, expected, epsilon = 0.01) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} ≈ ${expected}`);
}

// Perfect marks / highest grade
assert.equal(getGradeInfo(100).letter, 'A');
assert.equal(getGradeInfo(100).point, 4.00);

// Boundary grade values
assert.equal(getGradeInfo(85).letter, 'A');
assert.equal(getGradeInfo(84).letter, 'A-');
assert.equal(getGradeInfo(80).letter, 'A-');
assert.equal(getGradeInfo(79).letter, 'B+');
assert.equal(getGradeInfo(50).letter, 'D');
assert.equal(getGradeInfo(49).letter, 'F');

// Failed course included with zero grade points
const failed = calculateCourseQualityPoints({
  name: 'Programming',
  theoryCr: 3,
  theoryMarks: 42,
  labCr: 1,
  labMarks: 45
});

assert.equal(failed.letter, 'F');
assert.equal(failed.gradePoint, 0);
assert.equal(failed.qualityPoints, 0);

// Zero credit hours validation
const invalid = validateCourseInput({
  name: 'Empty',
  theoryCr: 0,
  theoryMarks: 85,
  labCr: 0,
  labMarks: 0
});

assert.equal(invalid.valid, false);
assert.ok(invalid.errors.some((error) => error.includes('at least 1')));

// Theory/lab weighted percentage: {(70 * 3) + (90 * 1)} / 4 = 75
assert.equal(calculateCoursePercentage({
  theoryCr: 3,
  theoryMarks: 70,
  labCr: 1,
  labMarks: 90
}), 75);

// Multiple courses with different credit hours
const semester = calculateSemesterGPA([
  { name: 'Course A', theoryCr: 3, theoryMarks: 100, labCr: 0, labMarks: 0 },
  { name: 'Course B', theoryCr: 2, theoryMarks: 80, labCr: 1, labMarks: 85 },
  { name: 'Course C', theoryCr: 3, theoryMarks: 49, labCr: 0, labMarks: 0 }
]);

assert.equal(semester.totalCredits, 9);
assert.equal(semester.courseResults.length, 3);
assert.ok(semester.gpa > 2 && semester.gpa < 3);

// CGPA calculation with previous CGPA and completed credits
const cgpa = calculateCGPA(3.2, 60, { gpa: 3.8, totalCredits: 15 });

approx(cgpa.cgpa, 3.32);
assert.equal(cgpa.totalCredits, 75);

// Empty rows are skipped, not treated as failed courses
const withEmpty = calculateSemesterGPA([
  {},
  { name: 'Valid', theoryCr: 3, theoryMarks: 85, labCr: 0, labMarks: 0 }
]);

assert.equal(withEmpty.totalCredits, 3);
assert.equal(withEmpty.errors.length, 0);

// Rounding behavior
assert.equal(calculateCGPA(3.333, 10, 3.667, 10).cgpa, 3.5);

console.log('All GPA logic tests passed.');
