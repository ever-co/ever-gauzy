import { Injectable } from '@nestjs/common';
import { ICandidateInterviewersCreateInput, ID } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { IPartialEntity } from './../core/crud/icrud.service';
import { TypeOrmCandidateInterviewersRepository } from './repository/type-orm-candidate-interviewers.repository';
import { MikroOrmCandidateInterviewersRepository } from './repository/mikro-orm-candidate-interviewers.repository';
import { CandidateInterviewers } from './candidate-interviewers.entity';

@Injectable()
export class CandidateInterviewersService extends TenantAwareCrudService<CandidateInterviewers> {
	constructor(
		typeOrmCandidateInterviewersRepository: TypeOrmCandidateInterviewersRepository,
		mikroOrmCandidateInterviewersRepository: MikroOrmCandidateInterviewersRepository
	) {
		super(typeOrmCandidateInterviewersRepository, mikroOrmCandidateInterviewersRepository);
	}

	/**
	 * Get interviewers by interview ID.
	 */
	async getInterviewersByInterviewId(interviewId: ID): Promise<CandidateInterviewers[]> {
		return await this.find({
			where: { interviewId }
		});
	}

	/**
	 * Create interviewers in bulk.
	 */
	async createBulk(input: ICandidateInterviewersCreateInput[] = []): Promise<CandidateInterviewers[]> {
		if (!input.length) {
			return [];
		}

		const interviewers: IPartialEntity<CandidateInterviewers>[] = input.flatMap(
			({ employeeId, employeeIds, ...rest }) => {
				if (employeeIds?.length) {
					return employeeIds.map((id) => ({
						...rest,
						employeeId: id
					}));
				}

				if (employeeId) {
					return [
						{
							...rest,
							employeeId
						}
					];
				}

				return [];
			}
		);

		return interviewers.length ? this.saveMany(interviewers) : [];
	}
}
