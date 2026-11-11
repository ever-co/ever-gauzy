import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { In, IsNull, MoreThan } from 'typeorm';
import {
	BaseEntityEnum,
	DocumentReviewStatusEnum,
	DocumentShareAccessEnum,
	EmployeeNotificationTypeEnum,
	ID
} from '@gauzy/contracts';
import { Employee, EmployeeCreateNotificationEvent, EmployeeNotification, OrganizationTeamEmployee, RequestContext } from '@gauzy/core';
import { getDocsConfig } from '../docs.config';
import { DOCS_NOTIFICATION_DEDUPE_MINUTES } from '../docs.constants';
import { Document } from '../entities/document.entity';
import { TypeOrmDocumentRepository } from '../repositories/type-orm-document.repository';
import { isMutedBy, notifiableReceivers } from './document-collaboration.helpers';

/** The display name of the signed-in user, for a notification title. */
export function actorDisplayName(user: { firstName?: string; lastName?: string; name?: string; email?: string } | null | undefined): string {
	if (!user) return 'Someone';
	const parts = [user.firstName, user.lastName].filter((part) => typeof part === 'string' && part.trim().length > 0);
	return parts.length ? parts.join(' ') : user.name || user.email || 'Someone';
}

/** The kinds of Inbox entry this feature files. */
export type DocumentNotificationKind = 'shared' | 'review-requested' | 'review-approved' | 'review-rejected';

/**
 * The kinds the dedupe window applies to: a repeated share (the Inbox rules keep the window for mentions, which the
 * platform's mention service files, and for repeated shares). Every review request and decision is an entry of its
 * own: a request only moves a page that is not pending to pending, and a decision only moves a pending one on, so
 * each is a distinct review round — a second round within the window is news, not a repeat.
 */
export const DEDUPED_DOCUMENT_NOTIFICATION_KINDS: ReadonlySet<DocumentNotificationKind> = new Set<DocumentNotificationKind>(['shared']);

/** The short line under the title, which also tells one kind from another with the same notification type. */
export const DOCUMENT_NOTIFICATION_MESSAGE: Record<DocumentNotificationKind, string> = {
	shared: 'Page shared with you',
	'review-requested': 'Review requested',
	'review-approved': 'Review approved',
	'review-rejected': 'Review rejected'
};

/** What a share, a review request or a review decision reads as in the Inbox. */
export function documentNotificationTitle(
	kind: DocumentNotificationKind,
	actorName: string,
	document: Pick<Document, 'name'>,
	detail?: string | null
): string {
	const page = document.name ? `"${document.name}"` : 'a page';
	switch (kind) {
		case 'shared':
			return `${actorName} shared ${page} with you${detail ? ` (${detail})` : ''}`;
		case 'review-requested':
			return `${actorName} asked you to review ${page}${detail ? `: ${detail}` : ''}`;
		case 'review-approved':
			return `${actorName} approved ${page}${detail ? `: ${detail}` : ''}`;
		case 'review-rejected':
			return `${actorName} rejected ${page}${detail ? `: ${detail}` : ''}`;
	}
}

/**
 * The Inbox entries the docs collaboration feature files, through the platform's notification system (which the
 * unified Inbox lists): a page shared with me, a review asked of me, a decision on a page of mine. Mentions and the
 * comments on a page I follow are the platform's own doing (the mention service and the follower fan-out).
 *
 * The same person is told of a share of one page once per {@link DOCS_NOTIFICATION_DEDUPE_MINUTES}; every review
 * request and decision is an entry of its own ({@link DEDUPED_DOCUMENT_NOTIFICATION_KINDS}). The people who muted
 * the page, and the actor, are never told. Best effort throughout: a notification is never a reason to fail the
 * write that caused it.
 */
@Injectable()
export class DocumentNotifierService {
	private readonly logger = new Logger(DocumentNotifierService.name);

	constructor(private readonly typeOrmDocumentRepository: TypeOrmDocumentRepository, private readonly eventBus: EventBus) {}

	/** Tells the employee, or the members of the team, a page was shared with. */
	async notifyShared(document: Document, target: { employeeId: ID | null; teamId: ID | null }, access: DocumentShareAccessEnum): Promise<number> {
		try {
			const receivers = target.employeeId ? [target.employeeId] : target.teamId ? await this.teamMemberIds(target.teamId, document.tenantId) : [];
			const title = documentNotificationTitle('shared', actorDisplayName(RequestContext.currentUser()), document, String(access).toLowerCase());
			return await this.publish(document, receivers, 'shared', EmployeeNotificationTypeEnum.ASSIGNMENT, title);
		} catch (error) {
			this.logger.warn(`Share notifications of document ${document.id} were not sent: ${(error as Error)?.message}`);
			return 0;
		}
	}

	/** Tells the employees asked to review a page. */
	async notifyReviewRequested(document: Document, reviewerEmployeeIds: readonly ID[], reason: string | null): Promise<number> {
		if (!reviewerEmployeeIds.length) return 0;
		try {
			const title = documentNotificationTitle('review-requested', actorDisplayName(RequestContext.currentUser()), document, reason);
			return await this.publish(document, reviewerEmployeeIds, 'review-requested', EmployeeNotificationTypeEnum.ASSIGNMENT, title);
		} catch (error) {
			this.logger.warn(`Review-request notifications of document ${document.id} were not sent: ${(error as Error)?.message}`);
			return 0;
		}
	}

