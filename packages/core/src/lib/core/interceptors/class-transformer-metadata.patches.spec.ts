import 'reflect-metadata';
import { Exclude, Expose, instanceToPlain, plainToInstance, Transform, Type } from 'class-transformer';
import { applyClassTransformerMetadataPatches } from './class-transformer-metadata.patches';

class Image {
	@Expose() id: string;
	@Transform(({ value }) => `${value}?signed`, { toPlainOnly: true }) url: string;
}

class Account {
	id: string;
	email: string;
	@Exclude() hash: string;
	@Exclude({ toPlainOnly: true }) refreshToken: string;
	@Type(() => Image) image: Image;
	@Expose({ name: 'displayName' }) name: string;
}

class Employee extends Account {
	@Expose({ groups: ['admin'] }) salary: number;
	@Type(() => Account) manager: Account;
}

@Exclude()
class Token {
	@Expose() value: string;
	secret: string;
}

function sample() {
	const employee = plainToInstance(Employee, {
		id: 'e1',
		email: 'a@b.c',
		hash: 'h',
		refreshToken: 'r',
		name: 'A',
		salary: 10,
		image: { id: 'i1', url: 'u' },
		manager: { id: 'm1', email: 'm@b.c', hash: 'mh', refreshToken: 'mr', name: 'M', image: { id: 'i2', url: 'v' } }
	});
	// A grouped @Expose is dropped by plainToInstance without that group: set it on the instance.
	employee.salary = 10;
	// @Expose({ name }) reads the plain key `displayName`, so `name` is set on the instance directly.
	employee.name = 'A';
	const token = plainToInstance(Token, { value: 'v', secret: 's' });
	return { employee, token, list: [employee, employee.manager, token] };
}

const render = () => {
	const { employee, token, list } = sample();
	return {
		plain: instanceToPlain(employee),
		admin: instanceToPlain(employee, { groups: ['admin'] }),
		excludeAll: instanceToPlain(token),
		list: instanceToPlain(list),
		exposeDefaults: instanceToPlain(employee, { exposeDefaultValues: true, excludeExtraneousValues: true })
	};
};

describe('class-transformer metadata patches', () => {
	it('produces exactly the output class-transformer produced before the patch', () => {
		const before = render();
		expect(applyClassTransformerMetadataPatches({})).toBe(true);
		const after = render();
		expect(after).toEqual(before);
		// Sanity: the decorators actually took part.
		expect(after.plain).not.toHaveProperty('hash');
		expect(after.plain).not.toHaveProperty('refreshToken');
		expect(after.plain).not.toHaveProperty('salary');
		expect(after.admin.salary).toBe(10);
		expect(after.plain.displayName).toBe('A');
		expect(after.plain.image.url).toBe('u?signed');
		expect(after.excludeAll).toEqual({ value: 'v' });
	});

	it('sees a class decorated after the caches were built', () => {
		applyClassTransformerMetadataPatches({});
		instanceToPlain(sample().employee);
		class Late {
			@Exclude() hidden: string;
			shown: string;
		}
		expect(instanceToPlain(Object.assign(new Late(), { hidden: 'h', shown: 's' }))).toEqual({ shown: 's' });
	});

	it('does nothing when switched off', () => {
		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const fresh = require('./class-transformer-metadata.patches');
			expect(fresh.applyClassTransformerMetadataPatches({ CLASS_TRANSFORMER_MEMOIZE_METADATA: 'false' })).toBe(false);
		});
	});
});
