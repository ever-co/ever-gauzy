import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import {
	ID,
	IEmployeeNotification,
	IEmployeeNotificationCreateInput,
	IEmployeeNotificationSetting,
	NotificationActionTypeEnum,
	EmployeeNotificationTypeEnum,
	IMarkAllAsReadResponse
} from '@gauzy/contracts';
import { Between, UpdateResult } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { redactDatabaseError } from '../core/errors/database-error';
import { RequestContext } from '../core/context/request-context';
import { EmployeeNotificationSettingService } from '../employee-notification-setting/employee-notification-setting.service';
import { EmployeeCreateNotificationEvent } from './events/employee-notification.event';
import { EmployeeNotification } from './employee-notification.entity';
import { TypeOrmEmployeeNotificationRepository } from './repository/type-orm-employee-notification.repository';
import { MikroOrmEmployeeNotificationRepository } from './repository/mikro-orm-employee-notification.repository';
import { generateNotificationTitle } from './employee-notification.helper';

/**
 * How long an unread notification absorbs an identical one (see `findRedeliveredNotification`).
 *
 * It exists to absorb a redelivered or duplicated `EmployeeCreateNotificationEvent` — the same event
 * handled again moments later — not to merge distinct events about the same entity, so keep it short.
 */
export const EMPLOYEE_NOTIFICATION_REDELIVERY_WINDOW_MS = 60 * 1000;

@Injectable()
export class EmployeeNotificationService extends TenantAwareCrudService<EmployeeNotification> {
	readonly logger = new Logger(EmployeeNotificationService.name);

	constructor(
		readonly typeOrmEmployeeNotificationRepository: TypeOrmEmployeeNotificationRepository,
		readonly mikroOrmEmployeeNotificationRepository: MikroOrmEmployeeNotificationRepository,
		private readonly _employeeNotificationSettingService: EmployeeNotificationSettingService,
		private readonly _eventBus: EventBus
	) {
		super(typeOrmEmployeeNotificationRepository, mikroOrmEmployeeNotificationRepository);
	}

	/**
	 * Creates a new notification entry with the provided input, while associating it with the current tenant.
	 *
	 * @param input - The data required to create an notification entry.
	 * @param options.absorbRedelivery - Return an existing identical notification instead of inserting a duplicate
	 * (see `findRedeliveredNotification`). Opt-in for a future at-least-once event transport: no caller sets it
	 * today, so the event handler and `POST /employee-notification` insert one row per call, exactly as before.
	 * @returns The created notification entry.
	 * @throws BadRequestException when the log creation fails.
	 */
	async create(
		input: IEmployeeNotificationCreateInput,
		{ absorbRedelivery = false }: { absorbRedelivery?: boolean } = {}
	): Promise<IEmployeeNotification | undefined> {
		try {
			// Retrieve the current tenant ID from the request context or use the provided tenantId
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			const organizationId = input.organizationId;
			const employeeId = input.receiverEmployeeId;

			// Search for the receiver notification setting
			let employeeNotificationSetting: IEmployeeNotificationSetting;

			try {
				employeeNotificationSetting = await this._employeeNotificationSettingService.findOneByWhereOptions({
					employeeId,
					organizationId,
					tenantId
				});
			} catch (error) {
				if (error instanceof NotFoundException) {
					employeeNotificationSetting = await this._employeeNotificationSettingService.create({
						assignment: true,
						comment: true,
						invitation: true,
						mention: true,
						message: true,
						payment: true,
						preferences: { email: true, inApp: true },
						employeeId,
						organizationId,
						tenantId
					});
				}
			}

			// Check if the receiver employee has activated the notification for the current notification type
			const isAllowedNotification = this.shouldCreateEmployeeNotification(
				employeeNotificationSetting,
				input.type
			);

			if (!isAllowedNotification) {
				return undefined; // Do nothing if notification is not allowed
			}

			// Opt-in (no caller sets it today): a redelivered/duplicated EmployeeCreateNotificationEvent must not
			// give the receiver the same notification twice. Only a provable duplicate is absorbed (see
			// findRedeliveredNotification); every other event is inserted, one row per event.
			if (absorbRedelivery) {
				const redelivered = await this.findRedeliveredNotification(input, tenantId, organizationId);
				if (redelivered) {
					return redelivered;
				}
			}

			// Create the notification entry using the provided input along with the tenantId and return the created notification
			return await super.create({ ...input, tenantId });
		} catch (error) {
			this.logger.error('Error while creating employee notification:', error);
			throw new BadRequestException('Error while creating notification', error);
		}
	}

