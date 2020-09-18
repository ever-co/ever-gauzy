import { IEstimateEmail } from '@gauzy/models';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEmail, IsString } from 'class-validator';
import { Column, Entity } from 'typeorm';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('estimate_email')
export class EstimateEmail extends TenantOrganizationBase
	implements IEstimateEmail {
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
}