	/** Tells the page's creator of a review decision. */
	async notifyReviewDecided(document: Document, decision: DocumentReviewStatusEnum, note: string | null): Promise<number> {
		try {
			const creator = await this.creatorOf(document);
			if (!creator.employeeId) return 0;
			// A mute saved before follows moved to the page organization's employee is held by another of theirs.
			if (creator.employeeIds.some((employeeId) => isMutedBy(document.metadata, employeeId))) return 0;
			const kind: DocumentNotificationKind = decision === DocumentReviewStatusEnum.APPROVED ? 'review-approved' : 'review-rejected';
			const title = documentNotificationTitle(kind, actorDisplayName(RequestContext.currentUser()), document, note);
			return await this.publish(document, [creator.employeeId], kind, EmployeeNotificationTypeEnum.TASK_UPDATE, title);
		} catch (error) {
			this.logger.warn(`Review-decision notifications of document ${document.id} were not sent: ${(error as Error)?.message}`);
			return 0;
		}
	}

	// ---------------------------------------------------------------- helpers

	/**
	 * Publishes one notification per receiver (for a deduped kind, per receiver not told the same kind of thing
	 * recently); answers how many. Nothing is sent while the collaboration feature is off: the share and review routes
	 * keep working as before.
	 */
	private async publish(document: Document, receiverEmployeeIds: readonly ID[], kind: DocumentNotificationKind, type: EmployeeNotificationTypeEnum, title: string): Promise<number> {
		if (!getDocsConfig().collabEnabled) return 0;
		// The actor as the page's organization knows them (a user employed in several organizations carries their last
		// organization's employee in the token), so they are left out of their own notification there.
		const actorUserId = RequestContext.currentUserId() as ID | null;
		const actorEmployeeId =
			(actorUserId ? await this.employeeOfUserIn(actorUserId, document) : null) ??
			(RequestContext.currentUser()?.employeeId as ID | undefined) ??
			RequestContext.currentEmployeeId() ??
			null;
		const receivers = notifiableReceivers(receiverEmployeeIds, document.metadata, actorEmployeeId);
		if (!receivers.length) return 0;
		const message = DOCUMENT_NOTIFICATION_MESSAGE[kind];
		const recent = DEDUPED_DOCUMENT_NOTIFICATION_KINDS.has(kind) ? await this.recentlyNotified(document, receivers, type, message) : new Set<string>();
		let sent = 0;
		for (const receiverEmployeeId of receivers) {
			if (recent.has(String(receiverEmployeeId))) continue;
			this.eventBus.publish(
				new EmployeeCreateNotificationEvent({
					entity: BaseEntityEnum.Document,
					entityId: document.id as ID,
					type,
					title,
					message,
					receiverEmployeeId,
					...(actorEmployeeId ? { sentByEmployeeId: actorEmployeeId } : {}),
					organizationId: document.organizationId ?? undefined,
					tenantId: document.tenantId
				})
			);
			sent += 1;
		}
		return sent;
	}

	/** The receivers already told of the same kind of thing (same type and message line) on this page within the window. */
	private async recentlyNotified(document: Document, receivers: readonly ID[], type: EmployeeNotificationTypeEnum, message: string): Promise<Set<string>> {
		try {
			const since = new Date(Date.now() - DOCS_NOTIFICATION_DEDUPE_MINUTES * 60_000);
			const rows = await this.typeOrmDocumentRepository.manager.find(EmployeeNotification, {
				select: { id: true, receiverEmployeeId: true },
				where: {
					tenantId: document.tenantId,
					entity: BaseEntityEnum.Document,
					entityId: document.id as ID,
					type,
					message,
					receiverEmployeeId: In(receivers as ID[]),
					createdAt: MoreThan(since)
				}
			});
			return new Set(rows.map((row) => String(row.receiverEmployeeId)));
		} catch (error) {
			this.logger.warn(`Recent notifications of document ${document.id} could not be read: ${(error as Error)?.message}`);
			return new Set();
		}
	}

	/** The active employees of a team. */
	private async teamMemberIds(teamId: ID, tenantId: ID): Promise<ID[]> {
		const members = await this.typeOrmDocumentRepository.manager.find(OrganizationTeamEmployee, {
			select: { employeeId: true },
			where: { organizationTeamId: teamId, tenantId, deletedAt: IsNull() }
		});
		return members.map((member) => member.employeeId).filter(Boolean) as ID[];
	}

	/**
	 * The page's creator: the employee to tell (theirs in the page's organization, else any of theirs; a user without
	 * one gets no Inbox entry), and every employee of theirs in the tenant, since a mute of the page may be held by any.
	 */
	private async creatorOf(document: Document): Promise<{ employeeId: ID | null; employeeIds: ID[] }> {
		if (!document.createdByUserId) return { employeeId: null, employeeIds: [] };
		const userId = document.createdByUserId as ID;
		const inOrganization = await this.employeeOfUserIn(userId, document);
		// Every employee of theirs for the mute check; only an active, unarchived one is told.
		const employees = await this.typeOrmDocumentRepository.manager.find(Employee, {
			select: { id: true, isActive: true, isArchived: true },
			where: { userId, tenantId: document.tenantId }
		});
		const employeeIds = [...new Set([inOrganization, ...employees.map((employee) => employee.id as ID)].filter((id): id is ID => !!id))];
		const fallback = employees.find((employee) => employee.isActive && !employee.isArchived)?.id as ID | undefined;
		return { employeeId: inOrganization ?? fallback ?? null, employeeIds };
	}

	/** A user's active, unarchived employee in the page's organization; null when they have none there. */
	private async employeeOfUserIn(userId: ID, document: Document): Promise<ID | null> {
		if (!document.organizationId) return null;
		try {
			const employee = await this.typeOrmDocumentRepository.manager.findOne(Employee, {
				select: { id: true },
				where: { userId, organizationId: document.organizationId as ID, tenantId: document.tenantId, isActive: true, isArchived: false }
			});
			return (employee?.id as ID) ?? null;
		} catch {
			return null;
		}
	}
}
