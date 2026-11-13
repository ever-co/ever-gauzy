import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { EventBus } from '@nestjs/cqrs';
import { In, IsNull } from 'typeorm';
import {
	BaseEntityEnum,
	DocumentSpaceKindEnum,
	DocumentVisibilityEnum,
	EntitySubscriptionTypeEnum,
	ID,
	IDocumentFollowState,
	IDocumentSpace,
	JsonData,
	PermissionsEnum
} from '@gauzy/contracts';
import { CreateEntitySubscriptionEvent, EntitySubscription, OrganizationTeam, OrganizationTeamEmployee, RequestContext, prepareSQLQuery as p } from '@gauzy/core';
import { getDocsConfig } from '../docs.config';
import { DOCS_COLLAB_DISABLED, DOCS_WRITE_FORBIDDEN } from '../docs.constants';
import { MoveDocumentSpaceDTO } from '../dto/document-space.dto';
import { Document } from '../entities/document.entity';
import { TypeOrmDocumentRepository } from '../repositories/type-orm-document.repository';
import { canAdministerShares } from './document-access.predicate';
import { DocumentAccessService } from './document-access.service';
import { isMutedBy, withMuted } from './document-collaboration.helpers';
import { DocumentTreeService } from './document-tree.service';
import { DocumentService } from './document.service';

/**
 * The spaces of the Docs tree, moving pages between them, and following or muting a page.
 *
 * A space is not a row: it is the organization's pages (`visibility: ORGANIZATION`), a team's pages
 * (`visibility: TEAM` + `organizationTeamId`) or a person's private pages (`visibility: PRIVATE`, their own). The
 * list route takes a `space` filter; this service answers which spaces the caller sees and how many documents each
 * holds, and moves a page (with the descendants the caller may write) from one space to another.
 *
 * Following is the platform's entity subscription (what the comment fan-out and the mention service already use);
 * muting takes the caller's subscriptions away and remembers the choice in the document's metadata, so the plugin's
 * own paths (a share, a review) never tell them again until they unmute.
 */
@Injectable()
export class DocumentCollaborationService {
	private readonly logger = new Logger(DocumentCollaborationService.name);

	constructor(
		private readonly typeOrmDocumentRepository: TypeOrmDocumentRepository,
		private readonly documentService: DocumentService,
		private readonly documentAccessService: DocumentAccessService,
		private readonly documentTreeService: DocumentTreeService,
		private readonly eventBus: EventBus
	) {}

	/** 404 `DOCS_COLLAB_DISABLED` while the feature is off. */
	public assertEnabled(): void {
		if (!getDocsConfig().collabEnabled) {
			throw new NotFoundException({ message: 'Docs collaboration is not enabled on this installation', code: DOCS_COLLAB_DISABLED });
		}
	}

	// ---------------------------------------------------------------- spaces

	/**
	 * The spaces the caller sees in an organization, each with how many of its live documents the caller may read:
	 * the organization's, the caller's private one, and one per team the caller belongs to (every team of the
	 * organization for `DOCS_MANAGE` holders).
	 */
	async listSpaces(organizationId: ID): Promise<IDocumentSpace[]> {
		const tenantId = RequestContext.currentTenantId();
		const employeeId = this.documentAccessService.currentEmployeeId();
		const manage = RequestContext.hasPermission(PermissionsEnum.DOCS_MANAGE);
		const teams = await this.visibleTeams(tenantId, organizationId, employeeId, manage);
		const counts = await this.countBySpace(tenantId, organizationId);

		const spaces: IDocumentSpace[] = [
			{ kind: DocumentSpaceKindEnum.ORGANIZATION, name: 'Organization', documentCount: counts.organization },
			{ kind: DocumentSpaceKindEnum.PRIVATE, name: 'Private', documentCount: counts.privateMine }
		];
		for (const team of teams) {
			spaces.push({
				kind: DocumentSpaceKindEnum.TEAM,
				organizationTeamId: team.id as ID,
				name: team.name,
				documentCount: counts.byTeam.get(String(team.id)) ?? 0
			});
		}
		return spaces;
	}

