import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CandidateStatusEnum, ICandidate, IRole, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from './../../../core/context';
import { CandidateService } from '../../candidate.service';
import { CandidateHiredCommand } from '../candidate.hired.command';
import { EmployeeService } from './../../../employee/employee.service';
import { UserService } from './../../../user/user.service';
import { RoleService } from './../../../role/role.service';

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
			relations: ['user', 'user.role', 'tenant', 'organization', 'contact', 'organizationPosition']
		});
		if (candidate.alreadyHired) {
			throw new ConflictException('The candidate is already hired');
		}

		try {
			//1. Update hired candidate details
			await this.candidateService.update(id,  {
				status: CandidateStatusEnum.HIRED,
				hiredDate: new Date()
			});

			//2. Create employee for respective candidate
			const employee = await this.employeeService.create({
				billRateValue: candidate.billRateValue,
				billRateCurrency: candidate.billRateCurrency,
				reWeeklyLimit: candidate.reWeeklyLimit,
				payPeriod: candidate.payPeriod,
				tenantId: candidate.tenantId,
				organizationId: candidate.organizationId,
				userId: candidate.userId,
				contactId: candidate.contactId,
				organizationPositionId: candidate.organizationPositionId
			});

			//3. Migrate CANDIDATE role to EMPLOYEE role
			const { user } = candidate;
			const role: IRole = await this.roleService.findOneByConditions({
				tenantId: RequestContext.currentTenantId(),
				name: RolesEnum.EMPLOYEE
			});
			await this.userService.create({
				id: user.id,
				role
			});

			//4. Convert candidate to employee user
			return await this.candidateService.create({ 
				id, 
				employee
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
