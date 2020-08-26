import { EstimateEmail as IEstimateEmail } from '@gauzy/models';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEmail, IsString } from 'class-validator';
import { Column, Entity, RelationId } from 'typeorm';
import { Base } from '../core/entities/base';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('estimate_email')
export class EstimateEmail extends TenantBase implements IEstimateEmail {
	@ApiPropertyOptional({ type: String })
	@IsString()
	@Column()
	token?: string;

	@ApiPropertyOptional({ type: String })
	@IsEmail()
	@Column()
	email?: string;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@Column()
	expireDate?: Date;

	@ApiProperty({ type: String })
	@Column()
	organization: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((estimateEmail: EstimateEmail) => estimateEmail.organization)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}
