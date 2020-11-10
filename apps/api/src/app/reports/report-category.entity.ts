import { Entity, Index, Column, ManyToOne, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';
import { IReport, IReportCategory } from '@gauzy/models';
import { Report } from './report.entity';

@Entity('report_category')
export class ReportCategory
	extends TenantOrganizationBase
	implements IReportCategory {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name?: string;

	@ApiProperty({ type: String, readOnly: true })
	@IsString()
	@Column({ nullable: true })
	image?: string;

	@ApiProperty({ type: Report })
	@ManyToOne((type) => Report, (report) => report.category)
	@JoinTable({ name: 'tag_proposal' })
	reports: IReport[];
}
