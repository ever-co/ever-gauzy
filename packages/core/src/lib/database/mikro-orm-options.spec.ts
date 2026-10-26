import { mikroOrmOptionsForActiveOrm } from './mikro-orm-options';

describe('mikroOrmOptionsForActiveOrm', () => {
	const env = process.env.DB_ORM;
	afterEach(() => {
		if (env === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = env;
	});

	it('keeps MikroORM idle under TypeORM: no boot connection, no per-request fork', () => {
		process.env.DB_ORM = 'typeorm';
		expect(mikroOrmOptionsForActiveOrm({ dbName: 'x', pool: { min: 0 } })).toEqual({
			dbName: 'x',
			pool: { min: 0 },
			connect: false,
			ensureDatabase: false,
			registerRequestContext: false,
			allowGlobalContext: true
		});
	});

	it('leaves the options exactly as they are under DB_ORM=mikro-orm', () => {
		process.env.DB_ORM = 'mikro-orm';
		const options = { dbName: 'x' };
		expect(mikroOrmOptionsForActiveOrm(options)).toBe(options);
	});
});
