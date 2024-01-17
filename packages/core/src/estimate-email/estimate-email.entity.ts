import { IEstimateEmail } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column } from 'typeorm';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { Entity } from '@gauzy/common';

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