	/**
	 * Moves a page to a space: the organization's, a team's (the team is checked like on create), or the caller's
	 * private one. By default the descendants move too, so a subtree never straddles spaces — but only the ones
	 * whose space the caller may change (their own, or every one for a `DOCS_MANAGE` holder): someone else's page
	 * under the folder, shared back at `VIEW`, stays where its owner put it. Only the page's owner or a
	 * `DOCS_MANAGE` holder changes a page's space, as its visibility.
	 */
	async moveToSpace(id: ID, input: MoveDocumentSpaceDTO): Promise<Document> {
		this.assertEnabled();
		const document = await this.documentService.findOneScoped(id, [], input.organizationId);
		await this.documentService.assertCanWrite(document);
		const owner = await this.documentAccessService.canAdministerShares({
			createdByUserId: document.createdByUserId,
			visibility: document.visibility,
			organizationTeamId: document.organizationTeamId
		});
		if (!owner) {
			throw new ForbiddenException({ message: "Only the document's owner may move it to another space", code: DOCS_WRITE_FORBIDDEN });
		}
		const fields = await this.documentService.resolveSpaceFields(input.visibility, input.organizationTeamId ?? null, document.organizationId);
		const targetVisibility = (fields.visibility ?? input.visibility) as DocumentVisibilityEnum;
		const targetTeamId = (fields.organizationTeamId ?? null) as ID | null;

		const ids: ID[] = [document.id as ID];
		if (input.applyToSubtree !== false) {
			const subtree = await this.documentTreeService.collectVisibleSubtree(document, (candidates) => this.documentService.filterReadableDocumentIds(candidates, document.organizationId));
			const descendantIds = subtree.ids.filter((descendantId) => String(descendantId) !== String(document.id));
			if (descendantIds.length) {
				// The space of a descendant is its owner's to change (or a manager's), exactly as the root's.
				const subject = await this.documentAccessService.currentSubject();
				const rows = await this.typeOrmDocumentRepository.find({
					select: { id: true, createdByUserId: true, visibility: true, organizationTeamId: true },
					where: { id: In(descendantIds), tenantId: document.tenantId, organizationId: document.organizationId }
				});
				for (const row of rows) {
					if (canAdministerShares({ createdByUserId: row.createdByUserId, visibility: row.visibility, organizationTeamId: row.organizationTeamId }, subject)) {
						ids.push(row.id as ID);
					}
				}
			}
		}
		await this.typeOrmDocumentRepository.update(
			{ id: In(ids), tenantId: document.tenantId, organizationId: document.organizationId },
			{ visibility: targetVisibility, organizationTeamId: targetTeamId as never }
		);
		const moved = await this.documentService.findOneScoped(id, [], input.organizationId);
		this.documentService.emitDocumentEvent(moved, 'updated', { phase: 'crud', field: 'visibility', previous: document.visibility, next: targetVisibility }, input as never);
		this.logger.debug(`Document ${id} moved to ${targetVisibility}${targetTeamId ? ` (team ${targetTeamId})` : ''} with ${ids.length - 1} descendant(s).`);
		return moved;
	}

	// ---------------------------------------------------------------- follow / mute

	/**
	 * Whether the caller follows the page, and whether they muted it.
	 *
	 * The follow and the mute belong to the caller's employee in the page's organization. A choice made before that
	 * was saved under another employee of theirs (the one in their token at the time), so every employee of the caller
	 * in the tenant is read, and cleared by an unfollow or an unmute: nobody's earlier follow or mute disappears because
	 * the identity it was saved under changed, and none outlives an unmute. An earlier choice is also carried over to
	 * the page organization's employee here (see {@link carryOverEarlierChoices}).
	 */
	async followState(id: ID, organizationId?: ID): Promise<IDocumentFollowState> {
		this.assertEnabled();
		const document = await this.documentService.findOneScoped(id, [], organizationId);
		const followers = await this.followersOf(document);
		const { employeeIds } = followers;
		if (!employeeIds.length) return { following: false, muted: false };
		await this.carryOverEarlierChoices(document, followers);
		const following = await this.typeOrmDocumentRepository.manager.count(EntitySubscription, {
			where: { entity: BaseEntityEnum.Document, entityId: document.id as ID, employeeId: In(employeeIds), tenantId: document.tenantId }
		});
		return { following: following > 0, muted: employeeIds.some((employeeId) => isMutedBy(document.metadata, employeeId)) };
	}

	/** Follows the page (and lifts its mute, wherever it was saved). */
	async follow(id: ID, organizationId?: ID): Promise<IDocumentFollowState> {
		this.assertEnabled();
		const document = await this.documentService.findOneScoped(id, [], organizationId);
		const { employeeId, employeeIds } = await this.followersOf(document);
		if (!employeeId) return { following: false, muted: false };
		await this.unmuteAll(document, employeeIds);
		this.eventBus.publish(
			new CreateEntitySubscriptionEvent({
				entity: BaseEntityEnum.Document,
				entityId: document.id as ID,
				employeeId,
				type: EntitySubscriptionTypeEnum.MANUAL,
				organizationId: document.organizationId,
				tenantId: document.tenantId
			})
		);
		return { following: true, muted: false };
	}

