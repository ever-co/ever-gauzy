import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ApiModelProperty, ApiModelPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsDate } from 'class-validator';
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

	@ApiModelPropertyOptional({ type: Employee, isArray: true })
	@ManyToOne((type) => Employee, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	teams?: Employee[];
}
