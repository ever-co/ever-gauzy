import { IEstimateEmail } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity('estimate_email')
export class EstimateEmail extends TenantOrganizationBaseEntity
	implements IEstimateEmail {

	@ApiProperty({ type: () => String })
	@Column()
	token?: string;

	@ApiProperty({ type: () => String })
	@Column()
	email?: string;

	@ApiProperty({ type: () => Date })
	@Column()
	expireDate?: Date;

	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ nullable: true })
	convertAcceptedEstimates?: boolean;
}