	/** Stops following the page, a follow saved under another employee of the caller included (the mute, if any, stays). */
	async unfollow(id: ID, organizationId?: ID): Promise<IDocumentFollowState> {
		this.assertEnabled();
		const document = await this.documentService.findOneScoped(id, [], organizationId);
		const { employeeIds } = await this.followersOf(document);
		if (!employeeIds.length) return { following: false, muted: false };
		await this.deleteSubscriptions(document, employeeIds);
		return { following: false, muted: employeeIds.some((employeeId) => isMutedBy(document.metadata, employeeId)) };
	}

	/** Mutes the page: no follow, and none re-created by the plugin's own paths, until unmuted. */
	async mute(id: ID, organizationId?: ID): Promise<IDocumentFollowState> {
		this.assertEnabled();
		const document = await this.documentService.findOneScoped(id, [], organizationId);
		const { employeeId, employeeIds } = await this.followersOf(document);
		if (!employeeId) return { following: false, muted: false };
		await this.deleteSubscriptions(document, employeeIds);
		await this.setMuted(document, employeeId, true);
		return { following: false, muted: true };
	}

	/** Lifts the mute of the page, wherever it was saved (without following it again). */
	async unmute(id: ID, organizationId?: ID): Promise<IDocumentFollowState> {
		this.assertEnabled();
		const document = await this.documentService.findOneScoped(id, [], organizationId);
		const { employeeIds } = await this.followersOf(document);
		if (!employeeIds.length) return { following: false, muted: false };
		await this.unmuteAll(document, employeeIds);
		return this.followState(id, organizationId);
	}

	/**
	 * The caller as a follower of the page: their employee in the page's organization, which new follows and mutes are
	 * saved under, and every employee of theirs in the tenant (the token's included), which earlier choices may have
	 * been saved under; the same set the review notices check. A lookup that fails fails the call rather than acting as
	 * another employee.
	 */
	private async followersOf(document: Document): Promise<{ employeeId: ID | null; employeeIds: ID[] }> {
		const [employeeId, tenantEmployeeIds] = await Promise.all([
			this.documentAccessService.currentEmployeeIdIn(document.organizationId, document.tenantId),
			this.documentAccessService.currentUserEmployeeIdsIn(document.tenantId)
		]);
		const tokenEmployeeId = this.documentAccessService.currentEmployeeId();
		const employeeIds = [...new Set([employeeId, tokenEmployeeId, ...tenantEmployeeIds].filter((candidate): candidate is ID => !!candidate))];
		return { employeeId, employeeIds };
	}

	/**
	 * Carries a follow or a mute saved under another employee of the caller over to the page organization's employee, the one
	 * that organization's comment fan-out and the plugin's notices read: a page shown as followed keeps delivering its
	 * notices, and a muted one stays quiet. Safe to repeat (creating a subscription that exists returns it); the
	 * earlier record is left for an unfollow or an unmute to clear.
	 */
	private async carryOverEarlierChoices(document: Document, { employeeId, employeeIds }: { employeeId: ID | null; employeeIds: ID[] }): Promise<void> {
		const earlier = employeeIds.filter((candidate) => candidate !== employeeId);
		if (!employeeId || !earlier.length) return;
		const manager = this.typeOrmDocumentRepository.manager;
		const scope = { entity: BaseEntityEnum.Document, entityId: document.id as ID, tenantId: document.tenantId };
		const [own, inherited] = await Promise.all([
			manager.count(EntitySubscription, { where: { ...scope, employeeId } }),
			manager.findOne(EntitySubscription, { select: { id: true, type: true }, where: { ...scope, employeeId: In(earlier) } })
		]);
		if (!own && inherited) {
			this.eventBus.publish(
				new CreateEntitySubscriptionEvent({
					...scope,
					employeeId,
					type: inherited.type ?? EntitySubscriptionTypeEnum.MANUAL,
					organizationId: document.organizationId
				})
			);
		}
		// The mute is decided again on the locked row: an unmute that ran while this read waited is never undone.
		if (earlier.some((candidate) => isMutedBy(document.metadata, candidate))) {
			await this.changeMutes(document, (metadata) =>
				!isMutedBy(metadata, employeeId) && earlier.some((candidate) => isMutedBy(metadata, candidate)) ? withMuted(metadata, employeeId, true) : null
			);
		}
	}

	// ---------------------------------------------------------------- helpers

	private async deleteSubscriptions(document: Document, employeeIds: readonly ID[]): Promise<void> {
		if (!employeeIds.length) return;
		await this.typeOrmDocumentRepository.manager.delete(EntitySubscription, {
			entity: BaseEntityEnum.Document,
			entityId: document.id as ID,
			employeeId: In([...employeeIds]),
			tenantId: document.tenantId
		});
	}

	/** Mutes the page for one employee, or lifts their mute. */
	private async setMuted(document: Document, employeeId: ID, muted: boolean): Promise<void> {
		await this.changeMutes(document, (metadata) => withMuted(metadata, employeeId, muted));
	}

