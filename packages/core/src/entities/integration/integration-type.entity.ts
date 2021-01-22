import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';
import { DeepPartial, IIntegrationType } from '@gauzy/common';
import { BaseEntity } from '../internal';

@Entity('integration_type')
export class IntegrationType extends BaseEntity implements IIntegrationType {
	constructor(input?: DeepPartial<IntegrationType>) {
		super(input);
	}

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
