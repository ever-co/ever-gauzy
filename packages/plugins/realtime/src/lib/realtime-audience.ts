import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { BaseEntityEnum, ID, PermissionsEnum, REALTIME_EVENT_NAMES } from '@gauzy/contracts';
import {
	CommentParentAccessService,
	isSpellingOfRecordType,
	isWithinOrganizationBoundary,
	RequestContext,
	SubscriptionCatalogue
} from '@gauzy/core';
import type { SubscriptionAudienceCheck, SubscriptionAudienceEvent, SubscriptionAudienceSubscriber } from '@gauzy/core';
import { DocumentService } from '@gauzy/plugin-docs';

/** The task facts, which follow the task read rule. */
export const REALTIME_TASK_EVENTS: readonly string[] = [
	REALTIME_EVENT_NAMES.TASK_CREATED,
	REALTIME_EVENT_NAMES.TASK_UPDATED,
	REALTIME_EVENT_NAMES.TASK_DELETED
];

/** The comment facts, which follow the read rule of the record whose comments changed. */
export const REALTIME_COMMENT_EVENTS: readonly string[] = [
	REALTIME_EVENT_NAMES.COMMENT_CREATED,
	REALTIME_EVENT_NAMES.COMMENT_UPDATED,
	REALTIME_EVENT_NAMES.COMMENT_DELETED
];

/**
 * The permissions the task reads ask for (`TaskController`: any one of them). With the caller's organization
 * boundary, which the tenant-aware reads apply, they are the whole task read rule: a task carries no per-record
 * visibility of its own (`Task.public` is not read by any task query).
 */
export const TASK_READ_PERMISSIONS: readonly PermissionsEnum[] = [
	PermissionsEnum.ALL_ORG_VIEW,
	PermissionsEnum.ORG_TASK_VIEW
];

/** The most ids one audience query names: one query for a whole catch-up page, far from any bound-parameter limit. */
export const AUDIENCE_QUERY_CHUNK = 500;

/**
 * Decides which of a batch of events a subscriber may receive: every check of an event's name must admit it.
 *
 * Each check is called **once** with all the events of the batch it applies to (a catch-up page is one batch, a live
 * event another), so a check that queries does one query per batch, never one per event. An event no check applies
 * to is admitted: its recipients and its scope were already decided.
 *
 * @param events The events, in order.
 * @param subscriber The subscriber.
 * @param checksOf The checks of one event name.
 * @returns One verdict per event, in order.
 * @throws When a check throws or does not answer one verdict per event: the caller refuses rather than guesses (a
 * catch-up fails, so the client asks again; a live event is dropped).
 */
export async function screenAudience(
	events: readonly SubscriptionAudienceEvent[],
	subscriber: SubscriptionAudienceSubscriber,
	checksOf: (name: string) => readonly SubscriptionAudienceCheck[]
): Promise<boolean[]> {
	const verdicts = events.map(() => true);
	const batches = new Map<SubscriptionAudienceCheck, number[]>();
	events.forEach((event, index) => {
		for (const check of checksOf(event.name)) {
			const indexes = batches.get(check) ?? [];
			indexes.push(index);
			batches.set(check, indexes);
		}
	});
	await Promise.all(
		Array.from(batches, async ([check, indexes]) => {
			const answers = await check(
				indexes.map((index) => events[index]),
				subscriber
			);
			if (!Array.isArray(answers) || answers.length !== indexes.length) {
				throw new Error(
					`An audience check answered ${Array.isArray(answers) ? answers.length : 'no'} verdicts for ${indexes.length} events.`
				);
			}
			indexes.forEach((eventIndex, position) => {
				if (answers[position] !== true) verdicts[eventIndex] = false;
			});
		})
	);
	return verdicts;
}

/** The organization a hint belongs to, as its payload states it. */
function organizationOf(event: SubscriptionAudienceEvent): string | null {
	const organizationId = event.data?.['organizationId'];
	return typeof organizationId === 'string' && organizationId ? organizationId : null;
}

/** The record whose comments a comment hint says changed. */
function parentOf(event: SubscriptionAudienceEvent): { entity: string; entityId: string } | null {
	const parent = event.data?.['parent'] as { entity?: unknown; entityId?: unknown } | null | undefined;
	if (
		!parent ||
		typeof parent.entity !== 'string' ||
		!parent.entity ||
		typeof parent.entityId !== 'string' ||
		!parent.entityId
	) {
		return null;
	}
	return { entity: parent.entity, entityId: parent.entityId };
}

