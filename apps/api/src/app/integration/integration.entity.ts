import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, RelationId, ManyToOne } from 'typeorm';
import { Tenant } from '../tenant';
import { Base } from '../core/entities/base';
import { IIntegration } from '@gauzy/models';

@Entity('integration')
export class Integration extends Base implements IIntegration {
	@ApiProperty({ type: Tenant })
	@ManyToOne((type) => Tenant, {
		nullable: false
	})
	@JoinColumn()
	tenant: Tenant;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((integration: Integration) => integration.tenant)
	readonly tenantId: string;

	@ApiProperty({ type: String })
	@Column({ nullable: false })
	name: string;
}