	/** Lifts the mute of the page for every one of the given employees (one write, none when none muted it). */
	private async unmuteAll(document: Document, employeeIds: readonly ID[]): Promise<void> {
		await this.changeMutes(document, (metadata) =>
			employeeIds.some((employeeId) => isMutedBy(metadata, employeeId))
				? employeeIds.reduce((next, employeeId) => withMuted(next, employeeId, false), metadata)
				: null
		);
	}

	/**
	 * Changes the muted list of the page in one transaction that re-reads the metadata under a row lock (where the
	 * database has one; SQLite serialises its writers itself), so two people muting at once, or a mute beside a
	 * review note, never overwrite each other's change. `change` sees the locked row's metadata and answers the
	 * metadata to write, or null to write nothing.
	 */
	private async changeMutes(document: Document, change: (metadata: JsonData | null | undefined) => JsonData | null): Promise<void> {
		const embedded = isSqlite() || isBetterSqlite3();
		const metadata = await this.typeOrmDocumentRepository.manager.transaction(async (manager) => {
			const current = await manager.findOne(Document, {
				select: { id: true, metadata: true },
				where: { id: document.id as ID, tenantId: document.tenantId },
				...(embedded ? {} : { lock: { mode: 'pessimistic_write' as const } })
			});
			const latest = current ? current.metadata : document.metadata;
			const next = change(latest);
			if (next === null) return latest;
			await manager.update(Document, { id: document.id as ID, tenantId: document.tenantId }, { metadata: next as never });
			return next;
		});
		document.metadata = metadata;
	}

	/** The teams of the organization the caller belongs to (every team for a `DOCS_MANAGE` holder). */
	private async visibleTeams(tenantId: ID, organizationId: ID, employeeId: ID | null, manage: boolean): Promise<Array<{ id: ID; name: string }>> {
		const manager = this.typeOrmDocumentRepository.manager;
		if (manage) {
			const teams = await manager.find(OrganizationTeam, { select: { id: true, name: true }, where: { tenantId, organizationId }, order: { name: 'ASC' } });
			return teams.map((team) => ({ id: team.id as ID, name: team.name }));
		}
		if (!employeeId) return [];
		const memberships = await manager.find(OrganizationTeamEmployee, {
			select: { organizationTeamId: true },
			where: { employeeId, tenantId, organizationId, deletedAt: IsNull() }
		});
		const ids = [...new Set(memberships.map((membership) => membership.organizationTeamId).filter(Boolean))] as ID[];
		if (!ids.length) return [];
		const teams = await manager.find(OrganizationTeam, { select: { id: true, name: true }, where: { id: In(ids), tenantId, organizationId }, order: { name: 'ASC' } });
		return teams.map((team) => ({ id: team.id as ID, name: team.name }));
	}

	/**
	 * How many live documents each space lists for the caller, counted exactly as `GET /documents?space=…` lists
	 * them: the organization's pages, the caller's own private pages, and each team's pages the caller may read
	 * (a TEAM page without a team is listed by no space).
	 */
	private async countBySpace(tenantId: ID, organizationId: ID): Promise<{ organization: number; privateMine: number; byTeam: Map<string, number> }> {
		const qb = this.typeOrmDocumentRepository
			.createQueryBuilder('document')
			.select(`"document"."visibility"`, 'visibility')
			.addSelect(`"document"."organizationTeamId"`, 'organizationTeamId')
			.addSelect(`"document"."createdByUserId"`, 'createdByUserId')
			.addSelect('COUNT(1)', 'count')
			.where(p(`"document"."tenantId" = :tenantId`), { tenantId })
			.andWhere(p(`"document"."organizationId" = :organizationId`), { organizationId })
			.andWhere(p(`"document"."isArchived" = :isArchived`), { isArchived: false })
			.groupBy(`"document"."visibility"`)
			.addGroupBy(`"document"."organizationTeamId"`)
			.addGroupBy(`"document"."createdByUserId"`);
		this.documentService.applyVisibilityScope(qb);
		const rows = await qb.getRawMany<{ visibility: string; organizationTeamId: string | null; createdByUserId: string | null; count: string | number }>();
		const userId = String(RequestContext.currentUserId() ?? '');
		const result = { organization: 0, privateMine: 0, byTeam: new Map<string, number>() };
		for (const row of rows) {
			const count = Number(row.count) || 0;
			if (row.visibility === DocumentVisibilityEnum.TEAM) {
				if (row.organizationTeamId) {
					result.byTeam.set(String(row.organizationTeamId), (result.byTeam.get(String(row.organizationTeamId)) ?? 0) + count);
				}
			} else if (row.visibility === DocumentVisibilityEnum.PRIVATE) {
				if (userId && String(row.createdByUserId ?? '') === userId) result.privateMine += count;
			} else {
				result.organization += count;
			}
		}
		return result;
	}
}
