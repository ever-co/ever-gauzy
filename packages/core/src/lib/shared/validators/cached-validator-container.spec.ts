import '../../core/entities/internal';

import { INestApplicationContext, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getFromContainer, IsString, IsUUID, useContainer, validate } from 'class-validator';
import { RequestContext } from '../../core/context';
import { MikroOrmUserOrganizationRepository } from '../../user-organization/repository/mikro-orm-user-organization.repository';
import { TypeOrmUserOrganizationRepository } from '../../user-organization/repository/type-orm-user-organization.repository';
import { CachedValidatorContainer, ValidatorProviderSource } from './cached-validator-container';
import { OrganizationBelongsToUserConstraint } from './constraints/organization-belongs-to-user.constraint';
import { IsOrganizationBelongsToUser } from './is-organization-belongs-to-user.decorator';

jest.mock('../../core/utils', () => ({
	...jest.requireActual('../../core/utils'),
	getORMType: () => 'typeorm'
}));

const TENANT_ID = '5c7d8e9f-0000-4000-8000-000000000001';
const USER_ID = '5c7d8e9f-0000-4000-8000-0000000000a1';
const OWN_ORGANIZATION_ID = '5c7d8e9f-0000-4000-8000-0000000000b1';
const FOREIGN_ORGANIZATION_ID = '5c7d8e9f-0000-4000-8000-0000000000b3';

/** The membership table the DI-provided constraint reads through its injected repository. */
const findOneByOrFail = jest.fn(async (where: Record<string, unknown>) => {
	if (
		where['tenantId'] === TENANT_ID &&
		where['userId'] === USER_ID &&
		where['organizationId'] === OWN_ORGANIZATION_ID
	) {
		return { id: 'user-organization-1' };
	}
	throw new Error('EntityNotFoundError');
});

/** `ValidatorModule` in miniature: the database-backed constraint, with its repositories. */
@Module({
	providers: [
		OrganizationBelongsToUserConstraint,
		{ provide: TypeOrmUserOrganizationRepository, useValue: { findOneByOrFail } },
		{ provide: MikroOrmUserOrganizationRepository, useValue: {} }
	]
})
class SpecValidatorModule {}

/** A DTO mixing built-in constraints (not Nest providers) with a DI-provided one. */
class Payload {
	@IsString()
	name: string;

	@IsUUID()
	id: string;

	@IsOrganizationBelongsToUser()
	organizationId: string;
}

const payload = (organizationId: string) =>
	Object.assign(new Payload(), { name: 'Ada', id: '5c7d8e9f-0000-4000-8000-0000000000c1', organizationId });

/** Every lookup a container made against Nest, and whether Nest threw for it. */
interface Lookup {
	type: Function;
	threw: boolean;
}

/**
 * Nest's context, recording each lookup — what class-validator's per-constraint cost is made of. Usable as
 * the adapter's source and, for the control, as class-validator's container itself (which passes no options).
 */
function recording(
	context: INestApplicationContext,
	lookups: Lookup[]
): ValidatorProviderSource & { get(type: Function, options?: { strict: boolean }): unknown } {
	return {
		get: (type: Function, options?: { strict: boolean }) => {
			try {
				const instance = context.get(type, options);
				lookups.push({ type, threw: false });
				return instance;
			} catch (error) {
				lookups.push({ type, threw: true });
				throw error;
			}
		}
	};
}

