import '../core/entities/internal';

import { RolesEnum } from '@gauzy/contracts';
import { IsNull } from 'typeorm';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { MultiORMEnum } from '../core/utils';
import { asTenantUser, createCrossTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { OrganizationTeamTagBulkCreateCommand } from './commands/organization-team-tag-bulk-create.command';
import { OrganizationTeamTagBulkCreateHandler } from './commands/handlers/organization-team-tag-bulk-create.handler';
import { MikroOrmTagRepository } from './repository/mikro-orm-tag.repository';
import { TypeOrmTagRepository } from './repository/type-orm-tag.repository';
import { tagNameKeyOf, TEAM_STARTER_TAGS } from './tag-name';
import { TagService } from './tag.service';

/**
 * Ever Teams tells a team's labels apart by name, in its task filters and pickers (ever-co/ever-teams#5016): a tag
 * of a team may not take a name its team has already, whatever its case, dashes or spaces. A tag of no team (an
 * organization's or the tenant's) is filed as before, any name included. A new team asked for them starts with a few
 * common labels, as its own tags.
 */
describe('TagService names', () => {
	const { tenantA } = createCrossTenantFixture();
	// The caller's organization (their token's): the one the organization boundary keeps them in
	const organizationId = tenantA.organizationId;
	// Another organization of the same tenant
	const otherOrganizationId = 'organization-b';
	const teamId = 'team-1';
	const scopeColumns = ['tenantId', 'organizationId', 'organizationTeamId'];

	let restore: () => void;
	let typeOrmFind: jest.Mock;
	let mikroOrmFind: jest.Mock;
	// The team read that places a team tag sent with no organization: none found unless a test says so
	let teamFind: jest.Mock;
	let createMany: jest.SpyInstance;
	let service: TagService;

	const useOrm = (orm: MultiORMEnum) => jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(orm);
	// The TypeORM criterion of the first read: a team in an organization is read with a second criterion for its tags
	// of no organization, so this returns the first (the organization's)
	const firstWhere = (call = 0) => {
		const where = typeOrmFind.mock.calls[call][0].where;
		return Array.isArray(where) ? where[0] : where;
	};

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
		useOrm(MultiORMEnum.TypeORM);
		typeOrmFind = jest.fn().mockResolvedValue([]);
		mikroOrmFind = jest.fn().mockResolvedValue([]);
		teamFind = jest.fn().mockResolvedValue(null);
		service = new TagService(
			{
				// The columns the scoping reads, the organization boundary's among them
				metadata: {
					tableName: 'tag',
					hasColumnWithPropertyPath: (path: string) => scopeColumns.includes(path)
				},
				find: typeOrmFind,
				manager: { findOne: teamFind }
			} as unknown as TypeOrmTagRepository,
			{ find: mikroOrmFind } as unknown as MikroOrmTagRepository
		);
		createMany = jest.spyOn(service, 'createMany').mockImplementation(async (entities) => entities as never);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	describe('tagNameKeyOf', () => {
		it('reads a name trimmed, in lower case, with dashes and runs of spaces as one space', () => {
			expect(tagNameKeyOf('  Follow-up ')).toBe('follow up');
			expect(tagNameKeyOf('follow   UP')).toBe('follow up');
			expect(tagNameKeyOf(null)).toBe('');
		});

		it('trims after the dashes become spaces, so a leading or trailing dash tells no names apart', () => {
			expect(tagNameKeyOf('Bug-')).toBe('bug');
			expect(tagNameKeyOf('-bug ')).toBe('bug');
		});
	});

	describe('assertNameIsFree', () => {
		it('refuses with 409 a name the team has already, whatever its case, dashes or spaces', async () => {
			typeOrmFind.mockResolvedValue([{ id: 'tag-1', name: 'Follow-up' }]);

			const refusal = service.assertNameIsFree({
				name: ' follow  UP ',
				organizationId,
				organizationTeamId: teamId
			});

			await expect(refusal).rejects.toBeInstanceOf(ApiException);
			await expect(refusal).rejects.toMatchObject({
				code: ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION,
				details: { field: 'name' }
			});
			await expect(refusal.catch((error) => error.getStatus())).resolves.toBe(409);
			const where = { tenantId: tenantA.tenantId, organizationId, organizationTeamId: teamId, isSystem: false };
			expect(typeOrmFind).toHaveBeenCalledWith({
				select: { id: true, name: true },
				where: [where, { ...where, organizationId: IsNull() }]
			});
		});

		it("counts the team's tags stored with no organization: a body may name only the team", async () => {
			// A tag filed by a body that named the team and no organization, then the same name in the team's organization
			typeOrmFind.mockImplementation(async ({ where }) =>
				// IsNull() is an operator object; an organization id is a string
				[where].flat().some((criterion) => typeof criterion.organizationId === 'object')
					? [{ id: 'tag-1', name: 'Bug' }]
					: []
			);

			await expect(
				service.assertNameIsFree({ name: 'bug', organizationId, organizationTeamId: teamId })
			).rejects.toBeInstanceOf(ApiException);
		});

		it('lets a tag keep its own name, and takes a name the team does not have', async () => {
			typeOrmFind.mockResolvedValue([{ id: 'tag-1', name: 'Bug' }]);

			await expect(
				service.assertNameIsFree({ name: 'bug', organizationId, organizationTeamId: teamId }, 'tag-1')
			).resolves.toBeUndefined();
			await expect(
				service.assertNameIsFree({ name: 'Feature', organizationId, organizationTeamId: teamId })
			).resolves.toBeUndefined();
		});

		it('checks no name of a tag of no team: an organization or tenant tag may share a name, as before', async () => {
			// An "Urgent" tag for invoices and another for tasks, in one organization or for the whole tenant
			typeOrmFind.mockResolvedValue([{ id: 'tag-1', name: 'Urgent' }]);

			await expect(service.assertNameIsFree({ name: 'urgent', organizationId })).resolves.toBeUndefined();
			await expect(
				service.assertNameIsFree({ name: 'Urgent', organization: { id: organizationId }, organizationTeam: null })
			).resolves.toBeUndefined();
			await expect(service.assertNameIsFree({ name: 'Urgent', organizationId: null })).resolves.toBeUndefined();
			expect(typeOrmFind).not.toHaveBeenCalled();
		});

		it('reads the team from the team object a body may send instead of its id', async () => {
			await service.assertNameIsFree({ name: 'Bug', organizationId, organizationTeam: { id: teamId } });

			expect(firstWhere()).toEqual({
				tenantId: tenantA.tenantId,
				organizationId,
				organizationTeamId: teamId,
				isSystem: false
			});
		});

		it('reads the scope from the organization object a body may send instead of its id', async () => {
			await service.assertNameIsFree({
				name: 'Bug',
				organization: { id: organizationId },
				organizationTeamId: teamId
			});

			expect(firstWhere()).toMatchObject({ organizationId, organizationTeamId: teamId });
		});

		it('reads the same scope on MikroORM', async () => {
			useOrm(MultiORMEnum.MikroORM);
			mikroOrmFind.mockResolvedValue([{ id: 'tag-1', name: 'Bug' }]);

			await expect(
				service.assertNameIsFree({ name: 'BUG', organizationId, organizationTeamId: teamId })
			).rejects.toBeInstanceOf(ApiException);
			expect(mikroOrmFind).toHaveBeenCalledWith({
				tenantId: tenantA.tenantId,
				organizationTeamId: teamId,
				isSystem: false,
				$or: [{ organizationId }, { organizationId: null }]
			});
		});

		it("checks a team tag sent with no organization in its team's organization, and with none", async () => {
			teamFind.mockResolvedValue({ organizationId });
			typeOrmFind.mockResolvedValue([{ id: 'tag-1', name: 'Bug' }]);

			await expect(service.assertNameIsFree({ name: 'bug', organizationTeamId: teamId })).rejects.toBeInstanceOf(
				ApiException
			);
			// The team is read in the caller's tenant only
			expect(teamFind).toHaveBeenCalledWith('organization_team', {
				select: { organizationId: true },
				where: { id: teamId, tenantId: tenantA.tenantId }
			});
			const where = typeOrmFind.mock.calls[0][0].where;
			expect(where).toEqual([
				{ tenantId: tenantA.tenantId, organizationId, organizationTeamId: teamId, isSystem: false },
				{ tenantId: tenantA.tenantId, organizationId: IsNull(), organizationTeamId: teamId, isSystem: false }
			]);
		});

		it("checks only the team's shared tags when a team sent with no organization is in one out of reach", async () => {
			teamFind.mockResolvedValue({ organizationId: otherOrganizationId });
			typeOrmFind.mockResolvedValue([{ id: 'tag-1', name: 'Bug' }]);

			// A shared tag (no organization) of the team has the name: still refused
			await expect(service.assertNameIsFree({ name: 'bug', organizationTeamId: teamId })).rejects.toBeInstanceOf(
				ApiException
			);
			// The other organization's tags are never read: only the team's tags of no organization
			expect(typeOrmFind.mock.calls[0][0].where).toEqual({
				tenantId: tenantA.tenantId,
				organizationId: IsNull(),
				organizationTeamId: teamId,
				isSystem: false
			});
		});

		it('places a team tag sent with no organization the same way on MikroORM', async () => {
			useOrm(MultiORMEnum.MikroORM);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const organizationOfTeam = jest.spyOn(service as any, 'organizationOfTeam').mockResolvedValue(organizationId);
			mikroOrmFind.mockResolvedValue([{ id: 'tag-1', name: 'Bug' }]);

			await expect(service.assertNameIsFree({ name: 'BUG', organizationTeamId: teamId })).rejects.toBeInstanceOf(
				ApiException
			);
			expect(organizationOfTeam).toHaveBeenCalledWith(tenantA.tenantId, teamId);
			expect(mikroOrmFind).toHaveBeenCalledWith({
				tenantId: tenantA.tenantId,
				organizationTeamId: teamId,
				isSystem: false,
				$or: [{ organizationId }, { organizationId: null }]
			});
		});

		it("reads a team's organization through the MikroORM entity manager, in the caller's tenant", async () => {
			useOrm(MultiORMEnum.MikroORM);
			const findOne = jest.fn().mockResolvedValue({ organizationId });
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const internals = service as any;
			internals.mikroOrmRepository = { getEntityManager: () => ({ findOne }) };

			await expect(internals.organizationOfTeam(tenantA.tenantId, teamId)).resolves.toBe(organizationId);
			expect(findOne).toHaveBeenCalledWith('OrganizationTeam', { id: teamId, tenantId: tenantA.tenantId });

			findOne.mockResolvedValue(null);
			await expect(internals.organizationOfTeam(tenantA.tenantId, teamId)).resolves.toBeNull();
		});

		it('has nothing to check without a name', async () => {
			await service.assertNameIsFree({ name: '  ', organizationId, organizationTeamId: teamId });

			expect(typeOrmFind).not.toHaveBeenCalled();
		});

		it('reads no names of an organization the caller cannot reach: the write refuses it, a 409 would tell', async () => {
			typeOrmFind.mockResolvedValue([{ id: 'tag-1', name: 'Bug' }]);

			await expect(
				service.assertNameIsFree({
					name: 'Bug',
					organizationId: otherOrganizationId,
					organizationTeamId: teamId
				})
			).resolves.toBeUndefined();
			await expect(
				service.assertNameIsFree({ name: 'Bug', organization: { id: otherOrganizationId } })
			).resolves.toBeUndefined();
			expect(typeOrmFind).not.toHaveBeenCalled();
		});

		it('checks a tenant admin, who reaches every organization, in any of them', async () => {
			jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(true);
			typeOrmFind.mockResolvedValue([{ id: 'tag-1', name: 'Bug' }]);

			await expect(
				service.assertNameIsFree({ name: 'bug', organizationId: otherOrganizationId, organizationTeamId: teamId })
			).rejects.toBeInstanceOf(ApiException);
			expect(firstWhere()).toMatchObject({ organizationId: otherOrganizationId });
			expect(RequestContext.hasRoles).toHaveBeenCalledWith([RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN]);
		});
	});

	describe('assertChangeIsFree', () => {
		const stored = { id: 'tag-2', name: 'Bug', organizationId, organizationTeamId: teamId } as never;

		it('lets a tag that shares its name with an older one change its colour, icon or description', async () => {
			typeOrmFind.mockResolvedValue([{ id: 'tag-1', name: 'Bug' }]);

			await expect(service.assertChangeIsFree(stored, { name: 'bug' }, 'tag-2')).resolves.toBeUndefined();
			await expect(service.assertChangeIsFree(stored, {}, 'tag-2')).resolves.toBeUndefined();
			expect(typeOrmFind).not.toHaveBeenCalled();
		});

		it('checks a new name, and a move to another team in that team, leaving the tag itself out', async () => {
			typeOrmFind.mockResolvedValue([{ id: 'tag-1', name: 'Feature' }]);
			await expect(service.assertChangeIsFree(stored, { name: 'feature' }, 'tag-2')).rejects.toBeInstanceOf(
				ApiException
			);

			typeOrmFind.mockReset().mockResolvedValue([]);
			await service.assertChangeIsFree(stored, { organizationTeamId: 'team-2' }, 'tag-2');
			expect(firstWhere()).toMatchObject({ organizationId, organizationTeamId: 'team-2' });
		});

		it('checks a change naming an organization the caller cannot reach where the tag stays: the update leaves it out', async () => {
			typeOrmFind.mockResolvedValue([{ id: 'tag-1', name: 'Feature' }]);

			// A rename: checked in the tag's own organization, which it keeps
			await expect(
				service.assertChangeIsFree(stored, { name: 'feature', organizationId: otherOrganizationId }, 'tag-2')
			).rejects.toBeInstanceOf(ApiException);
			expect(typeOrmFind).toHaveBeenCalledTimes(1);
			expect(firstWhere()).toMatchObject({ organizationId, organizationTeamId: teamId });

			// Nothing else: no change at all, nor is clearing the organization one
			await expect(
				service.assertChangeIsFree(stored, { organization: { id: otherOrganizationId } }, 'tag-2')
			).resolves.toBeUndefined();
			await expect(
				service.assertChangeIsFree(stored, { organizationId: null }, 'tag-2')
			).resolves.toBeUndefined();
			expect(typeOrmFind).toHaveBeenCalledTimes(1);
		});

		it('reads the organization of a change as the update does: the id first, even null', async () => {
			// A team tag stored with no organization, renamed with a body that clears its organization by id and names the
			// caller's by object: the update reads the id, leaves the organization out and keeps the tag where it is, where
			// the name is checked
			const tenantTag = { id: 'tag-3', name: 'Bug', organizationId: null, organizationTeamId: teamId } as never;
			typeOrmFind.mockResolvedValue([{ id: 'tag-1', name: 'Feature' }]);

			await expect(
				service.assertChangeIsFree(
					tenantTag,
					{ name: 'feature', organizationId: null, organization: { id: organizationId } },
					'tag-3'
				)
			).rejects.toBeInstanceOf(ApiException);
			expect(firstWhere()).toMatchObject({
				organizationId: IsNull(),
				organizationTeamId: teamId
			});
		});

		it('lets a tag of no team be renamed to a name its organization has, and lets a team tag leave its team', async () => {
			typeOrmFind.mockResolvedValue([{ id: 'tag-1', name: 'Feature' }]);
			const organizationTag = { id: 'tag-4', name: 'Bug', organizationId, organizationTeamId: null } as never;

			await expect(
				service.assertChangeIsFree(organizationTag, { name: 'feature' }, 'tag-4')
			).resolves.toBeUndefined();
			await expect(
				service.assertChangeIsFree(stored, { name: 'feature', organizationTeamId: null }, 'tag-2')
			).resolves.toBeUndefined();
			expect(typeOrmFind).not.toHaveBeenCalled();
		});

		it('checks a move to another organization by a tenant admin there', async () => {
			jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(true);

			await service.assertChangeIsFree(stored, { organizationId: otherOrganizationId }, 'tag-2');

			expect(firstWhere()).toMatchObject({
				organizationId: otherOrganizationId,
				organizationTeamId: teamId
			});
		});
	});

	describe('assertRecoveryIsFree', () => {
		it('refuses to bring back a tag whose name its scope gave to another tag after it was deleted', async () => {
			const deleted = { id: 'tag-1', name: 'Bug', isSystem: false, organizationId, organizationTeamId: teamId };
			const findOne = jest.spyOn(service, 'findOneByIdString').mockResolvedValue(deleted as never);
			typeOrmFind.mockResolvedValue([{ id: 'tag-9', name: 'bug' }]);

			await expect(service.assertRecoveryIsFree('tag-1')).rejects.toBeInstanceOf(ApiException);
			expect(findOne).toHaveBeenCalledWith('tag-1', { withDeleted: true });

			typeOrmFind.mockResolvedValue([]);
			await expect(service.assertRecoveryIsFree('tag-1')).resolves.toBeUndefined();
		});

		it('recovers a tag of no team as it is, whatever names its organization has', async () => {
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue({
				id: 'tag-1',
				name: 'Bug',
				isSystem: false,
				organizationId,
				organizationTeamId: null
			} as never);
			typeOrmFind.mockResolvedValue([{ id: 'tag-9', name: 'bug' }]);

			await expect(service.assertRecoveryIsFree('tag-1')).resolves.toBeUndefined();
			expect(typeOrmFind).not.toHaveBeenCalled();
		});

		it('recovers a system tag as it is', async () => {
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue({
				id: 'tag-1',
				name: 'Bug',
				isSystem: true
			} as never);

			await expect(service.assertRecoveryIsFree('tag-1')).resolves.toBeUndefined();
			expect(typeOrmFind).not.toHaveBeenCalled();
		});
	});

	describe('createTeamStarterTags', () => {
		const team = { id: teamId, organizationId };

		it('gives a new team the starter labels it does not have, as its own tags', async () => {
			typeOrmFind.mockResolvedValue([
				{ id: 'tag-1', name: 'bug' },
				{ id: 'tag-2', name: 'Needs-Review' }
			]);

			await service.createTeamStarterTags(team);

			const created = createMany.mock.calls[0][0];
			expect(created.map((tag: { name: string }) => tag.name)).toEqual(
				TEAM_STARTER_TAGS.map((tag) => tag.name).filter((name) => !['Bug', 'Needs Review'].includes(name))
			);
			expect(created[0]).toEqual({
				name: 'Feature',
				color: '#8957E5',
				isSystem: false,
				organizationId,
				organizationTeamId: teamId
			});
		});

		it('adds nothing to a team that has them all, and never fails the team on an error', async () => {
			typeOrmFind.mockResolvedValue(
				TEAM_STARTER_TAGS.map((tag, index) => ({ id: `tag-${index}`, name: tag.name }))
			);
			await expect(service.createTeamStarterTags(team)).resolves.toEqual([]);
			expect(createMany).not.toHaveBeenCalled();

			typeOrmFind.mockRejectedValue(new Error('database down'));
			await expect(service.createTeamStarterTags(team)).resolves.toEqual([]);
		});

		it('is what the command a new team sends does', async () => {
			const spy = jest.spyOn(service, 'createTeamStarterTags').mockResolvedValue([]);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await new OrganizationTeamTagBulkCreateHandler(service).execute(
				new OrganizationTeamTagBulkCreateCommand(team as any)
			);

			expect(spy).toHaveBeenCalledWith(team);
		});
	});
});
