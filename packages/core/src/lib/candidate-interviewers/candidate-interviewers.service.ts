import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { ICandidateInterviewersDeleteInput, ICandidateInterviewersCreateInput, ID } from '@gauzy/contracts';
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
	 *
	 * @param interviewId
	 * @returns
	 */
	async getInterviewersByInterviewId(interviewId: ID): Promise<CandidateInterviewers[]> {
		return await this.typeOrmRepository
			.createQueryBuilder('candidate_interviewer')
			.where('candidate_interviewer.interviewId = :interviewId', {
				interviewId
			})
			.getMany();
	}

	/**
	 *
	 * @param employeeId
	 * @returns
	 */
	async getInterviewersByEmployeeId(employeeId: ICandidateInterviewersDeleteInput): Promise<any> {
		return await this.typeOrmRepository
			.createQueryBuilder('candidate_interviewer')
			.where('candidate_interviewer.employeeId = :employeeId', {
				employeeId
			})
			.getMany();
	}

	/**
	 *
	 * @param ids
	 * @returns
	 */
	async deleteBulk(ids: string[]) {
		if (ids.length > 0) {
			await this.delete({ id: In(ids) } as any);
		}
	}

	/**
	 *
	 * @param input
	 * @returns
	 */
	async createBulk(input: ICandidateInterviewersCreateInput[]) {
		const interviewers: IPartialEntity<CandidateInterviewers>[] = [];
		for (const item of input) {
			const { employeeId, employeeIds, ...rest } = item;
			if (employeeIds && employeeIds.length > 0) {
				for (const id of employeeIds) {
					interviewers.push({
						...rest,
						employeeId: id
					});
				}
			} else if (employeeId) {
				interviewers.push({
					...rest,
					employeeId
				});
			}
		}
		return await this.saveMany(interviewers);
	}
}
