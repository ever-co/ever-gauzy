import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { IsString } from 'class-validator';
import { ICandidateCriterionsRating } from '@gauzy/models';
import { CandidateFeedback } from '../candidate-feedbacks/candidate-feedbacks.entity';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';

@Entity('candidate_criterion_rating')
export class CandidateCriterionsRating extends Base
	implements ICandidateCriterionsRating {
	@ApiProperty({ type: String })
	@Column()
	rating: number;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	technologyId?: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	personalQualityId?: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	feedbackId: string;

	@ManyToOne(
		(type) => CandidateFeedback,
		(feedback) => feedback.criterionsRating
	)
	feedback: CandidateFeedback;

  @ApiProperty({ type: Organization })
  @ManyToOne((type) => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn()
  organization: Organization;

  @ApiProperty({ type: String, readOnly: true })
  @RelationId((candidateCriterionsRating: CandidateCriterionsRating) => candidateCriterionsRating.organization)
  @IsString()
  @Column({ nullable: true })
  organizationId: string;

  @ApiProperty({ type: Tenant })
  @ManyToOne((type) => Tenant, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn()
  tenant: Tenant;

  @ApiProperty({ type: String, readOnly: true })
  @RelationId((candidateCriterionsRating: CandidateCriterionsRating) => candidateCriterionsRating.tenant)
  @IsString()
  @Column({ nullable: true })
  tenantId: string;
}
