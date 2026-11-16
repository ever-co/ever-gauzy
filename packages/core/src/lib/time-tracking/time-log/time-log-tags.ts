import { BadRequestException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { raw } from '@mikro-orm/core';
import { ID, ITag, ITimeLog, ITimeLogFilters, ITimeLogTag } from '@gauzy/contracts';
import { prepareSQLQuery as p } from '../../database/database.helper';
import { Tag } from '../../tags/tag.entity';

/**
 * The tags of a time log (ever-co/ever-gauzy#12029): the kind of work the time is filed under, whatever its task. They
 * live in `tag_time_log`. Everything that writes, reads or filters them goes through this file, so every write checks
 * them the same way and every read answers the same live tags.
 */

/** The code of the refusal of a tag that is not one the log may carry. */
export const TIME_LOG_TAG_NOT_FOUND = 'TIME_LOG_TAG_NOT_FOUND';

/** Logs per tag read: keeps the IN list within every database's limits. */
const TAG_READ_CHUNK = 1000;

/** Where a time log is written: the tags it may carry are of its tenant, and of its organization or of no one. */
export interface ITimeLogTagScope {
	tenantId: ID;
	organizationId: ID;
}

/** A tag condition on a time log read, quoted for the database in use, with the values it binds. */
export interface ITimeLogTagCondition {
	condition: string;
	parameters: Record<string, ID>;
}

/**
 * The tags a write sends, each once: `undefined` when it sends none, so the log keeps the tags it has.
 *
 * @param tags The `tags` of a body.
 * @returns The tag ids, or `undefined`.
 */
export function sentTagIds(tags: unknown): ID[] | undefined {
	if (tags === undefined || tags === null) {
		return undefined;
	}
	const sent = Array.isArray(tags) ? tags : [tags];
	const ids = sent.map((tag) => String(tag ?? '').trim()).filter((id) => id.length > 0);
	return [...new Set(ids)];
}

/**
 * The tags a time log is filed under, checked before anything is written: each one a live tag of the log's tenant,
 * and of the log's organization or of the whole tenant. A tag of another organization or tenant, or one that does not
 * exist, refuses the write (400) and names it.
 *
 * @param manager The manager the tags are read with.
 * @param tagIds The tags the write sends.
 * @param scope The tenant and the organization of the log.
 * @returns The tags, as the relation is written.
 * @throws BadRequestException with the code TIME_LOG_TAG_NOT_FOUND.
 */
export async function timeLogTagsOf(manager: EntityManager, tagIds: ID[], scope: ITimeLogTagScope): Promise<ITag[]> {
	if (tagIds.length === 0) {
		return [];
	}
	const found = await manager.getRepository(Tag).find({
		select: { id: true, organizationId: true, name: true, color: true },
		where: { id: In(tagIds), tenantId: scope.tenantId }
	});
	// Ids compared in their canonical form: PostgreSQL finds a tag sent in capitals and answers its id in lowercase
	const usable = new Set(
		found
			.filter((tag) => isTagOfOrganization(tag.organizationId, scope.organizationId))
			.map((tag) => canonicalIdOf(tag.id))
	);
	const refused = tagIds.filter((id) => !usable.has(canonicalIdOf(id)));
	if (refused.length > 0) {
		throw new BadRequestException({
			message: 'A tag of another organization or tenant cannot be put on this time.',
			code: TIME_LOG_TAG_NOT_FOUND,
			tagIds: refused
		});
	}
	const foundById = new Map(found.map((tag) => [canonicalIdOf(tag.id), tag]));
	return tagIds.map((id) => {
		const tag = foundById.get(canonicalIdOf(id));
		return { id: tag.id, name: tag.name, color: tag.color } as ITag;
	});
}

/**
 * The tags a write links, or nothing when it links none: a body without tags is written as before.
 *
 * @param tags The tags checked by `timeLogTagsOf`.
 * @returns The tags, or undefined for none.
 */
export function tagsToLink(tags: ITag[]): ITag[] | undefined {
	if (tags.length === 0) {
		return undefined;
	}
	return tags;
}

/** A uuid as the database answers it, whatever case it was sent in. */
function canonicalIdOf(id: ID): string {
	return String(id).toLowerCase();
}

/** Whether a tag belongs to the organization: its own, or one of the whole tenant. */
function isTagOfOrganization(tagOrganizationId: ID | null | undefined, organizationId: ID): boolean {
	const isOfWholeTenant = tagOrganizationId === null || tagOrganizationId === undefined;
	return isOfWholeTenant || String(tagOrganizationId) === String(organizationId);
}

/**
 * Puts on each log the live tags it carries (`id`, `name`, `color`, by name), read in one query per thousand logs. A
 * log without tags gets an empty list; a deleted tag is never answered.
 *
 * @param manager The manager the tags are read with.
 * @param logs The logs, as read.
 */
export async function loadTimeLogTags(manager: EntityManager, logs: ITimeLog[]): Promise<void> {
	const present = logs.filter((log) => Boolean(log?.id));
	const tagsByLog = new Map<string, ITimeLogTag[]>();
	const ids = [...new Set(present.map((log) => String(log.id)))];
	for (let offset = 0; offset < ids.length; offset += TAG_READ_CHUNK) {
		const timeLogIds = ids.slice(offset, offset + TAG_READ_CHUNK);
		const rows = await manager
			.createQueryBuilder()
			.select(p(`"link"."timeLogId"`), 'timeLogId')
			.addSelect(p(`"tag"."id"`), 'id')
			.addSelect(p(`"tag"."name"`), 'name')
			.addSelect(p(`"tag"."color"`), 'color')
			.from(p('tag_time_log'), p('link'))
			.innerJoin(p('tag'), p('tag'), p(`"tag"."id" = "link"."tagId" AND "tag"."deletedAt" IS NULL`))
			.where(p(`"link"."timeLogId" IN (:...timeLogIds)`), { timeLogIds })
			.orderBy(p(`"tag"."name"`), 'ASC')
			.addOrderBy(p(`"tag"."id"`), 'ASC')
			.getRawMany<{ timeLogId: ID; id: ID; name: string; color: string }>();
		for (const { timeLogId, id, name, color } of rows) {
			const key = String(timeLogId);
			const tags = tagsByLog.get(key) ?? [];
			tags.push({ id, name, color });
			tagsByLog.set(key, tags);
		}
	}
	for (const log of present) {
		log.tags = (tagsByLog.get(String(log.id)) ?? []) as ITimeLog['tags'];
	}
}

/**
 * Locks the log's row for the rest of the transaction, so that two changes of its tags run one after the other: without
 * it, both could take off the tags before either puts its own on, and the log would end under both lists. SQLite runs
 * one write at a time and has no row lock.
 *
 * @param transaction The transaction the change runs in.
 * @param timeLogId The log.
 */
async function lockTimeLog(transaction: EntityManager, timeLogId: ID): Promise<void> {
	const type = transaction.connection.options.type;
	const locksRows = type === 'postgres' || type === 'mysql';
	if (!locksRows) {
		return;
	}
	await transaction
		.createQueryBuilder()
		.select(p('"log"."id"'), 'id')
		.from(p('time_log'), p('log'))
		.where(p('"log"."id" = :timeLogId'), { timeLogId })
		.setLock('pessimistic_write')
		.getRawOne();
}

/**
 * Files a log under exactly these tags, in one transaction: the tags it no longer carries are taken off, the new ones
 * put on. Nothing else of the log changes, which is how a running log's tags change while it runs.
 *
 * @param manager The manager the change is written with.
 * @param timeLogId The log.
 * @param tagIds The tags it carries from now on, already checked (`timeLogTagsOf`).
 */
export async function replaceTimeLogTags(manager: EntityManager, timeLogId: ID, tagIds: ID[]): Promise<void> {
	await manager.transaction(async (transaction) => {
		await lockTimeLog(transaction, timeLogId);
		await transaction
			.createQueryBuilder()
			.delete()
			.from(p('tag_time_log'))
			.where(p(`"timeLogId" = :timeLogId`), { timeLogId })
			.execute();
		if (tagIds.length === 0) {
			return;
		}
		await transaction
			.createQueryBuilder()
			.insert()
			.into(p('tag_time_log'), ['timeLogId', 'tagId'])
			.values(tagIds.map((tagId) => ({ timeLogId, tagId })))
			.execute();
	});
}

/**
 * The condition a read narrows its logs with when it filters by tag: a log matches when it carries one of `tagIds`, or,
 * with `untagged`, when it carries none (with both, either). Only live tags count. Nothing to narrow by answers null.
 *
 * @param timeLogIdColumn The log's id, qualified by the name the statement gives the table.
 * @param filter The tags the read asks for.
 * @returns The condition and its values, or null.
 */
export function timeLogTagsCondition(
	timeLogIdColumn: string,
	filter: Pick<ITimeLogFilters, 'tagIds' | 'untagged'>
): ITimeLogTagCondition | null {
	const tagIds = sentTagIds(filter?.tagIds) ?? [];
	const filtersByTag = tagIds.length > 0;
	const keepsUntagged = filter?.untagged === true;
	if (!filtersByTag && !keepsUntagged) {
		return null;
	}
	const parameters: Record<string, ID> = {};
	const liveTagLinks =
		`FROM "tag_time_log" "filter_link" ` +
		`INNER JOIN "tag" "filter_tag" ON "filter_tag"."id" = "filter_link"."tagId" AND "filter_tag"."deletedAt" IS NULL ` +
		`WHERE "filter_link"."timeLogId" = ${timeLogIdColumn}`;
	const alternatives: string[] = [];
	if (filtersByTag) {
		const names = tagIds.map((id, index) => {
			const name = `timeLogTag${index}`;
			parameters[name] = id;
			return `:${name}`;
		});
		alternatives.push(`EXISTS (SELECT 1 ${liveTagLinks} AND "filter_link"."tagId" IN (${names.join(', ')}))`);
	}
	if (keepsUntagged) {
		alternatives.push(`NOT EXISTS (SELECT 1 ${liveTagLinks})`);
	}
	return { condition: p(`(${alternatives.join(' OR ')})`), parameters };
}

/**
 * {@link timeLogTagsCondition} as a key of a MikroORM read's `where`, on the alias the read gives the time log, or null
 * when the read narrows by no tag. A raw key is consumed by the statement that reads it: each read gets its own.
 *
 * @param filter The tags the read asks for.
 * @returns The key, whose value is an empty list, or null.
 */
export function mikroOrmTimeLogTagsKey(filter: Pick<ITimeLogFilters, 'tagIds' | 'untagged'>): string | null {
	const probe = timeLogTagsCondition('"time_log"."id"', filter);
	if (!probe) {
		return null;
	}
	return raw((alias: string) => timeLogTagsCondition(`${alias}."id"`, filter).condition, probe.parameters);
}
