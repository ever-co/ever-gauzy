import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CandidateStatusEnum, ICandidate, IRole, RolesEnum } from '@gauzy/contracts';
import { CandidateService } from '../../candidate.service';
import { CandidateHiredCommand } from '../candidate.hired.command';
import { EmployeeService } from './../../../employee/employee.service';
import { UserService } from './../../../user/user.service';
import { RoleService } from './../../../role/role.service';

@CommandHandler(CandidateHiredCommand)
export class CandidateHiredHandler implements ICommandHandler<CandidateHiredCommand> {
	constructor(
		private readonly candidateService: CandidateService,
		private readonly employeeService: EmployeeService,
		private readonly userService: UserService,
		private readonly roleService: RoleService
	) {}

	/**
	 * Executes the process of hiring a candidate.
	 *
	 * @param {CandidateHiredCommand} command - The command containing the candidate ID.
	 * @returns {Promise<ICandidate>} - The updated candidate object.
	 * @throws {ConflictException} - If the candidate is already hired.
	 * @throws {BadRequestException} - If there is an error during the update process.
	 */
	public async execute({ id }: CandidateHiredCommand): Promise<ICandidate> {
		// Fetch the candidate with the necessary relations
		const candidate: ICandidate = await this.candidateService.findOneByIdString(id, {
			relations: {
				user: true,
				tags: true
			}
		});

		// Check if the candidate is already hired
		if (candidate.alreadyHired) {
			throw new ConflictException('The candidate is already hired, you cannot hire them again.');
		}

		try {
			const hiredDate = new Date();

			// Step 1: Create an employee for the respective candidate
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

			// Step 2: Migrate CANDIDATE role to EMPLOYEE role
			const role: IRole = await this.roleService.findOneByWhereOptions({ name: RolesEnum.EMPLOYEE });

			await this.userService.create({
				id: candidate.userId,
				role
			});

			// Step 3 & 4: Convert candidate to employee user and update hired candidate details
			return await this.candidateService.create({
				id,
				status: CandidateStatusEnum.HIRED,
				hiredDate: hiredDate,
				rejectDate: null,
				employee,
				isActive: true,
				isArchived: false
			});
		} catch (error) {
			// Handle any errors that occur during the update process
			throw new BadRequestException(error.message || error);
		}
	}
}
