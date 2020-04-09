import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Base } from '../core/entities/base';
import { Candidate } from '../candidate/candidate.entity';

@Entity('candidate_source')
export class CandidateSource extends Base {
	@PrimaryGeneratedColumn()
	id?: string;

	@Column({ length: 500, nullable: true })
	@OneToMany(
		(type) => Candidate,
		(candidate) => candidate.source
	)
	name?: string;
}