/** The values of a list in slices of at most `size`. */
function chunked<T>(values: readonly T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let start = 0; start < values.length; start += size) {
		chunks.push(values.slice(start, start + size));
	}
	return chunks;
}

/**
 * Who may receive a collaboration fact, decided when it is handed to a connection — live and in the catch-up alike.
 *
 * The hints the channel files itself are organization-wide on the outbox (their readers are not known when they are
 * written, and an organization-wide page has as many readers as the organization has members), so their audience is
 * decided at delivery, in the subscriber's request context, by the rule of the record they name:
 *
 * - `document.updated`: the Docs read rule — `DOCS_READ` and the documents visibility scope (organization, creator,
 *   team space, shares, `DOCS_MANAGE`) through `DocumentService.filterReadableDocumentIds`, the predicate every docs
 *   list path uses; trashed pages included, since a `deleted` fact names one;
 * - `task.*`: the task read rule — `ALL_ORG_VIEW` or `ORG_TASK_VIEW`, inside the caller's organization boundary;
 * - `comment.*`: the rule of the record whose comments changed — a page's or a task's as above, a record with a
 *   comment-access policy (a contact's notes) through that policy, any other record the comment API's own rule (the
 *   tenant and organization the stream already checked).
 *
 * Other plugins narrow their own events through {@link SubscriptionCatalogue.restrictAudience} (the chat plugin
 * rechecks current conversation membership); their checks are applied here as well, after the channel's own.
 */
@Injectable()
export class RealtimeAudience {
	private readonly own = new Map<string, SubscriptionAudienceCheck>();
	private readonly providers = new Map<unknown, unknown>();
	/** The document read-scope queries in flight, by subscriber and question (see `readableIn`). */
	private readonly documentLookups = new Map<string, Promise<ID[]>>();

	constructor(private readonly moduleRef: ModuleRef) {
		const documents: SubscriptionAudienceCheck = (events) => this.documentVerdicts(events);
		const tasks: SubscriptionAudienceCheck = (events) =>
			events.map((event) => this.mayReadTasksOf(organizationOf(event)));
		const comments: SubscriptionAudienceCheck = (events) => this.commentVerdicts(events);
		this.own.set(REALTIME_EVENT_NAMES.DOCUMENT_UPDATED, documents);
		for (const name of REALTIME_TASK_EVENTS) this.own.set(name, tasks);
		for (const name of REALTIME_COMMENT_EVENTS) this.own.set(name, comments);
	}

	/** The checks that decide one event name: the channel's own, then those other plugins registered. */
	checksOf(name: string): readonly SubscriptionAudienceCheck[] {
		const own = this.own.get(name);
		const registered = this.find(SubscriptionCatalogue)?.audienceOf(name) ?? [];
		return own ? [own, ...registered] : registered;
	}

	/**
	 * Which of the events the subscriber may receive. Runs in the subscriber's request context.
	 *
	 * @throws When a check cannot answer (see {@link screenAudience}).
	 */
	admitted(
		events: readonly SubscriptionAudienceEvent[],
		subscriber: SubscriptionAudienceSubscriber
	): Promise<boolean[]> {
		return screenAudience(events, subscriber, (name) => this.checksOf(name));
	}

	/** Each `document.updated` fact: whether the subscriber may read the page it names. */
	private async documentVerdicts(events: readonly SubscriptionAudienceEvent[]): Promise<boolean[]> {
		const readable = await this.readableDocuments(
			events.map((event) => ({ id: String(event.aggregateId), organizationId: organizationOf(event) }))
		);
		return events.map((event) => readable.has(`${organizationOf(event)}|${event.aggregateId}`));
	}

	/**
	 * The pages among the given ones the subscriber may read, keyed `<organizationId>|<id>`: one query per organization
	 * (per {@link AUDIENCE_QUERY_CHUNK} pages), none without the documents read permission or the docs plugin.
	 */
	private async readableDocuments(
		refs: ReadonlyArray<{ id: string; organizationId: string | null }>
	): Promise<Set<string>> {
		const readable = new Set<string>();
		// The permission first: without it no page is readable, shared or not (the docs truth table's first row).
		if (!refs.length || !RequestContext.hasPermission(PermissionsEnum.DOCS_READ)) {
			return readable;
		}
		const documents = this.find(DocumentService);
		if (!documents) {
			return readable;
		}
		const byOrganization = new Map<string, Set<string>>();
		for (const { id, organizationId } of refs) {
			if (!id || !organizationId || !isWithinOrganizationBoundary(organizationId as ID)) continue;
			byOrganization.set(organizationId, (byOrganization.get(organizationId) ?? new Set<string>()).add(id));
		}
		for (const [organizationId, ids] of byOrganization) {
			for (const chunk of chunked([...ids], AUDIENCE_QUERY_CHUNK)) {
				const found = await this.readableIn(documents, organizationId, chunk);
				for (const id of found) readable.add(`${organizationId}|${id}`);
			}
		}
		return readable;
	}

