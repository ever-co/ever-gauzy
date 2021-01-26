import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';
import { IIntegrationType } from '@gauzy/contracts';
import { BaseEntity } from '../core/entities/internal';

@Entity('integration_type')
export class IntegrationType extends BaseEntity implements IIntegrationType {
	@ApiProperty({ type: String })
	@Column({ nullable: false })
	name: string;

	@ApiProperty({ type: String })
	@Column({ nullable: false })
	groupName: string;

	@ApiProperty({ type: Number })
	@Column({ nullable: false })
	order: number;
}
