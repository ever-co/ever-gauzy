import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CandidateStatusEnum, ICandidate, IRole, RolesEnum } from '@gauzy/contracts';
import { CandidateService } from '../../candidate.service';
import { CandidateHiredCommand } from '../candidate.hired.command';
import { EmployeeService } from './../../../employee/employee.service';
import { UserService } from './../../../user/user.service';
import { RoleService } from './../../../role/role.service';
import { RequestContext } from 'core';

@CommandHandler(CandidateHiredCommand)
export class CandidateHiredHandler
	implements ICommandHandler<CandidateHiredCommand> {

	constructor(
		private readonly candidateService: CandidateService,
		private readonly employeeService: EmployeeService,
		private readonly userService: UserService,
		private readonly roleService: RoleService
	) {}

	public async execute(command: CandidateHiredCommand): Promise<ICandidate> {
		const { id } = command;
		const candidate: ICandidate = await this.candidateService.findOneByIdString(id, {
			relations: {
				user: true,
				tags: true
			},
			relationLoadStrategy: 'query'
		});
		if (candidate.alreadyHired) {
			throw new ConflictException('The candidate is already hired, you can not hired it.');
		}
		try {
			const hiredDate = new Date();

			//1. Create employee for respective candidate
			const employee = await this.employeeService.create({
				billRateValue: candidate.billRateValue,
				billRateCurrency: candidate.billRateCurrency,
				reWeeklyLimit: candidate.reWeeklyLimit,
				payPeriod: candidate.payPeriod,
				tenantId: candidate.tenantId,
				organizationId: candidate.organizationId,
				userId: candidate.userId,
				contactId: candidate.contactId,
				organizationPositionId: candidate.organizationPositionId,
				tags: candidate.tags,
				isActive: true,
				startedWorkOn: hiredDate
			});

			//2. Migrate CANDIDATE role to EMPLOYEE role
			const role: IRole = await this.roleService.findOneByWhereOptions({
				name: RolesEnum.EMPLOYEE
			});

			await this.userService.create({
				id: candidate.userId,
				role
			});

			//3. Convert candidate to employee user
			//4. Update hired candidate details
			return await this.candidateService.create({
				id,
				status: CandidateStatusEnum.HIRED,
				hiredDate: hiredDate,
				rejectDate: null,
				employee
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