	/**
	 * One read-scope query of the subscriber, shared by the identical lookups in flight: a live fact handed to several
	 * connections of one user (tabs) asks the same question in the same request context, and gets one query. Nothing
	 * is kept once the query answers (no cache), so a share revoked or a page made private takes effect on the next
	 * fact. Other users ask apart: the docs read scope is the subscriber's own.
	 */
	private readableIn(documents: DocumentService, organizationId: string, ids: string[]): Promise<ID[]> {
		const tenantId = RequestContext.currentTenantId();
		const userId = RequestContext.currentUserId();
		const read = () => documents.filterReadableDocumentIds(ids as ID[], organizationId as ID, { withDeleted: true });
		if (!tenantId || !userId) return read();
		const key = `${tenantId}|${userId}|${organizationId}|${[...ids].sort().join(',')}`;
		let pending = this.documentLookups.get(key);
		if (!pending) {
			pending = read().finally(() => this.documentLookups.delete(key));
			this.documentLookups.set(key, pending);
		}
		return pending;
	}

	/** The task read rule for a task of an organization (see {@link TASK_READ_PERMISSIONS}). */
	private mayReadTasksOf(organizationId: string | null): boolean {
		return (
			!!organizationId &&
			RequestContext.hasAnyPermission([...TASK_READ_PERMISSIONS]) &&
			isWithinOrganizationBoundary(organizationId as ID)
		);
	}

	/**
	 * Each `comment.*` fact: whether the subscriber may read the comments of the record it names. Fails closed: a fact
	 * that names no record, or a record whose rule cannot be known (the comment-access registry missing), is not
	 * delivered; only a record type known to have no rule of its own follows the comment API's (tenant and
	 * organization, already checked). The governed records of one type are checked together (one batch read).
	 */
	private async commentVerdicts(events: readonly SubscriptionAudienceEvent[]): Promise<boolean[]> {
		const verdicts = events.map(() => false);
		const pages: Array<{ index: number; id: string; organizationId: string | null }> = [];
		const governed = new Map<string, Array<{ index: number; entityId: string }>>();
		const access = this.find(CommentParentAccessService);

		events.forEach((event, index) => {
			const organizationId = organizationOf(event);
			if (organizationId && !isWithinOrganizationBoundary(organizationId as ID)) return;
			const parent = parentOf(event);
			if (!parent) return;
			if (isSpellingOfRecordType(parent.entity, BaseEntityEnum.Document)) {
				pages.push({ index, id: parent.entityId, organizationId });
			} else if (isSpellingOfRecordType(parent.entity, BaseEntityEnum.Task)) {
				verdicts[index] = this.mayReadTasksOf(organizationId);
			} else if (!access) {
				// Which record types have a rule of their own cannot be known: none is delivered.
				return;
			} else if (access.isGoverned(parent.entity)) {
				governed.set(parent.entity, [...(governed.get(parent.entity) ?? []), { index, entityId: parent.entityId }]);
			} else {
				verdicts[index] = true;
			}
		});

		if (pages.length) {
			const readable = await this.readableDocuments(pages);
			for (const page of pages) verdicts[page.index] = readable.has(`${page.organizationId}|${page.id}`);
		}
		if (access) {
			for (const [entity, facts] of governed) {
				const readable = await access.readableParentIds(entity, facts.map((fact) => fact.entityId));
				for (const fact of facts) verdicts[fact.index] = readable.has(fact.entityId);
			}
		}
		return verdicts;
	}

	/**
	 * A provider of this process, or `undefined` when it has none (the docs plugin switched off). Looked up once: the
	 * checks run for every event handed to every connection, and the container does not change after bootstrap.
	 */
	private find<T>(token: Type<T>): T | undefined {
		if (!this.providers.has(token)) {
			let provider: unknown;
			try {
				provider = this.moduleRef.get(token, { strict: false }) ?? undefined;
			} catch {
				provider = undefined;
			}
			this.providers.set(token, provider);
		}
		return this.providers.get(token) as T | undefined;
	}
}
