import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
	PermissionsEnum
} from '@gauzy/contracts';
import { CreateEntitySubscriptionEvent, EntitySubscription, OrganizationTeam, OrganizationTeamEmployee, RequestContext, prepareSQLQuery as p } from '@gauzy/core';
import { getDocsConfig } from '../docs.config';
import { DOCS_COLLAB_DISABLED } from '../docs.constants';
import { MoveDocumentSpaceDTO } from '../dto/document-space.dto';
import { Document } from '../entities/document.entity';
import { TypeOrmDocumentRepository } from '../repositories/type-orm-document.repository';
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
	 * private one. By default the descendants the caller may write move too, so a subtree never straddles spaces;
	 * a descendant the caller may not write stays where it is. Only the page's owner or a `DOCS_MANAGE` holder
	 * changes a page's space, as its visibility.
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
			throw new BadRequestException({ message: "Only the document's owner may move it to another space", code: 'DOCS_WRITE_FORBIDDEN' });
		}
		const fields = await this.documentService.resolveSpaceFields(input.visibility, input.organizationTeamId ?? null, document.organizationId);
		const targetVisibility = (fields.visibility ?? input.visibility) as DocumentVisibilityEnum;
		const targetTeamId = (fields.organizationTeamId ?? null) as ID | null;

		const ids: ID[] = [document.id as ID];
		if (input.applyToSubtree !== false) {
			const subtree = await this.documentTreeService.collectVisibleSubtree(document, (candidates) => this.documentService.filterReadableDocumentIds(candidates, document.organizationId));
			for (const descendantId of subtree.ids) {
				if (String(descendantId) !== String(document.id)) ids.push(descendantId);
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

	/** Whether the caller follows the page, and whether they muted it. */
	async followState(id: ID): Promise<IDocumentFollowState> {
		this.assertEnabled();
		const document = await this.documentService.findOneScoped(id);
		const employeeId = this.documentAccessService.currentEmployeeId();
		if (!employeeId) return { following: false, muted: false };
		const following = await this.typeOrmDocumentRepository.manager.count(EntitySubscription, {
			where: { entity: BaseEntityEnum.Document, entityId: document.id as ID, employeeId, tenantId: document.tenantId }
		});
		return { following: following > 0, muted: isMutedBy(document.metadata, employeeId) };
	}

	/** Follows the page (and unmutes it). */
	async follow(id: ID): Promise<IDocumentFollowState> {
		this.assertEnabled();
		const document = await this.documentService.findOneScoped(id);
		const employeeId = this.documentAccessService.currentEmployeeId();
		if (!employeeId) return { following: false, muted: false };
		if (isMutedBy(document.metadata, employeeId)) {
			await this.setMuted(document, employeeId, false);
		}
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

	/** Stops following the page (the mute, if any, stays). */
	async unfollow(id: ID): Promise<IDocumentFollowState> {
		this.assertEnabled();
		const document = await this.documentService.findOneScoped(id);
		const employeeId = this.documentAccessService.currentEmployeeId();
		if (!employeeId) return { following: false, muted: false };
		await this.deleteSubscriptions(document, employeeId);
		return { following: false, muted: isMutedBy(document.metadata, employeeId) };
	}

	/** Mutes the page: no follow, and none re-created by the plugin's own paths, until unmuted. */
	async mute(id: ID): Promise<IDocumentFollowState> {
		this.assertEnabled();
		const document = await this.documentService.findOneScoped(id);
		const employeeId = this.documentAccessService.currentEmployeeId();
		if (!employeeId) return { following: false, muted: false };
		await this.deleteSubscriptions(document, employeeId);
		await this.setMuted(document, employeeId, true);
		return { following: false, muted: true };
	}

	/** Unmutes the page (without following it again). */
	async unmute(id: ID): Promise<IDocumentFollowState> {
		this.assertEnabled();
		const document = await this.documentService.findOneScoped(id);
		const employeeId = this.documentAccessService.currentEmployeeId();
		if (!employeeId) return { following: false, muted: false };
		await this.setMuted(document, employeeId, false);
		return this.followState(id);
	}

	// ---------------------------------------------------------------- helpers

	private async deleteSubscriptions(document: Document, employeeId: ID): Promise<void> {
		await this.typeOrmDocumentRepository.manager.delete(EntitySubscription, {
			entity: BaseEntityEnum.Document,
			entityId: document.id as ID,
			employeeId,
			tenantId: document.tenantId
		});
	}

	private async setMuted(document: Document, employeeId: ID, muted: boolean): Promise<void> {
		const metadata = withMuted(document.metadata, employeeId, muted);
		await this.typeOrmDocumentRepository.update({ id: document.id as ID, tenantId: document.tenantId }, { metadata: metadata as never });
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

	/** How many live documents the caller may read in each space (the visibility rule applied in SQL). */
	private async countBySpace(tenantId: ID, organizationId: ID): Promise<{ organization: number; privateMine: number; byTeam: Map<string, number> }> {
		const qb = this.typeOrmDocumentRepository
			.createQueryBuilder('document')
			.select(`"document"."visibility"`, 'visibility')
			.addSelect(`"document"."organizationTeamId"`, 'organizationTeamId')
			.addSelect('COUNT(1)', 'count')
			.where(p(`"document"."tenantId" = :tenantId`), { tenantId })
			.andWhere(p(`"document"."organizationId" = :organizationId`), { organizationId })
			.andWhere(p(`"document"."isArchived" = :isArchived`), { isArchived: false })
			.groupBy(`"document"."visibility"`)
			.addGroupBy(`"document"."organizationTeamId"`);
		this.documentService.applyVisibilityScope(qb);
		const rows = await qb.getRawMany<{ visibility: string; organizationTeamId: string | null; count: string | number }>();
		const result = { organization: 0, privateMine: 0, byTeam: new Map<string, number>() };
		for (const row of rows) {
			const count = Number(row.count) || 0;
			if (row.visibility === DocumentVisibilityEnum.TEAM && row.organizationTeamId) {
				result.byTeam.set(String(row.organizationTeamId), (result.byTeam.get(String(row.organizationTeamId)) ?? 0) + count);
			} else if (row.visibility === DocumentVisibilityEnum.PRIVATE) {
				// The visibility scope already narrowed PRIVATE rows to the caller's own (and the ones shared with them).
				result.privateMine += count;
			} else {
				result.organization += count;
			}
		}
		return result;
	}
}
