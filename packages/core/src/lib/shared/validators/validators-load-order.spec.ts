import * as fs from 'fs';
import * as path from 'path';

/**
 * `shared/validators` sits on a CommonJS cycle if any entity imports it back. Its database-backed
 * decorators (`IsEmployeeBelongsToOrganization` and friends) resolve their constraints from
 * `./constraints`, the constraints inject the ORM repositories, and the repositories load their
 * entities and, through `core/entities/internal`, every other entity. When the barrel is the FIRST
 * module a process loads (a DTO, a service, a spec file), an entity that imports it back reads it
 * half-initialised: `Dashboard` did, and four core suites failed to load with
 * "IsEmployeeBelongsToOrganization is not a function".
 *
 * Each entry point below is loaded first in a fresh module registry, the way such a suite does; the
 * last test names the offending entity directly instead of leaving a load error to decode.
 */
describe('shared/validators load order', () => {
	const firstLoad = (request: string): Record<string, unknown> => {
		let loaded: Record<string, unknown> = {};
		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			loaded = require(request);
		});
		return loaded;
	};

	it('loads the validators barrel before any entity', () => {
		const validators = firstLoad('./index');
		expect(typeof validators['IsEmployeeBelongsToOrganization']).toBe('function');
		expect(typeof validators['IsBeforeDate']).toBe('function');
	});

	it('loads the core DTO barrel before any entity', () => {
		const dto = firstLoad('../../core/dto');
		expect(typeof dto['TenantOrganizationBaseDTO']).toBe('function');
	});

	it('keeps every entity off the decorators that pull in the constraints', () => {
		const libRoot = path.resolve(__dirname, '../..');
		const validatorsDir = __dirname;
		const constraintsDir = path.join(validatorsDir, 'constraints');
		const loadsConstraints = (file: string) =>
			/from\s+['"]\.\/constraints(?:\/[^'"]*)?['"]/.test(fs.readFileSync(file, 'utf8'));

		const entities: string[] = [];
		const walk = (dir: string) => {
			for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
				const full = path.join(dir, entry.name);
				if (entry.isDirectory()) walk(full);
				else if (entry.name.endsWith('.entity.ts')) entities.push(full);
			}
		};
		walk(libRoot);
		expect(entities.length).toBeGreaterThan(100);

		const offenders: string[] = [];
		for (const entity of entities) {
			const source = fs.readFileSync(entity, 'utf8');
			for (const [, request] of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
				const target = path.resolve(path.dirname(entity), request);
				if (target !== validatorsDir && !target.startsWith(validatorsDir + path.sep)) continue;
				const file = `${target}.ts`;
				const offends =
					target === validatorsDir ||
					target === path.join(validatorsDir, 'index') ||
					target === constraintsDir ||
					target.startsWith(constraintsDir + path.sep) ||
					(fs.existsSync(file) && loadsConstraints(file));
				if (offends) offenders.push(`${path.relative(libRoot, entity)} -> ${request}`);
			}
		}
		// Import the decorator's own file when it needs no repository (as `employee-availability`
		// does with `is-before-date.decorator`); put a database-backed check on the DTO instead.
		expect(offenders).toEqual([]);
	});
});
