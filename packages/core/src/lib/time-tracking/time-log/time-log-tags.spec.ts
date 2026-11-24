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

		it('binds an id sent in capitals as sent and as stored, lowercase, so SQLite finds the log it tags', () => {
			const { condition, parameters } = timeLogTagsCondition('"time_log"."id"', {
				tagIds: ['A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11', 'b1ffcd00-0d1c-4ef8-bb6d-6bb9bd380a22']
			});

			expect(parameters).toEqual({
				timeLogTag0: 'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11',
				timeLogTag1: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
				timeLogTag2: 'b1ffcd00-0d1c-4ef8-bb6d-6bb9bd380a22'
			});
			expect(condition).toContain('"filter_link"."tagId" IN (:timeLogTag0, :timeLogTag1, :timeLogTag2)');
		});

		it('binds an id sent as stored exactly as before, once', () => {
			const { parameters } = timeLogTagsCondition('"time_log"."id"', {
				tagIds: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11']
			});

			expect(parameters).toEqual({ timeLogTag0: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' });
		});

		it('compares the column as stored, without a function on it, so PostgreSQL keeps using its index', () => {
			const { condition } = timeLogTagsCondition('"time_log"."id"', {
				tagIds: ['A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11'],
				untagged: true
			});

			expect(condition).not.toMatch(/lower\s*\(|upper\s*\(/i);
			expect(condition).toContain('"filter_link"."tagId" IN (:timeLogTag0, :timeLogTag1)');
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
		const MEETING = '00000000-0000-4000-8000-0000000000a1';
		const EVERYWHERE = '00000000-0000-4000-8000-0000000000a2';
		const THEIRS = '00000000-0000-4000-8000-0000000000a3';
		const UNKNOWN = '00000000-0000-4000-8000-0000000000a4';

		const managerWith = (
			tags: Array<{ id: string; organizationId: string | null; name?: string; color?: string | null }>
		) => {
			const find = jest.fn().mockResolvedValue(tags);
			return { manager: { getRepository: () => ({ find }) } as any, find };
		};

		it('takes the tags of the organization and of the whole tenant', async () => {
			const { manager, find } = managerWith([
				{ id: EVERYWHERE, organizationId: null, name: 'everywhere', color: null },
				{ id: MEETING, organizationId: ORGANIZATION, name: 'meeting', color: '#2563eb' }
			]);

			await expect(
				timeLogTagsOf(manager, [MEETING, EVERYWHERE], { tenantId: TENANT, organizationId: ORGANIZATION })
			).resolves.toEqual([
				{ id: MEETING, name: 'meeting', color: '#2563eb' },
				{ id: EVERYWHERE, name: 'everywhere', color: null }
			]);
			expect(find.mock.calls[0][0].where.tenantId).toBe(TENANT);
		});

		it('refuses a tag of another organization, or one the tenant does not have, and names it', async () => {
			const { manager } = managerWith([
				{ id: MEETING, organizationId: ORGANIZATION },
				{ id: THEIRS, organizationId: 'organization-2' }
			]);

			const refusal = await timeLogTagsOf(manager, [MEETING, THEIRS, UNKNOWN], {
				tenantId: TENANT,
				organizationId: ORGANIZATION
			}).catch((error) => error);

			expect(refusal).toBeInstanceOf(BadRequestException);
			expect(refusal.getResponse()).toEqual(
				expect.objectContaining({ code: TIME_LOG_TAG_NOT_FOUND, tagIds: [THEIRS, UNKNOWN] })
			);
		});

		it('refuses a value that is not a tag id with the 400, without sending it to the database', async () => {
			const { manager, find } = managerWith([]);

			const refusal = await timeLogTagsOf(manager, ['meeting'], {
				tenantId: TENANT,
				organizationId: ORGANIZATION
			}).catch((error) => error);

			expect(refusal).toBeInstanceOf(BadRequestException);
			expect(refusal.getResponse()).toEqual(
				expect.objectContaining({ code: TIME_LOG_TAG_NOT_FOUND, tagIds: ['meeting'] })
			);
			expect(find).not.toHaveBeenCalled();
		});

		it('reads only the tag ids among the values sent, and names the others in the refusal', async () => {
			const { manager, find } = managerWith([{ id: MEETING, organizationId: ORGANIZATION }]);

			const refusal = await timeLogTagsOf(manager, [MEETING, 'not a tag'], {
				tenantId: TENANT,
				organizationId: ORGANIZATION
			}).catch((error) => error);

			expect(find.mock.calls[0][0].where.id.value).toEqual([MEETING]);
			expect(refusal.getResponse()).toEqual(
				expect.objectContaining({ code: TIME_LOG_TAG_NOT_FOUND, tagIds: ['not a tag'] })
			);
		});

		it('reads nothing for a write that clears the tags', async () => {
			const { manager, find } = managerWith([]);

			await expect(
				timeLogTagsOf(manager, [], { tenantId: TENANT, organizationId: ORGANIZATION })
			).resolves.toEqual([]);
			expect(find).not.toHaveBeenCalled();
		});

		it('refuses the tags, reading nothing, when the write has no tenant', async () => {
			const { manager, find } = managerWith([{ id: 'everywhere', organizationId: null }]);

			const refusal = await timeLogTagsOf(manager, ['everywhere'], {
				tenantId: undefined as unknown as string,
				organizationId: ORGANIZATION
			}).catch((error) => error);

			expect(refusal).toBeInstanceOf(BadRequestException);
			expect(find).not.toHaveBeenCalled();
		});
	});
});
