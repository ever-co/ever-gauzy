import {
	Entity,
	Index,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	OneToMany
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { IReport, IReportCategory, IReportOrganization } from '@gauzy/contracts';
import { BaseEntity } from '../core/entities/internal';
import { ReportCategory } from './report-category.entity';
import { ReportOrganization } from './report-organization.entity';

@Entity('report')
export class Report extends BaseEntity implements IReport {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column({ nullable: true })
	slug?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@Column({ nullable: true })
	image?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@Column({ nullable: true })
	iconClass?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@Column({ default: false })
	showInMenu?: boolean;

	imageUrl?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	@ApiProperty({ type: () => ReportCategory })
	@ManyToOne(() => ReportCategory, (it) => it.reports, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	category?: IReportCategory;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: Report) => it.category)
	@Index()
	@Column()
	categoryId?: IReportCategory['id'];

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	@ApiProperty({ type: () => ReportOrganization })
	@OneToMany(() => ReportOrganization, (it) => it.report, {
		cascade: true
	})
	@JoinColumn()
	reportOrganizations?: IReportOrganization[];
}
