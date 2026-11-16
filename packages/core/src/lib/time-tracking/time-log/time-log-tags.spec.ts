import { BadRequestException } from '@nestjs/common';
import { sentTagIds, timeLogTagsCondition, timeLogTagsOf, TIME_LOG_TAG_NOT_FOUND } from './time-log-tags';

const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';

describe('time log tags', () => {
	describe('sentTagIds', () => {
		it('answers nothing when a write sends no tags, so the log keeps its own', () => {
			expect(sentTagIds(undefined)).toBeUndefined();
			expect(sentTagIds(null)).toBeUndefined();
		});

		it('answers each tag once, and an empty list when the write clears them', () => {
			expect(sentTagIds(['meeting', 'design', 'meeting', ' '])).toEqual(['meeting', 'design']);
			expect(sentTagIds([])).toEqual([]);
		});

		it('reads one tag sent alone as a list of one, as a query string sends it', () => {
			expect(sentTagIds('meeting')).toEqual(['meeting']);
		});

		it('keeps each spelling of an id sent in both cases: SQLite compares ids by case, so a filter binds both', () => {
			expect(
				sentTagIds(['A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'])
			).toEqual(['A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11']);
		});
	});

	describe('timeLogTagsCondition', () => {
		it('narrows nothing without tags and without "no tag"', () => {
			expect(timeLogTagsCondition('"time_log"."id"', {})).toBeNull();
			expect(timeLogTagsCondition('"time_log"."id"', { tagIds: [], untagged: false })).toBeNull();
		});

		it('keeps a log that carries one of the tags, binding each tag once', () => {
			const { condition, parameters } = timeLogTagsCondition('"time_log"."id"', {
				tagIds: ['meeting', 'support', 'meeting']
			});

			expect(parameters).toEqual({ timeLogTag0: 'meeting', timeLogTag1: 'support' });
			expect(condition).toContain('EXISTS (SELECT 1 FROM "tag_time_log" "filter_link"');
			expect(condition).toContain('"filter_link"."timeLogId" = "time_log"."id"');
			expect(condition).toContain('"filter_link"."tagId" IN (:timeLogTag0, :timeLogTag1)');
			expect(condition).not.toContain('NOT EXISTS');
		});

		it('binds every spelling of an id asked in both cases, so a log stored under either one is kept', () => {
			const { parameters } = timeLogTagsCondition('"time_log"."id"', {
				tagIds: ['A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11']
			});

			expect(parameters).toEqual({
				timeLogTag0: 'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11',
				timeLogTag1: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
			});
		});

		it('counts live tags only', () => {
			const { condition } = timeLogTagsCondition('"time_log"."id"', { tagIds: ['meeting'] });

			expect(condition).toContain('"filter_tag"."deletedAt" IS NULL');
		});

		it('keeps the time that carries no tag, alone or beside the tags asked for', () => {
			const untagged = timeLogTagsCondition('"time_log"."id"', { untagged: true });
			expect(untagged.condition).toMatch(/^\(NOT EXISTS \(SELECT 1 FROM "tag_time_log"/);
			expect(untagged.parameters).toEqual({});

			const either = timeLogTagsCondition('"time_log"."id"', { tagIds: ['meeting'], untagged: true });
			expect(either.condition).toMatch(/^\(EXISTS \(.*\) OR NOT EXISTS \(.*\)\)$/);
		});
	});

	describe('timeLogTagsOf, an id in capitals', () => {
		it('takes a tag sent in capitals and answers its id as the database names it', async () => {
			const find = jest.fn().mockResolvedValue([
				{
					id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
					organizationId: ORGANIZATION,
					name: 'meeting',
					color: null
				}
			]);
			const manager = { getRepository: () => ({ find }) } as any;

			await expect(
				timeLogTagsOf(manager, ['A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11'], {
					tenantId: TENANT,
					organizationId: ORGANIZATION
				})
			).resolves.toEqual([{ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name: 'meeting', color: null }]);
		});

		it('answers a tag sent in both cases in one write once, so its link is written once', async () => {
			const find = jest.fn().mockResolvedValue([
				{
					id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
					organizationId: ORGANIZATION,
					name: 'meeting',
					color: null
				}
			]);
			const manager = { getRepository: () => ({ find }) } as any;

			await expect(
				timeLogTagsOf(
					manager,
					['A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'],
					{ tenantId: TENANT, organizationId: ORGANIZATION }
				)
			).resolves.toEqual([{ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name: 'meeting', color: null }]);
		});
	});

	describe('timeLogTagsOf', () => {
		const managerWith = (
			tags: Array<{ id: string; organizationId: string | null; name?: string; color?: string | null }>
		) => {
			const find = jest.fn().mockResolvedValue(tags);
			return { manager: { getRepository: () => ({ find }) } as any, find };
		};

		it('takes the tags of the organization and of the whole tenant', async () => {
			const { manager, find } = managerWith([
				{ id: 'everywhere', organizationId: null, name: 'everywhere', color: null },
				{ id: 'meeting', organizationId: ORGANIZATION, name: 'meeting', color: '#2563eb' }
			]);

			await expect(
				timeLogTagsOf(manager, ['meeting', 'everywhere'], { tenantId: TENANT, organizationId: ORGANIZATION })
			).resolves.toEqual([
				{ id: 'meeting', name: 'meeting', color: '#2563eb' },
				{ id: 'everywhere', name: 'everywhere', color: null }
			]);
			expect(find.mock.calls[0][0].where.tenantId).toBe(TENANT);
		});

		it('refuses a tag of another organization, or one the tenant does not have, and names it', async () => {
			const { manager } = managerWith([
				{ id: 'meeting', organizationId: ORGANIZATION },
				{ id: 'theirs', organizationId: 'organization-2' }
			]);

			const refusal = await timeLogTagsOf(manager, ['meeting', 'theirs', 'unknown'], {
				tenantId: TENANT,
				organizationId: ORGANIZATION
			}).catch((error) => error);

			expect(refusal).toBeInstanceOf(BadRequestException);
			expect(refusal.getResponse()).toEqual(
				expect.objectContaining({ code: TIME_LOG_TAG_NOT_FOUND, tagIds: ['theirs', 'unknown'] })
			);
		});

		it('reads nothing for a write that clears the tags', async () => {
			const { manager, find } = managerWith([]);

			await expect(
				timeLogTagsOf(manager, [], { tenantId: TENANT, organizationId: ORGANIZATION })
			).resolves.toEqual([]);
			expect(find).not.toHaveBeenCalled();
		});
	});
});
