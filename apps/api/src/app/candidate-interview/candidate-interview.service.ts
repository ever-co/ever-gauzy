import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { CandidateInterview } from './candidate-interview.entity';
import { ICandidateInterview } from '@gauzy/models';

@Injectable()
export class CandidateInterviewService extends CrudService<CandidateInterview> {
	constructor(
		@InjectRepository(CandidateInterview)
		private readonly candidateInterviewRepository: Repository<
			CandidateInterview
		>
	) {
		super(candidateInterviewRepository);
	}
	async findByCandidateId(
		candidateId: string
	): Promise<CandidateInterview[]> {
		return await this.repository
			.createQueryBuilder('candidate_interview')
			.where('candidate_interview.candidateId = :candidateId', {
				candidateId
			})
			.getMany();
	}
	async updateInterview(
		id: string,
		entity: ICandidateInterview
	): Promise<CandidateInterview> {
		try {
			const interviewId = id['id'];
			const interview: ICandidateInterview = await this.repository
				.createQueryBuilder('candidate_interview')
				.where('candidate_interview.id = :interviewId', {
					interviewId
				})
				.getOne();

			if (interview) {
				interview.note =
					entity.note === interview.note
						? interview.note
						: entity.note;
				interview.title =
					entity.title === interview.title
						? interview.title
						: entity.title;
				interview.location =
					entity.location === interview.location
						? interview.location
						: entity.location;
				interview.startTime =
					entity.startTime === interview.startTime
						? interview.startTime
						: entity.startTime;
				interview.endTime =
					entity.endTime === interview.endTime
						? interview.endTime
						: entity.endTime;
				return await this.repository.save(interview);
			}
		} catch (err) {
			throw new BadRequestException(err);
		}
	}
}
