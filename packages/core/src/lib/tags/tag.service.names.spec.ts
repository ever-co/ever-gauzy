import '../core/entities/internal';

import { IsNull } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { MultiORMEnum } from '../core/utils';
import { asTenantUser, createCrossTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { OrganizationTeamTagBulkCreateCommand } from './commands/organization-team-tag-bulk-create.command';
import { OrganizationTeamTagBulkCreateHandler } from './commands/handlers/organization-team-tag-bulk-create.handler';
import { tagNameKeyOf, TEAM_STARTER_TAGS } from './tag-name';
import { TagService } from './tag.service';

/**
 * Ever Teams tells a team's labels apart by name, in its task filters and pickers (ever-co/ever-teams#5016): a tag
 * may not take a name its team (or, for a tag of no team, its organization) has already, whatever its case, dashes
 * or spaces. A new team starts with a few common labels, as its own tags.
 */
describe('TagService names', () => {
	const { tenantA } = createCrossTenantFixture();
	const organizationId = tenantA.organizationId;
	const teamId = 'team-1';

	let restore: () => void;
	let typeOrmFind: jest.Mock;
	let mikroOrmFind: jest.Mock;
	let createMany: jest.SpyInstance;
	let service: TagService;

	const useOrm = (orm: MultiORMEnum) => jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(orm);

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
		useOrm(MultiORMEnum.TypeORM);
		typeOrmFind = jest.fn().mockResolvedValue([]);
		mikroOrmFind = jest.fn().mockResolvedValue([]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		service = new TagService(
			{ metadata: { tableName: 'tag' }, find: typeOrmFind } as any,
			{ find: mikroOrmFind } as any
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
			expect(typeOrmFind).toHaveBeenCalledWith({
				select: { id: true, name: true },
				where: { tenantId: tenantA.tenantId, organizationId, organizationTeamId: teamId, isSystem: false }
			});
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

		it('compares a tag of no team with the tags of no team of its organization', async () => {
			await service.assertNameIsFree({ name: 'Bug', organizationId });

			expect(typeOrmFind.mock.calls[0][0].where).toEqual({
				tenantId: tenantA.tenantId,
				organizationId,
				organizationTeamId: IsNull(),
				isSystem: false
			});
		});

		it('reads the scope from the organization object a body may send instead of its id', async () => {
			await service.assertNameIsFree({
				name: 'Bug',
				organization: { id: organizationId },
				organizationTeamId: teamId
			});

			expect(typeOrmFind.mock.calls[0][0].where).toMatchObject({ organizationId, organizationTeamId: teamId });
		});

		it('reads the same scope on MikroORM', async () => {
			useOrm(MultiORMEnum.MikroORM);
			mikroOrmFind.mockResolvedValue([{ id: 'tag-1', name: 'Bug' }]);

			await expect(
				service.assertNameIsFree({ name: 'BUG', organizationId, organizationTeamId: teamId })
			).rejects.toBeInstanceOf(ApiException);
			expect(mikroOrmFind).toHaveBeenCalledWith({
				tenantId: tenantA.tenantId,
				organizationId,
				organizationTeamId: teamId,
				isSystem: false
			});
		});

		it('has nothing to check without a name', async () => {
			await service.assertNameIsFree({ name: '  ', organizationId, organizationTeamId: teamId });

			expect(typeOrmFind).not.toHaveBeenCalled();
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
			expect(typeOrmFind.mock.calls[0][0].where).toMatchObject({ organizationId, organizationTeamId: 'team-2' });
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
