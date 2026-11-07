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
import { DOCS_NOTIFICATION_DEDUPE_MINUTES } from '../docs.constants';
import { Document } from '../entities/document.entity';
import { TypeOrmDocumentRepository } from '../repositories/type-orm-document.repository';
import { notifiableReceivers } from './document-collaboration.helpers';

/** The display name of the signed-in user, for a notification title. */
export function actorDisplayName(user: { firstName?: string; lastName?: string; name?: string; email?: string } | null | undefined): string {
	if (!user) return 'Someone';
	const parts = [user.firstName, user.lastName].filter((part) => typeof part === 'string' && part.trim().length > 0);
	return parts.length ? parts.join(' ') : user.name || user.email || 'Someone';
}

/** What a share, a review request or a review decision reads as in the Inbox. */
export function documentNotificationTitle(
	kind: 'shared' | 'review-requested' | 'review-approved' | 'review-rejected',
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
 * The same person is told of the same thing on one page once per {@link DOCS_NOTIFICATION_DEDUPE_MINUTES}; the
 * people who muted the page, and the actor, are never told. Best effort throughout: a notification is never a
 * reason to fail the write that caused it.
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
			return await this.publish(document, receivers, EmployeeNotificationTypeEnum.ASSIGNMENT, title);
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
			return await this.publish(document, reviewerEmployeeIds, EmployeeNotificationTypeEnum.ASSIGNMENT, title);
		} catch (error) {
			this.logger.warn(`Review-request notifications of document ${document.id} were not sent: ${(error as Error)?.message}`);
			return 0;
		}
	}

	/** Tells the page's creator of a review decision. */
	async notifyReviewDecided(document: Document, decision: DocumentReviewStatusEnum, note: string | null): Promise<number> {
		try {
			const creator = await this.creatorEmployeeId(document);
			if (!creator) return 0;
			const kind = decision === DocumentReviewStatusEnum.APPROVED ? 'review-approved' : 'review-rejected';
			const title = documentNotificationTitle(kind, actorDisplayName(RequestContext.currentUser()), document, note);
			return await this.publish(document, [creator], EmployeeNotificationTypeEnum.TASK_UPDATE, title);
		} catch (error) {
			this.logger.warn(`Review-decision notifications of document ${document.id} were not sent: ${(error as Error)?.message}`);
			return 0;
		}
	}

	// ---------------------------------------------------------------- helpers

	/** Publishes one notification per receiver that was not told the same thing recently; answers how many. */
	private async publish(document: Document, receiverEmployeeIds: readonly ID[], type: EmployeeNotificationTypeEnum, title: string): Promise<number> {
		const actorEmployeeId = (RequestContext.currentUser()?.employeeId as ID | undefined) ?? RequestContext.currentEmployeeId() ?? null;
		const receivers = notifiableReceivers(receiverEmployeeIds, document.metadata, actorEmployeeId);
		if (!receivers.length) return 0;
		const recent = await this.recentlyNotified(document, receivers, type);
		let sent = 0;
		for (const receiverEmployeeId of receivers) {
			if (recent.has(String(receiverEmployeeId))) continue;
			this.eventBus.publish(
				new EmployeeCreateNotificationEvent({
					entity: BaseEntityEnum.Document,
					entityId: document.id as ID,
					type,
					title,
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

	/** The receivers already told of the same kind of thing on this page within the dedupe window. */
	private async recentlyNotified(document: Document, receivers: readonly ID[], type: EmployeeNotificationTypeEnum): Promise<Set<string>> {
		try {
			const since = new Date(Date.now() - DOCS_NOTIFICATION_DEDUPE_MINUTES * 60_000);
			const rows = await this.typeOrmDocumentRepository.manager.find(EmployeeNotification, {
				select: { id: true, receiverEmployeeId: true },
				where: {
					tenantId: document.tenantId,
					entity: BaseEntityEnum.Document,
					entityId: document.id as ID,
					type,
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

	/** The employee record of the page's creator (a user without one gets no Inbox entry). */
	private async creatorEmployeeId(document: Document): Promise<ID | null> {
		if (!document.createdByUserId) return null;
		const employee = await this.typeOrmDocumentRepository.manager.findOne(Employee, {
			select: { id: true },
			where: { userId: document.createdByUserId as ID, tenantId: document.tenantId }
		});
		return (employee?.id as ID) ?? null;
	}
}