	/**
	 * Marks all unread and un-archived notifications for the current employee as read.
	 *
	 * @throws {BadRequestException} If an error occurs while updating notifications.
	 * @returns {Promise<{ success: boolean; count: number }>} A promise that resolves to an object indicating the success status and the count of notifications updated.
	 */
	async markAllAsRead(): Promise<IMarkAllAsReadResponse> {
		try {
			// The receiver is the caller's OWN employee record. RequestContext.currentEmployeeId() is
			// deliberately null for CHANGE_SELECTED_EMPLOYEE holders, so read the identity off the JWT
			// user too. A null receiver used to be dropped from the (raw, non-tenant-scoped) UPDATE
			// criteria, i.e. an admin's "mark all read" marked EVERY tenant's notifications read.
			const receiverEmployeeId = RequestContext.currentEmployeeId() ?? RequestContext.currentUser()?.employeeId;
			if (!receiverEmployeeId) {
				return { success: true, count: 0 };
			}
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				// The raw UPDATE below is not tenant-scoped by itself; never run it without a tenant.
				return { success: true, count: 0 };
			}
			const criteria = { isRead: false, isArchived: false, receiverEmployeeId, tenantId };

			// Nothing unread is a successful no-op, not an error (TenantAwareCrudService.update() first
			// looks the criteria up and raises NotFound when no row matches). Any OTHER lookup failure
			// is a real error and must not be reported as a successful no-op.
			const { success, record: unread, error: lookupError } = await this.findOneOrFailByWhereOptions(criteria);
			if (!success && !(lookupError instanceof NotFoundException)) {
				throw lookupError;
			}
			if (!unread) {
				return { success: true, count: 0 };
			}

			// Update all unread and un-archived notifications for the current employee
			// Assume super.update returns an object with an "affected" property that represents the number of records updated.
			const updateResult = (await super.update(criteria, { isRead: true, readAt: new Date() })) as UpdateResult;

			// Extract the count of notifications that were updated.
			const count = updateResult?.affected || 0;

			return { success: true, count };
		} catch (error) {
			throw new BadRequestException('Error while updating notifications', error);
		}
	}

	/**
	 * Publishes a employee notification event to create a new notification.
	 *
	 * @param input - The input data required to create the notification.
	 * @param actionType - The type of action that triggered the notification.
	 * @param entityName - The name of the entity related to the notification.
	 * @param employeeName - The name of the employee related to the notification.
	 */
	publishNotificationEvent(
		input: IEmployeeNotificationCreateInput,
		actionType: NotificationActionTypeEnum,
		entityName: string,
		employeeName: string
	): void {
		// Emit the event to create the notification
		this._eventBus.publish(
			new EmployeeCreateNotificationEvent({
				...input,
				title: generateNotificationTitle(actionType, input.entity, entityName, employeeName)
			})
		);
	}

	/**
	 * Finds the notification that `input` is a redelivery of, if there is one.
	 *
	 * A redelivered event is identical to the original, so a match requires the same receiver, source
	 * entity, type, sender, title and message in the same tenant and organization, on a row that is still
	 * unread, not archived and created within {@link EMPLOYEE_NOTIFICATION_REDELIVERY_WINDOW_MS}. Once the
	 * receiver has read or archived it, or the window has passed, the same event is a new notification
	 * (e.g. an employee unassigned and later re-assigned to the same task must be told again).
	 *
	 * Returns `null` ("insert as usual") whenever a duplicate cannot be proven:
	 * - a key is missing. TypeORM drops `undefined` where-keys rather than matching NULL, so a missing
	 *   key would WIDEN the lookup: `MentionService` publishes without `receiverEmployeeId`, and an
	 *   unguarded lookup turned every mention on a task after the first into a no-op;
	 * - the lookup itself fails. Deduplication is best effort and must never cost a notification.
	 *
	 * This is not a concurrency guard: two deliveries racing each other can both miss and both insert.
	 * It covers sequential redelivery only.
	 *
	 * @param input - The notification about to be created.
	 * @param tenantId - The tenant the notification is created in.
	 * @param organizationId - The organization the notification is created in.
	 * @returns The existing notification, or `null` when a new row must be inserted.
	 */
	private async findRedeliveredNotification(
		input: IEmployeeNotificationCreateInput,
		tenantId: ID,
		organizationId: ID
	): Promise<IEmployeeNotification | null> {
		const { receiverEmployeeId, entity, entityId, type } = input;
		if (!receiverEmployeeId || !entity || !entityId || !type || !tenantId || !organizationId) {
			return null;
		}

		const now = Date.now();
		try {
			const candidates = await this.find({
				where: {
					receiverEmployeeId,
					entity,
					entityId,
					type,
					tenantId,
					organizationId,
					isRead: false,
					isArchived: false,
					// Bounded on both sides: under TypeORM `createdAt` is the database's column default (on
					// PostgreSQL a timestamp without time zone) while the bounds come from this process's clock.
					// A clock or time-zone skew between the two can then only make the window miss — insert as
					// usual — instead of stretching it over hours of legitimate notifications.
					createdAt: Between(
						new Date(now - EMPLOYEE_NOTIFICATION_REDELIVERY_WINDOW_MS),
						new Date(now + EMPLOYEE_NOTIFICATION_REDELIVERY_WINDOW_MS)
					)
				}
			});

			// Sender, title and message are compared here rather than in the where clause: they are often
			// absent, and whether a null where-value matches IS NULL, is ignored or throws depends on the
			// connection's `invalidWhereValuesBehavior` — an ignored key would widen the match again.
			const same = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);
			return (
				candidates.find(
					(candidate) =>
						same(candidate.sentByEmployeeId, input.sentByEmployeeId) &&
						same(candidate.title, input.title) &&
						same(candidate.message, input.message)
				) ?? null
			);
		} catch (error) {
			// Redacted: a driver error carries the bound values (ids, the notification title) in its text.
			this.logger.warn('Notification redelivery check failed, inserting as usual:', redactDatabaseError(error));
			return null;
		}
	}

	/**
	 * Determines whether a employee notification should be created based on the employee's notification settings and the notification type.
	 *
	 * @param employeeNotificationSetting - The employee's notification settings.
	 * @param type - The type of notification.
	 * @returns {boolean} True if a employee notification should be created, false otherwise.
	 */
	private shouldCreateEmployeeNotification(
		employeeNotificationSetting: IEmployeeNotificationSetting,
		type: EmployeeNotificationTypeEnum
	): boolean {
		switch (type) {
			case EmployeeNotificationTypeEnum.PAYMENT:
				return employeeNotificationSetting.payment ?? true;
			case EmployeeNotificationTypeEnum.ASSIGNMENT:
				return employeeNotificationSetting.assignment ?? true;
			case EmployeeNotificationTypeEnum.INVITATION:
				return employeeNotificationSetting.invitation ?? true;
			case EmployeeNotificationTypeEnum.MENTION:
				return employeeNotificationSetting.mention ?? true;
			case EmployeeNotificationTypeEnum.COMMENT:
				return employeeNotificationSetting.comment ?? true;
			case EmployeeNotificationTypeEnum.MESSAGE:
				return employeeNotificationSetting.message ?? true;
			case EmployeeNotificationTypeEnum.BROADCAST:
				return true; // Broadcasts are always allowed
			default:
				throw new Error(`Unsupported notification type: ${type}`);
		}
	}
}
