import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	ManyToMany,
	JoinTable,
	OneToMany
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsOptional,
	IsDate,
	IsEnum,
	IsBoolean
} from 'class-validator';
import { Base } from '../core/entities/base';
import {
	OrganizationProjects as IOrganizationProjects,
	CurrenciesEnum
} from '@gauzy/models';
import { OrganizationClients } from '../organization-clients/organization-clients.entity';
import { Employee } from '../employee/employee.entity';
import { InvoiceItem } from '../invoice-item/invoice-item.entity';

@Entity('organization_project')
export class OrganizationProjects extends Base
	implements IOrganizationProjects {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	organizationId: string;

	@ApiPropertyOptional({ type: OrganizationClients })
	@ManyToOne(
		(type) => OrganizationClients,
		(client) => client.projects,
		{
			nullable: true,
			onDelete: 'CASCADE'
		}
	)
	@JoinColumn()
	client?: OrganizationClients;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	startDate?: Date;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	endDate?: Date;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	type: string;

	@ApiProperty({ type: String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsNotEmpty()
	@Index()
	@Column({ nullable: true })
	currency: string;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	public: boolean;

	@ManyToMany((type) => Employee, { cascade: ['update'] })
	@JoinTable({
		name: 'organization_project_employee'
	})
	members?: Employee[];

	@ApiPropertyOptional({ type: InvoiceItem, isArray: true })
	@OneToMany(
		(type) => InvoiceItem,
		(invoiceItem) => invoiceItem.project,
		{ onDelete: 'SET NULL' }
	)
	@JoinColumn()
	invoiceItems?: InvoiceItem[];
}
