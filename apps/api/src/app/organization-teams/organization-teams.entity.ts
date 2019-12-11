import { Column, Entity, Index, ManyToMany, JoinTable } from 'typeorm';
import { ApiModelProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Base } from '../core/entities/base';
import { OrganizationTeams as IOrganizationTeams } from '@gauzy/models';
import { Employee } from '../employee';

@Entity('organization_teams')
export class OrganizationTeams extends Base implements IOrganizationTeams {
	@ApiModelProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiModelProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	organizationId: string;

	@ManyToMany((type) => Employee, { cascade: ['update'] })
	@JoinTable({
		name: 'organization_team_employee'
	})
	members?: Employee[];
}
