import {
	Entity,
	Index,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';
import { IReport, IReportCategory } from '@gauzy/models';
import { ReportCategory } from './report-category.entity';

@Entity('report')
export class Report extends TenantOrganizationBase implements IReport {
	@ApiProperty({ type: ReportCategory })
	@ManyToOne((type) => ReportCategory, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	category?: IReportCategory;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((proposal: Report) => proposal.category)
	@IsString()
	@Column({ nullable: true })
	categoryId?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column({ nullable: true })
	slug?: string;

	@ApiProperty({ type: String, readOnly: true })
	@IsString()
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: String, readOnly: true })
	@IsString()
	@Column({ nullable: true })
	image?: string;

	@ApiProperty({ type: String, readOnly: true })
	@IsString()
	@Column({ default: false })
	showInMenu?: boolean;
}
