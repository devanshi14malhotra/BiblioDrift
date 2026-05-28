// frontend/js/passwordValidator.js

export const PASSWORD_RULES = [
  { id: 'len',  regex: /.{8,}/,     msg: 'At least 8 characters' },
  { id: 'up',   regex: /[A-Z]/,     msg: 'One uppercase letter (A–Z)' },
  { id: 'low',  regex: /[a-z]/,     msg: 'One lowercase letter (a–z)' },
  { id: 'num',  regex: /[0-9]/,     msg: 'One digit (0–9)' },
  { id: 'spec', regex: /[@#$!%&*]/, msg: 'One special character (@#$!%&*)' },
];

export function validatePassword(password) {
  const results = PASSWORD_RULES.map(rule => ({
    ...rule,
    passed: rule.regex.test(password),
  }));
  const passedCount = results.filter(r => r.passed).length;
  const strength = ['', 'weak', 'weak', 'fair', 'good', 'strong'][passedCount];
  return { isValid: passedCount === 5, results, strength };
}