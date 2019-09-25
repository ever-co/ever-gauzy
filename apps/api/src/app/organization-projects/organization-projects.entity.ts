import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	ManyToMany
} from 'typeorm';
import { ApiModelProperty, ApiModelPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Base } from '../core/entities/base';
import { Organization } from '../organization/organization.entity';
import { OrganizationProjects as IOrganizationProjects } from '@gauzy/models';
import { OrganizationClients } from '../organization-clients';
import { Employee } from '../employee';

@Entity('organization_projects')
export class OrganizationProjects extends Base
	implements IOrganizationProjects {
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

	@ApiModelPropertyOptional({ type: OrganizationClients })
	@ManyToOne((type) => OrganizationClients, (client) => client.projects, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	client?: OrganizationClients;

	@ApiModelPropertyOptional({ type: Employee, isArray: true })
	@ManyToMany((type) => Employee, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	team?: Employee[];
}
