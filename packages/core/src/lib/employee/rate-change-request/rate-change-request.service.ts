import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { Not } from 'typeorm';
import {
	BaseEntityEnum,
	EmployeeNotificationTypeEnum,
	ID,
	IEmployee,
	IEmployeeRateChangeRequestInput,
	IEmployeeRateChangeRequestResult,
	PermissionsEnum
} from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { MultiORM, MultiORMEnum, getORMType } from '../../core/utils';
import { EmployeeCreateNotificationEvent } from '../../employee-notification/events/employee-notification.event';
import { assertCurrentUserBelongsToOrganization } from '../../user-organization/assert-organization-membership';
import { TypeOrmEmployeeRepository } from '../repository/type-orm-employee.repository';
import { MikroOrmEmployeeRepository } from '../repository/mikro-orm-employee.repository';

/** Who receives a rate change request: whoever may edit every employee's rates. */
const RATE_DECIDING_PERMISSION = PermissionsEnum.ORG_EMPLOYEES_EDIT;

/**
 * An employee may not change their own rate when their organization locks it: they ask an admin instead. The request
 * reaches every active employee of the organization whose role grants ORG_EMPLOYEES_EDIT, as an employee
 * notification about the requester; the admin applies it with the usual employee edit.
 */
@Injectable()
export class EmployeeRateChangeRequestService {
	private readonly ormType: MultiORM = getORMType();

	constructor(
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly mikroOrmEmployeeRepository: MikroOrmEmployeeRepository,
		private readonly eventBus: EventBus
	) {}

	async request(input: IEmployeeRateChangeRequestInput): Promise<IEmployeeRateChangeRequestResult> {
		const tenantId = RequestContext.currentTenantId();
		const requesterId = RequestContext.currentUser()?.employeeId;
		if (!requesterId) {
			throw new ForbiddenException('Only an employee can request a rate change.');
		}
		const { organizationId } = input;
		await assertCurrentUserBelongsToOrganization(this.typeOrmEmployeeRepository.manager, organizationId);

		const requester = await this.findRequester(requesterId, organizationId, tenantId);
		if (!requester) {
			throw new NotFoundException('You are not an employee of this organization.');
		}

		const receiverIds = await this.findRateDeciderIds(organizationId, tenantId, requesterId);
		const notice = rateChangeRequestNotice(requester, input);
		for (const receiverEmployeeId of receiverIds) {
			this.eventBus.publish(
				new EmployeeCreateNotificationEvent({
					...notice,
					type: EmployeeNotificationTypeEnum.RATE_CHANGE_REQUEST,
					entity: BaseEntityEnum.Employee,
					entityId: requesterId,
					sentByEmployeeId: requesterId,
					receiverEmployeeId,
					organizationId,
					tenantId
				})
			);
		}
		return { notified: receiverIds.length };
	}

	private async findRequester(employeeId: ID, organizationId: ID, tenantId: ID): Promise<IEmployee | null> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return await this.mikroOrmEmployeeRepository.findOne(
					{ id: employeeId, organizationId, tenantId } as any,
					{ populate: ['user'] as any[] }
				);
			case MultiORMEnum.TypeORM:
			default:
				return await this.typeOrmEmployeeRepository.findOne({
					where: { id: employeeId, organizationId, tenantId },
					relations: { user: true }
				});
		}
	}

	/** The active employees of the organization whose role grants the permission that decides rates. */
	private async findRateDeciderIds(organizationId: ID, tenantId: ID, requesterId: ID): Promise<ID[]> {
		const holdsPermission = { rolePermissions: { permission: RATE_DECIDING_PERMISSION, enabled: true } };
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const employees = await this.mikroOrmEmployeeRepository.find({
					organizationId,
					tenantId,
					id: { $ne: requesterId },
					isActive: true,
					isArchived: false,
					user: { isActive: true, role: holdsPermission }
				} as any);
				return employees.map((employee) => employee.id);
			}
			case MultiORMEnum.TypeORM:
			default: {
				const employees = await this.typeOrmEmployeeRepository.find({
					where: {
						organizationId,
						tenantId,
						id: Not(requesterId),
						isActive: true,
						isArchived: false,
						user: { isActive: true, role: holdsPermission }
					},
					select: { id: true }
				});
				return employees.map((employee) => employee.id);
			}
		}
	}
}

function rateText(value: number | string | null | undefined, currency: string | null | undefined): string {
	const isMissing = value === null || value === undefined;
	if (isMissing) {
		return 'none';
	}
	const unit = currency ?? '';
	return `${value} ${unit}`.trim();
}

/** The title and message an admin reads: who asks, their current rate, the rate they ask for, and why. */
export function rateChangeRequestNotice(
	requester: IEmployee,
	input: IEmployeeRateChangeRequestInput
): { title: string; message: string } {
	const name = requester.user?.name || requester.fullName || 'An employee';
	const currentCurrency = requester.billRateCurrency;
	const requestedCurrency = input.billRateCurrency ?? currentCurrency;
	const current = rateText(requester.billRateValue, currentCurrency);
	const requested = rateText(input.billRateValue, requestedCurrency);
	let message = `Current rate: ${current} per hour. Requested rate: ${requested} per hour.`;
	const reason = input.reason?.trim();
	if (reason) {
		message = `${message} Reason: ${reason}`;
	}
	return { title: `${name} asked for a rate change`, message };
}
