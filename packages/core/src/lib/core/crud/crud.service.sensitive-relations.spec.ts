import '../entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { EntityMetadata } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../context';
import { BaseEntity } from '../entities/internal';
import { MultiORMEnum } from '../utils';
import { CrudService } from './crud.service';

/**
 * Wiring spec for the sink-level enforcement: the logic lives in
 * `assertSensitiveRelationsAllowed` (see sensitive-relations.helper.spec.ts), but it only closes the
 * hole if every read path actually calls it. These cases drive the CRUD service itself with a fake
 * repository, so a read that should be refused never reaches the ORM at all.
 */
describe('CrudService sensitive-relation enforcement', () => {
	const entity = (name: string, relations: Record<string, () => EntityMetadata> = {}): EntityMetadata =>
		({
			name,
			tableName: name.toLowerCase(),
			findRelationWithPropertyPath: (propertyPath: string) =>
				relations[propertyPath] ? { inverseEntityMetadata: relations[propertyPath]() } : undefined
		} as unknown as EntityMetadata);

	const ORGANIZATION = (): EntityMetadata =>
		entity('Organization', {
			payments: () => entity('Payment'),
			contact: () => entity('OrganizationContact')
		});
	/** Any tenant-scoped entity: it reaches the organization, and through it the protected rows. */
	const TAG = (): EntityMetadata => entity('Tag', { organization: ORGANIZATION, user: () => entity('User') });

	/**
	 * A synthetic `CrudService` over the fake repository. It stands for any service that relies on the
	 * inherited read methods; it is not the real `TagService`, whose listing builds its own query (see
	 * crud.service.hand-rolled-relations.spec.ts).
	 */
	class SyntheticCrudService extends CrudService<BaseEntity> {
		constructor(repository: unknown) {
			super(repository as any, {} as any);
		}
	}

	let repository: { metadata: EntityMetadata; findAndCount: jest.Mock; find: jest.Mock; findOne: jest.Mock };
	let service: SyntheticCrudService;
	let granted: PermissionsEnum[];

	beforeEach(() => {
		granted = [];
		repository = {
			metadata: TAG(),
			findAndCount: jest.fn().mockResolvedValue([[], 0]),
			find: jest.fn().mockResolvedValue([]),
			findOne: jest.fn().mockResolvedValue({ id: 'row' })
		};
		service = new SyntheticCrudService(repository);

		// The read-path cases below reach the ORM branch; pin it so a `DB_ORM` set in the environment
		// cannot route them to the (unmocked) MikroORM repository instead.
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);

		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: PermissionsEnum) =>
			granted.includes(permission)
		);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		['array form', ['organization.payments']],
		['object form', { organization: { payments: { invoice: 'x' } } }]
	])('refuses findAll with a protected relation in %s', async (_label: string, relations: unknown) => {
		await expect(service.findAll({ relations } as any)).rejects.toThrow(ForbiddenException);
		expect(repository.findAndCount).not.toHaveBeenCalled();
	});

	it('refuses find() and findOneByIdString() alike', async () => {
		await expect(service.find({ relations: ['organization.payments'] } as any)).rejects.toThrow(
			ForbiddenException
		);
		await expect(
			service.findOneByIdString('7b1a…', { relations: { organization: { payments: true } } } as any)
		).rejects.toThrow(ForbiddenException);

		expect(repository.find).not.toHaveBeenCalled();
		expect(repository.findOne).not.toHaveBeenCalled();
	});

	it('refuses findOneOrFailByOptions rather than reporting a plain failure', async () => {
		// This one catches its own errors and answers `{ success: false }`; the refusal must not be
		// swallowed into that shape.
		await expect(
			service.findOneOrFailByOptions({ relations: ['organization.payments'] } as any)
		).rejects.toThrow(ForbiddenException);
	});

	it('runs the read once the caller holds the permission', async () => {
		granted = [PermissionsEnum.ORG_PAYMENT_VIEW];

		await expect(service.findAll({ relations: ['organization.payments'] } as any)).resolves.toEqual({
			items: [],
			total: 0
		});
		expect(repository.findAndCount).toHaveBeenCalled();
	});

	it('regression: the shape the Angular clients send still succeeds', async () => {
		// `relations[0]=organization&relations[1]=organization.contact&relations[2]=user`
		granted = [PermissionsEnum.ORG_CONTACT_VIEW];

		await expect(
			service.findAll({ relations: ['organization', 'organization.contact', 'user'] } as any)
		).resolves.toEqual({ items: [], total: 0 });
		expect(repository.findAndCount).toHaveBeenCalledWith(
			expect.objectContaining({
				relations: { organization: { contact: true }, user: true }
			})
		);
	});

	describe('loadRelationIds', () => {
		// The read methods pass the option object through to the repository, and TypeORM honours
		// `loadRelationIds`, which lists the ids of the named relations — or of all of them.
		const ORGANIZATION_ROOT = (): EntityMetadata =>
			({
				...entity('Organization', { payments: () => entity('Payment'), tags: () => entity('Tag') }),
				relations: [{ propertyPath: 'payments' }, { propertyPath: 'tags' }]
			} as unknown as EntityMetadata);

		beforeEach(() => {
			repository.metadata = ORGANIZATION_ROOT();
		});

		it.each([
			['naming the protected relation', { relations: ['payments'] }],
			['for every relation', true],
			['for every relation, with options', { disableMixedMap: true }],
			['with a null relation list, which TypeORM reads as every relation', { relations: null }],
			// TypeORM matches with `relations.indexOf(propertyPath)`, so a string is a substring match.
			['with a string whose substring is the protected relation', { relations: 'all-payments-list' }]
		])('refuses loadRelationIds %s', async (_label: string, loadRelationIds: unknown) => {
			await expect(service.findAll({ loadRelationIds } as any)).rejects.toThrow(ForbiddenException);
			expect(repository.findAndCount).not.toHaveBeenCalled();
		});

		it('allows loadRelationIds naming only unprotected relations', async () => {
			await expect(
				service.findAll({ loadRelationIds: { relations: ['tags'] } } as any)
			).resolves.toEqual({ items: [], total: 0 });
		});
	});

	it('regression: a read with no relations reaches the ORM untouched', async () => {
		await expect(service.findAll({ where: { id: 'x' } } as any)).resolves.toEqual({ items: [], total: 0 });
		expect(repository.findAndCount).toHaveBeenCalledWith({ where: { id: 'x' } });
	});
});
