import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';
import { ICustomSmtp } from '@gauzy/models';

@Entity('custom_smtp')
export class CustomSmtp extends TenantOrganizationBase implements ICustomSmtp {
	@ApiProperty({ type: String })
	@Column()
	host: string;

	@ApiProperty({ type: Number })
	@Column()
	port: number;

	@ApiProperty({ type: Boolean })
	@Column()
	secure: boolean;

	@ApiProperty({ type: String })
	@Column()
	username: string;

	@ApiProperty({ type: String })
	@Column()
	password: string;

	@ApiProperty({ type: Boolean, default: false })
	@Column({ default: false })
	isValidate?: boolean;
}
