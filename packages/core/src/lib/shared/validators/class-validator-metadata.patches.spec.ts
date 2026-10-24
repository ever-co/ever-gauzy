import { getMetadataStorage, IsInt, IsOptional, IsString, IsUUID, Min, validate, ValidationError } from 'class-validator';
import { applyClassValidatorMetadataPatches } from './class-validator-metadata.patches';

class Base {
	@IsUUID() id: string;
	@IsOptional() @IsString() note?: string;
}
class Middle extends Base {
	@IsString({ groups: ['create'] }) name: string;
}
class Leaf extends Middle {
	@IsInt() @Min(1) count: number;
	// Overrides the inherited constraint of the same type on the same property: the override must win.
	@IsString({ always: true }) note?: string;
}
class Unrelated {
	@IsString() other: string;
}

const summary = (errors: ValidationError[]) =>
	errors.map((e) => `${e.property}:${Object.keys(e.constraints ?? {}).sort().join('+')}`).sort();

describe('class-validator metadata patches', () => {
	const cases: Array<[string, object, Parameters<typeof validate>[1]]> = [
		['valid', Object.assign(new Leaf(), { id: '1b4e28ba-2fa1-11d2-883f-0016d3cca427', count: 1, note: 'x', name: 'n' }), {}],
		['several failures', Object.assign(new Leaf(), { id: 'nope', count: 0, note: 5, name: 7 }), {}],
		['groups', Object.assign(new Leaf(), { id: 'nope', count: 0, note: 5, name: 7 }), { groups: ['create'] }],
		['strict groups', Object.assign(new Leaf(), { id: 'nope', count: 0, note: 5, name: 7 }), { strictGroups: true }],
		['always', Object.assign(new Leaf(), { id: 'nope', count: 0, note: 5, name: 7 }), { always: true }],
		['unrelated', Object.assign(new Unrelated(), { other: 1 }), {}],
		['base only', Object.assign(new Base(), { id: 'nope' }), {}]
	];

	it('reports exactly what class-validator reported before the patch, and stops rescanning every class', async () => {
		const storage: any = getMetadataStorage();
		const before: Record<string, string[]> = {};
		for (const [name, object, options] of cases) before[name] = summary(await validate(object, options));

		expect(applyClassValidatorMetadataPatches({})).toBe(true);

		const after: Record<string, string[]> = {};
		for (const [name, object, options] of cases) after[name] = summary(await validate(object, options));
		expect(after).toEqual(before);
		// Without strict groups a grouped validator runs too, as it always did in class-validator.
		expect(after['several failures']).toEqual(['count:min', 'id:isUuid', 'name:isString', 'note:isString']);
		expect(after['strict groups']).toEqual(['count:min', 'id:isUuid', 'note:isString']);

		// Every known class is tested once for the first validation of a target, never again for the next.
		const keys = jest.spyOn(storage.validationMetadatas, 'keys');
		await validate(cases[0][1]);
		const scans = keys.mock.calls.length;
		await validate(cases[0][1]);
		expect(keys.mock.calls.length).toBe(scans);
		keys.mockRestore();
	});

	it('sees a class that registers metadata only later', async () => {
		applyClassValidatorMetadataPatches({});
		await validate(new Leaf());
		class LateBase {
			@IsString() late: string;
		}
		class LateLeaf extends LateBase {
			@IsInt() n: number;
		}
		// Registered after the ancestor cache of other targets was built: its own lookup must find LateBase.
		expect(summary(await validate(Object.assign(new LateLeaf(), { late: 1, n: 'x' })))).toEqual(['late:isString', 'n:isInt']);
	});

	it('does nothing when switched off', () => {
		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const fresh = require('./class-validator-metadata.patches');
			expect(fresh.applyClassValidatorMetadataPatches({ CLASS_VALIDATOR_MEMOIZE_ANCESTORS: 'false' })).toBe(false);
		});
	});
});
