#!/usr/bin/env node
/**
 * Prints, comma-separated, the Nx projects whose Jest `test` target compiles with jest-preset-angular.
 *
 * Those projects run WITHOUT `--experimental-vm-modules`, every other one WITH it (NestJS 12 is ES modules): see
 * `jest.patterns.js`. The unit-test workflow runs the two groups separately with this list. Locally, Nx gives each
 * group its flag through `.env.test` files — the workspace one sets it, each Angular project's own clears it — so this
 * also fails when an Angular project has no such file: without it, `nx test <project>` breaks only on a developer's
 * machine (CI turns `.env` loading off), which is easy to miss.
 *
 * Usage (workspace root): node .github/scripts/jest-angular-projects.js
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const projects = [];
const walk = (dir) => {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(full);
		else if (entry.name === 'project.json') projects.push(full);
	}
};
for (const top of ['apps', 'packages']) walk(path.join(root, top));

const angular = [];
const missingEnv = [];
for (const file of projects) {
	const project = JSON.parse(fs.readFileSync(file, 'utf8'));
	const jestConfig = project.targets?.test?.options?.jestConfig;
	if (!jestConfig || !fs.existsSync(path.join(root, jestConfig))) continue;
	if (!fs.readFileSync(path.join(root, jestConfig), 'utf8').includes('jest-preset-angular')) continue;
	angular.push(project.name);
	const envTest = path.join(path.dirname(file), '.env.test');
	if (!fs.existsSync(envTest) || !/^NODE_OPTIONS=\s*$/m.test(fs.readFileSync(envTest, 'utf8'))) {
		missingEnv.push(path.relative(root, envTest).split(path.sep).join('/'));
	}
}

if (missingEnv.length) {
	console.error(
		`These Angular Jest projects need a .env.test with an empty NODE_OPTIONS= line (see jest.patterns.js):\n  ${missingEnv.join('\n  ')}`
	);
	process.exit(1);
}
if (!angular.length) {
	console.error('No Angular Jest project found: refusing to print an empty list (it would select every project).');
	process.exit(1);
}
console.log(angular.sort().join(','));
