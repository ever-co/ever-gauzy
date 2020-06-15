import { Base } from '../core/entities/base';
import { Entity, Column, ManyToOne } from 'typeorm';
import { Tag as ITag } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';

@Entity('tag')
export class Tag extends Base implements ITag {
	@ApiProperty({ type: String })
	@Column()
	name?: string;

	@ApiProperty({ type: String })
	@Column()
	description?: string;

	@ApiProperty({ type: String })
	@Column()
	color?: string;

	@ApiProperty()
	@ManyToOne((type) => Organization)
	organization?: Organization;

	@ApiProperty()
	@ManyToOne((type) => Tenant)
	tenant?: Tenant;
}
