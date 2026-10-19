import { HealthService } from './health.service';

/**
 * The database check of the health probe. Kubernetes calls it every few seconds on every pod, so what it runs is
 * the most frequent statement of the whole API: it must be the cheapest one that still proves the database answers
 * with the schema in place — one row of `user`, never a COUNT over the table (which, with the user's eager image
 * join, was 7 ms and 1.6 million calls a month on production).
 */
describe('HealthService database check', () => {
	const originalOrm = process.env.DB_ORM;

	afterEach(() => {
		if (originalOrm === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = originalOrm;
	});

	/** A health check service that runs every check and merges the results, as terminus does. */
	const healthCheckService = {
		check: jest.fn(async (checks: Array<() => Promise<Record<string, unknown>>>) => {
			const results = await Promise.all(checks.map((check) => check()));
			return { status: 'ok', info: Object.assign({}, ...results) };
		})
	};

	function queryBuilderStub() {
		const calls: string[] = [];
		const builder: any = {};
		for (const method of ['select', 'limit', 'orderBy', 'where']) {
			builder[method] = jest.fn((...args: unknown[]) => {
				calls.push(`${method}(${args.map((arg) => JSON.stringify(arg)).join(', ')})`);
				return builder;
			});
		}
		builder.getRawOne = jest.fn(async () => {
			calls.push('getRawOne()');
			return { user_id: 'first' };
		});
		return { builder, calls };
	}

	function build(ormType: 'typeorm' | 'mikro-orm') {
		process.env.DB_ORM = ormType;
		const { builder, calls } = queryBuilderStub();
		const typeOrmUserRepository = { count: jest.fn(), createQueryBuilder: jest.fn(() => builder) };
		const mikroOrmUserRepository = { count: jest.fn(), findAll: jest.fn(async () => [{ id: 'first' }]) };
		const service = new HealthService(
			{} as any,
			{ checkStorage: jest.fn(async () => ({ storage: { status: 'up' } })) } as any,
			healthCheckService as any,
			{} as any,
			{} as any,
			{ isHealthy: jest.fn(async () => ({ cache: { status: 'up' } })) } as any,
			{ isHealthy: jest.fn(async () => ({ redis: { status: 'up' } })) } as any,
			typeOrmUserRepository as any,
			mikroOrmUserRepository as any
		);
		return { service, typeOrmUserRepository, mikroOrmUserRepository, calls };
	}

	it('reads one row of user under TypeORM, and never counts the table', async () => {
		const { service, typeOrmUserRepository, calls } = build('typeorm');

		const result = await service.getHealthStatus();

		expect(result.info).toMatchObject({ database: { status: 'up' } });
		expect(typeOrmUserRepository.count).not.toHaveBeenCalled();
		expect(typeOrmUserRepository.createQueryBuilder).toHaveBeenCalledWith('user');
		expect(calls).toEqual(['select("user.id")', 'limit(1)', 'getRawOne()']);
	});

	it('reads one row of user under MikroORM, and never counts the table', async () => {
		const { service, mikroOrmUserRepository, typeOrmUserRepository } = build('mikro-orm');

		const result = await service.getHealthStatus();

		expect(result.info).toMatchObject({ database: { status: 'up' } });
		expect(mikroOrmUserRepository.count).not.toHaveBeenCalled();
		expect(mikroOrmUserRepository.findAll).toHaveBeenCalledWith({ fields: ['id'], limit: 1 });
		expect(typeOrmUserRepository.createQueryBuilder).not.toHaveBeenCalled();
	});

	it('reports the database down when the row cannot be read', async () => {
		const { service, typeOrmUserRepository } = build('typeorm');
		const { builder } = queryBuilderStub();
		builder.getRawOne.mockRejectedValue(new Error('timeout exceeded when trying to connect'));
		typeOrmUserRepository.createQueryBuilder.mockReturnValue(builder);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);

		const result = await service.getHealthStatus();

		expect(result.info).toMatchObject({
			database: { status: 'down', message: 'timeout exceeded when trying to connect' }
		});
	});
});
