import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	ManyToMany
} from 'typeorm';
import { ApiModelProperty, ApiModelPropertyOptional } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsOptional,
	IsDate,
	IsEnum
} from 'class-validator';
import { Base } from '../core/entities/base';
import {
	OrganizationProjects as IOrganizationProjects,
	CurrenciesEnum
} from '@gauzy/models';
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

	@ApiModelPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	startDate?: Date;

	@ApiModelPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	endDate?: Date;

	@ApiModelProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	type: string;

	@ApiModelProperty({ type: String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsNotEmpty()
	@Index()
	@Column()
	currency: string;

	@ApiModelPropertyOptional({ type: Employee, isArray: true })
	@ManyToMany((type) => Employee, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	team?: Employee[];
}
