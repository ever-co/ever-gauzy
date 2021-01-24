import { IEstimateEmail } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEmail, IsString } from 'class-validator';
import { Column, Entity } from 'typeorm';
import { TenantOrganizationBaseEntity } from '../internal';

@Entity('estimate_email')
export class EstimateEmail
	extends TenantOrganizationBaseEntity
	implements IEstimateEmail {
	constructor(input?: DeepPartial<EstimateEmail>) {
		super(input);
	}

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
