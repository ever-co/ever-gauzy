import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import { ID, StatusTypesEnum, StatusTypesMapRequestApprovalEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { RequestApproval } from '../../../core/entities/internal';
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

	/**
	 * Approves or denies a time-off request (`PUT /time-off-request/approval|denied/:id`, GraphQL
	 * `approveTimeOffRequest` / `denyTimeOffRequest`), and the request approval recorded beside it.
	 *
	 * Who may decide, and that a decided request may be decided again, are unchanged. What changed is how the two rows
	 * are written (follow-up listed on ever-co/ever-gauzy#11382): see {@link decide}.
	 *
	 * @param command The request and the decision.
	 * @returns The request, as decided.
	 * @throws NotFoundException when the request is not one of the caller's tenant.
	 */
	public async execute(command?: TimeOffStatusCommand): Promise<TimeOffRequest> {
		const { id, status } = command;
		// Both repositories are RAW (not tenant-aware): the request and its approval row must be
		// resolved inside the caller's tenant, or an admin of tenant A could approve / deny any tenant
		// B request by UUID (GHSA-gwpq-mmw7-vx85 class).
		const tenantId = RequestContext.currentTenantId();
		if (!id || !tenantId) {
			throw new NotFoundException('Request time off not found');
		}

		// The read that answers an unknown (or withdrawn) request with 404, as before.
		const timeOffRequest = await this.typeOrmTimeOffRequestRepository.findOneBy({ id, tenantId });
		if (!timeOffRequest) {
			throw new NotFoundException('Request time off not found');
		}

		await this.decide(timeOffRequest.id, tenantId, status);

		return await this.typeOrmTimeOffRequestRepository.findOneBy({ id: timeOffRequest.id, tenantId });
	}

	/**
	 * Writes the decision on the request and on its request approval, in one transaction.
	 *
	 * The route used to read both rows, set their status in memory, and `save()` each copy on its own. A save writes
	 * every column its copy differs in from the stored row, so an edit of the leave that landed between the read and
	 * the save (its dates, its policy, its employees) was written back to what the read had found, and the two rows
	 * could end up disagreeing when two decisions, or a decision and an answer through the request approval's own
	 * route, crossed.
	 *
	 * Now, on one transaction: the request approval's row is locked first (`SELECT … FOR UPDATE` on PostgreSQL and
	 * MySQL; SQLite serializes the transaction instead), the lock the request approval's own answer route takes before
	 * it moves the leave (ever-co/ever-gauzy#11382), so the two routes take turns and take their locks in one order;
	 * then the leave is read again under its own lock, and refused (404, nothing written) when it is gone; then each
	 * row's status is written, and nothing else.
	 *
	 * This handler works through TypeORM's repositories on either ORM the installation runs, as it always has: the
	 * locks are the database's, so they hold against the MikroORM answer route as well.
	 *
	 * @param id The time-off request.
	 * @param tenantId The caller's tenant.
	 * @param status The decision.
	 * @throws NotFoundException when the leave was removed since it was read; neither status is written then.
	 */
	protected async decide(id: ID, tenantId: ID, status: StatusTypesEnum): Promise<void> {
		// SQLite has no row locks (TypeORM refuses `setLock` there); its transactions are serialized instead.
		const rowLock = isPostgres() || isMySQL();

		await this.typeOrmTimeOffRequestRepository.manager.transaction(async (manager: EntityManager) => {
			// Each row alone (a query builder joins no eager relation, such as the leave's document), so each lock is
			// on that row; the approval's first, then the leave's.
			const approvalQuery = manager
				.createQueryBuilder(RequestApproval, 'request_approval')
				.where({ requestId: id, tenantId });
			const requestApproval = rowLock
				? await approvalQuery.setLock('pessimistic_write').getOne()
				: await approvalQuery.getOne();

			// The leave again, under its lock: one removed (or withdrawn) since the read that answered 404 is not
			// decided, and neither is its approval — the transaction rolls back with the same 404.
			const leaveQuery = manager.createQueryBuilder(TimeOffRequest, 'time_off_request').where({ id, tenantId });
			const leave = rowLock ? await leaveQuery.setLock('pessimistic_write').getOne() : await leaveQuery.getOne();
			if (!leave) {
				throw new NotFoundException('Request time off not found');
			}

			await manager.update(TimeOffRequest, { id, tenantId }, { status });

			if (requestApproval) {
				await manager.update(
					RequestApproval,
					{ id: requestApproval.id, tenantId },
					{ status: StatusTypesMapRequestApprovalEnum[status] }
				);
			}
		});
	}
}