describe('CachedValidatorContainer', () => {
	let context: INestApplicationContext;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [SpecValidatorModule] }).compile();
		// As the bootstrap does: `app.select(ValidatorModule)`.
		context = moduleRef.select(SpecValidatorModule);
	});

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(USER_ID);
		// The caller's token names their own organization, the only one the organization boundary lets a non-admin name.
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OWN_ORGANIZATION_ID);
		findOneByOrFail.mockClear();
	});

	afterEach(() => jest.restoreAllMocks());

	it('answers a DI-provided constraint with the Nest provider and its injected repository', async () => {
		const container = new CachedValidatorContainer(context);

		const constraint = container.get(OrganizationBelongsToUserConstraint);
		expect(constraint).toBe(context.get(OrganizationBelongsToUserConstraint, { strict: false }));
		expect(constraint.typeOrmUserOrganizationRepository).toEqual({ findOneByOrFail });

		useContainer(container, { fallbackOnErrors: true });
		await expect(validate(payload(OWN_ORGANIZATION_ID))).resolves.toEqual([]);
		const errors = await validate(payload(FOREIGN_ORGANIZATION_ID));
		expect(errors.map((error) => error.property)).toEqual(['organizationId']);
		// The own organization's verdict came from the injected repository, i.e. from the Nest instance. The foreign one
		// is refused before any lookup: it is not the organization of the caller's token.
		expect(findOneByOrFail).toHaveBeenCalledTimes(1);
	});

	it('asks Nest about each class once: no lookup, and so no thrown exception, after the first validation', async () => {
		const lookups: Lookup[] = [];
		useContainer(new CachedValidatorContainer(recording(context, lookups)), { fallbackOnErrors: true });

		await expect(validate(payload(OWN_ORGANIZATION_ID))).resolves.toEqual([]);
		const firstValidation = lookups.length;
		// class-validator's Validator and the two built-in constraints are not Nest providers.
		expect(lookups.filter(({ threw }) => threw).length).toBeGreaterThanOrEqual(3);
		expect(lookups.filter(({ threw }) => !threw).map(({ type }) => type)).toEqual([
			OrganizationBelongsToUserConstraint
		]);
		// Each class asked about exactly once.
		expect(new Set(lookups.map(({ type }) => type)).size).toBe(lookups.length);

		await expect(validate(payload(OWN_ORGANIZATION_ID))).resolves.toEqual([]);
		await expect(validate(payload(FOREIGN_ORGANIZATION_ID))).resolves.toHaveLength(1);
		expect(lookups).toHaveLength(firstValidation);
	});

	it('CONTROL: the Nest context handed to class-validator directly throws again on every validation', async () => {
		const lookups: Lookup[] = [];
		// The bootstrap's previous setup.
		useContainer(recording(context, lookups), { fallbackOnErrors: true });

		await expect(validate(payload(OWN_ORGANIZATION_ID))).resolves.toEqual([]);
		const thrownByFirst = lookups.filter(({ threw }) => threw).length;
		await expect(validate(payload(OWN_ORGANIZATION_ID))).resolves.toEqual([]);

		expect(thrownByFirst).toBeGreaterThanOrEqual(3);
		expect(lookups.filter(({ threw }) => threw)).toHaveLength(2 * thrownByFirst);
	});

	describe("class-validator's default-container semantics, for classes Nest does not provide", () => {
		class Plain {
			static constructed = 0;
			constructor() {
				Plain.constructed++;
			}
		}

		const notProvided = () => ({
			get: jest.fn(() => {
				throw new Error('Nest could not find Plain element');
			})
		});

		beforeEach(() => (Plain.constructed = 0));

		it('creates the instance once and returns that same instance every time', () => {
			const source = notProvided();
			const container = new CachedValidatorContainer(source);

			const first = container.get(Plain);
			expect(first).toBeInstanceOf(Plain);
			expect(container.get(Plain)).toBe(first);
			expect(Plain.constructed).toBe(1);
			expect(source.get).toHaveBeenCalledTimes(1);
		});

		it('is what class-validator itself resolves through `getFromContainer`', () => {
			const container = new CachedValidatorContainer(notProvided());
			useContainer(container, { fallbackOnErrors: true });

			expect(getFromContainer(Plain)).toBe(getFromContainer(Plain));
			expect(getFromContainer(Plain)).toBe(container.get(Plain));
			expect(Plain.constructed).toBe(1);
		});

		it('passes a falsy answer from Nest through without caching it, as class-validator does', () => {
			const source = { get: jest.fn(() => undefined) };
			const container = new CachedValidatorContainer(source);

			expect(container.get(Plain)).toBeUndefined();
			expect(container.get(Plain)).toBeUndefined();
			expect(source.get).toHaveBeenCalledTimes(2);
			expect(Plain.constructed).toBe(0);
		});

		it('caches nothing for a constructor that throws, and lets the error through', () => {
			let attempts = 0;
			class Broken {
				constructor() {
					attempts++;
					throw new Error('cannot construct');
				}
			}
			const container = new CachedValidatorContainer(notProvided());

			expect(() => container.get(Broken)).toThrow('cannot construct');
			expect(() => container.get(Broken)).toThrow('cannot construct');
			expect(attempts).toBe(2);
		});
	});
});
