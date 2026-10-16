import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { BaseEntityEnum, EmployeeNotificationTypeEnum, ID } from '@gauzy/contracts';
import { Employee, EmployeeNotification } from '@gauzy/core';
import { EverWorksConnection } from './ever-works-connection.entity';

/**
 * Notices for the admin who connected Ever Works. Until the Gauzy Inbox exists (plan 04, G-P3-5) they
 * are employee notifications (the bell of Gauzy and Ever Teams) addressed to that admin's employee in
 * the organization the connection was made from. An admin without an employee record there gets the
 * notice in the API log only.
 */
@Injectable()
export class EverWorksNotifier {
	private readonly logger = new Logger('EverWorksNotifier');

	constructor(private readonly dataSource: DataSource) {}

	/** Ever Works answered 401: the key was revoked or expired, and the sync is paused. */
	async needsReauth(connection: EverWorksConnection): Promise<boolean> {
		return this.notify(
			connection,
			'Ever Works needs a new key',
			'Ever Works no longer accepts the integration key of this Gauzy tenant, so the sync is paused. Open Integrations → Ever Works and enter a new integration key.'
		);
	}

	private async notify(connection: EverWorksConnection, title: string, message: string): Promise<boolean> {
		const tenantId = connection.tenantId as ID | undefined;
		const organizationId = connection.organizationId as ID | undefined;
		const userId = connection.connectedByUserId as ID | undefined;
		if (!tenantId || !organizationId || !userId) {
			this.logger.warn(`Connection ${connection.id}: ${title} (no admin to notify).`);
			return false;
		}
		const employee = await this.dataSource.getRepository(Employee).findOne({
			where: { tenantId, organizationId, userId, isActive: true, isArchived: false },
			select: { id: true }
		});
		if (!employee?.id) {
			this.logger.warn(`Connection ${connection.id}: ${title} (the admin has no employee record to notify).`);
			return false;
		}
		await this.dataSource.getRepository(EmployeeNotification).save(
			this.dataSource.getRepository(EmployeeNotification).create({
				id: randomUUID(),
				tenantId,
				organizationId,
				entity: BaseEntityEnum.Organization,
				entityId: organizationId,
				title,
				message,
				type: EmployeeNotificationTypeEnum.BROADCAST,
				isRead: false,
				receiverEmployeeId: employee.id
			})
		);
		return true;
	}
}
