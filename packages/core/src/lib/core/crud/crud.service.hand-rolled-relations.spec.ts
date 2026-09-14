import '../entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { EntityMetadata } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../context';
import { TagService } from '../../tags/tag.service';
import { CandidateService } from '../../candidate/candidate.service';
import { OrganizationTeamService } from '../../organization-team/organization-team.service';

/**
 * The sink-level assertion in `CrudService` only runs on the CRUD read methods. Several services
 * build their own query instead — `createQueryBuilder(...).setFindOptions({ relations })` — and so
 * never reach it, while still applying the client's `relations` verbatim.
 *
 * That matters because every tenant-scoped entity exposes an `organization` relation, so the
 * protected rows are reachable from any of those entities. `GET /api/tags` is the cheapest route of
 * all: its controller declares no permission whatsoever.
 *
 * These cases drive the real services with a fake repository, so a read that must be refused never
 * reaches the ORM.
 */
describe('sensitive-relation enforcement on hand-rolled queries', () => {
	const entity = (name: string, relations: Record<string, () => EntityMetadata> = {}): EntityMetadata =>
		({
			name,
			tableName: name.toLowerCase(),
			findRelationWithPropertyPath: (propertyPath: string) =>
				relations[propertyPath] ? { inverseEntityMetadata: relations[propertyPath]() } : undefined
		} as unknown as EntityMetadata);

	const ORGANIZATION = (): EntityMetadata => entity('Organization', { payments: () => entity('Payment') });
	const withOrganization = (name: string): EntityMetadata =>
		entity(name, { organization: ORGANIZATION, tags: () => entity('Tag', { organization: ORGANIZATION }) });

	let granted: PermissionsEnum[];

	const repositoryFor = (name: string) => ({
		metadata: withOrganization(name),
		createQueryBuilder: jest.fn(() => {
			throw new Error(`${name}: the query must not be built when the relation is refused`);
		}),
		findAndCount: jest.fn().mockResolvedValue([[], 0])
	});

	beforeEach(() => {
		granted = [];
		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('4a1b2c3d-5e6f-4708-8a9b-0c1d2e3f4a5b');
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: PermissionsEnum) =>
			granted.includes(permission)
		);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses GET /tags with a protected relation, in the plain array form', async () => {
		const repository = repositoryFor('Tag');
		const service = new TagService(repository as any, {} as any);

		await expect(service.findTags({} as any, ['organization.payments'])).rejects.toThrow(ForbiddenException);
		await expect(service.findTagsByLevel({} as any, ['organization.payments'])).rejects.toThrow(
			ForbiddenException
		);

		expect(repository.createQueryBuilder).not.toHaveBeenCalled();
	});

	it('refuses the candidate pagination with a protected relation', async () => {
		const repository = repositoryFor('Candidate');
		const service = new CandidateService(repository as any, {} as any);

		await expect(service.pagination({ relations: ['organization.payments'] })).rejects.toThrow(
			ForbiddenException
		);

		expect(repository.createQueryBuilder).not.toHaveBeenCalled();
	});

	it('refuses the organization-team listing with a protected relation', async () => {
		const repository = repositoryFor('OrganizationTeam');
		const dependencies = [repository, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}] as const;
		const service = new (OrganizationTeamService as any)(...dependencies) as OrganizationTeamService;

		await expect(service.findAll({ relations: ['organization.payments'] } as any)).rejects.toThrow(
			ForbiddenException
		);

		expect(repository.createQueryBuilder).not.toHaveBeenCalled();
	});

	it('lets an ordinary listing through untouched', async () => {
		const repository = repositoryFor('Tag');
		repository.createQueryBuilder = jest.fn(() => {
			throw new Error('reached the query builder');
		});
		const service = new TagService(repository as any, {} as any);

		// The relation is not in the table, so the assertion must not refuse it. Reaching the query
		// builder is the proof it got past the check.
		await expect(service.findTags({} as any, ['organization'])).rejects.toThrow('reached the query builder');
	});

	it('allows a protected relation to a caller who holds the permission', async () => {
		granted = [PermissionsEnum.ORG_PAYMENT_VIEW];
		const repository = repositoryFor('Tag');
		repository.createQueryBuilder = jest.fn(() => {
			throw new Error('reached the query builder');
		});
		const service = new TagService(repository as any, {} as any);

		await expect(service.findTags({} as any, ['organization.payments'])).rejects.toThrow(
			'reached the query builder'
		);
	});
});
