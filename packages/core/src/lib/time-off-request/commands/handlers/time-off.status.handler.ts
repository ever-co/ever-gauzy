import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { StatusTypesMapRequestApprovalEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { TimeOffStatusCommand } from '../time-off.status.command';
import { TimeOffRequest } from '../../time-off-request.entity';
import { TypeOrmTimeOffRequestRepository } from '../../repository/type-orm-time-off-request.repository';
import { TypeOrmRequestApprovalRepository } from '../../../request-approval/repository/type-orm-request-approval.repository';

@CommandHandler(TimeOffStatusCommand)
export class TimeOffStatusHandler implements ICommandHandler<TimeOffStatusCommand> {
	constructor(
		private readonly typeOrmTimeOffRequestRepository: TypeOrmTimeOffRequestRepository,
		private readonly typeOrmRequestApprovalRepository: TypeOrmRequestApprovalRepository
	) {}

	public async execute(command?: TimeOffStatusCommand): Promise<TimeOffRequest> {
		const { id, status } = command;
		// Both repositories are RAW (not tenant-aware): the request and its approval row must be
		// resolved inside the caller's tenant, or an admin of tenant A could approve / deny any tenant
		// B request by UUID (GHSA-gwpq-mmw7-vx85 class).
		const tenantId = RequestContext.currentTenantId();
		if (!id || !tenantId) {
			throw new NotFoundException('Request time off not found');
		}

		const [timeOffRequest, requestApproval] = await Promise.all([
			this.typeOrmTimeOffRequestRepository.findOneBy({ id, tenantId }),
			this.typeOrmRequestApprovalRepository.findOneBy({ requestId: id, tenantId })
		]);

		if (!timeOffRequest) {
			throw new NotFoundException('Request time off not found');
		}

		timeOffRequest.status = status;
		if (requestApproval) {
			requestApproval.status = StatusTypesMapRequestApprovalEnum[status];
			await this.typeOrmRequestApprovalRepository.save(requestApproval);
		}

		return await this.typeOrmTimeOffRequestRepository.save(timeOffRequest);
	}
}
