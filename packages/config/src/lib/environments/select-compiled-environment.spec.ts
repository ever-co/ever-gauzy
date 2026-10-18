import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
	PRODUCTION_SUBSTITUTION_MARKER,
	parseSelectionArguments,
	selectCompiledEnvironment
} from './select-compiled-environment';

describe('selectCompiledEnvironment', () => {
	const DEVELOPMENT =
		'"use strict";\nexports.environment = { production: false };\n//# sourceMappingURL=environment.js.map';
	const PRODUCTION =
		'"use strict";\nexports.environment = { production: true };\n//# sourceMappingURL=environment.prod.js.map';

	let outputDirectory: string;

	const read = (name: string): string => fs.readFileSync(path.join(outputDirectory, name), 'utf8');
	const exists = (name: string): boolean => fs.existsSync(path.join(outputDirectory, name));
	/** What `tsc` leaves behind: the two compiled environment files. */
	const compile = (development = DEVELOPMENT): void => {
		fs.writeFileSync(path.join(outputDirectory, 'environment.js'), development);
		fs.writeFileSync(path.join(outputDirectory, 'environment.prod.js'), PRODUCTION);
	};

	beforeEach(() => {
		outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'gauzy-config-environments-'));
		compile();
	});

	afterEach(() => {
		fs.rmSync(outputDirectory, { recursive: true, force: true });
	});

	it('leaves a fresh development compile alone', () => {
		expect(selectCompiledEnvironment(outputDirectory, 'development')).toEqual(
			expect.objectContaining({ environment: 'development', action: 'unchanged' })
		);
		expect(read('environment.js')).toBe(DEVELOPMENT);
		expect(exists('environment.dev.js')).toBe(false);
	});

	it('substitutes the production environment, marked as such, and preserves the development compile', () => {
		expect(selectCompiledEnvironment(outputDirectory, 'production')).toEqual(
			expect.objectContaining({ environment: 'production', action: 'substituted' })
		);
		expect(read('environment.js')).toBe(`${PRODUCTION_SUBSTITUTION_MARKER}\n${PRODUCTION}`);
		expect(read('environment.dev.js')).toBe(DEVELOPMENT);
		// The production compile itself is left where its source map expects it.
		expect(read('environment.prod.js')).toBe(PRODUCTION);
	});

	it('the marker precedes "use strict" as a comment, so the directive prologue still applies', () => {
		selectCompiledEnvironment(outputDirectory, 'production');
		const [marker, directive] = read('environment.js').split('\n');
		expect(marker.startsWith('//')).toBe(true);
		expect(directive).toBe('"use strict";');
	});

	it('restores the development compile after a production selection', () => {
		selectCompiledEnvironment(outputDirectory, 'production');
		expect(selectCompiledEnvironment(outputDirectory, 'development')).toEqual(
			expect.objectContaining({ environment: 'development', action: 'restored' })
		);
		expect(read('environment.js')).toBe(DEVELOPMENT);
	});

	it('selecting production twice keeps the preserved development compile', () => {
		selectCompiledEnvironment(outputDirectory, 'production');
		selectCompiledEnvironment(outputDirectory, 'production');
		expect(read('environment.js')).toBe(`${PRODUCTION_SUBSTITUTION_MARKER}\n${PRODUCTION}`);
		expect(read('environment.dev.js')).toBe(DEVELOPMENT);
		expect(selectCompiledEnvironment(outputDirectory, 'development').action).toBe('restored');
		expect(read('environment.js')).toBe(DEVELOPMENT);
	});

	it('a tsc re-emit between two selections wins over the preserved copy', () => {
		selectCompiledEnvironment(outputDirectory, 'production');
		const NEWER = DEVELOPMENT.replace('production: false', 'production: false, newer: true');
		compile(NEWER);
		selectCompiledEnvironment(outputDirectory, 'production');
		expect(read('environment.dev.js')).toBe(NEWER);
		selectCompiledEnvironment(outputDirectory, 'development');
		expect(read('environment.js')).toBe(NEWER);
	});

	it('refuses to run before the package is compiled', () => {
		fs.rmSync(path.join(outputDirectory, 'environment.prod.js'));
		expect(() => selectCompiledEnvironment(outputDirectory, 'production')).toThrow(/compile @gauzy\/config/);
	});

	it('refuses to restore when the preserved development compile is gone', () => {
		selectCompiledEnvironment(outputDirectory, 'production');
		fs.rmSync(path.join(outputDirectory, 'environment.dev.js'));
		expect(() => selectCompiledEnvironment(outputDirectory, 'development')).toThrow(/recompile @gauzy\/config/);
	});
});

describe('parseSelectionArguments', () => {
	const here = path.resolve('somewhere');

	it('defaults to the development environment in the given directory', () => {
		expect(parseSelectionArguments([], here)).toEqual({ environment: 'development', outputDirectory: here });
	});

	it('reads --environment and --output', () => {
		expect(parseSelectionArguments(['--environment=production', '--output=dist/x'], here)).toEqual({
			environment: 'production',
			outputDirectory: path.resolve('dist/x')
		});
	});

	it('rejects an environment that was not compiled, and an unknown argument', () => {
		expect(() => parseSelectionArguments(['--environment=prod'], here)).toThrow(/Unknown environment "prod"/);
		expect(() => parseSelectionArguments(['--prod'], here)).toThrow(/Unknown argument --prod/);
	});
});
