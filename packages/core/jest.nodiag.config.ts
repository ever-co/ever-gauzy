// Local-only (test worktree, never committed): core's jest config with ts-jest type diagnostics off, so the
// stale dependency tree's unrelated type errors do not stop a suite from running.
const base = require('./jest.config.ts');
module.exports = {
	...(base.default ?? base),
	transform: { '^.+\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json', diagnostics: false }] }
};
