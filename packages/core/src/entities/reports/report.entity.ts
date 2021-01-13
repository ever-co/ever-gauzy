import {
	Entity,
	Index,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	AfterLoad,
	OneToMany
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { IReport, IReportCategory } from '@gauzy/common';
import { ReportCategory } from './report-category.entity';
import { Base } from '../base';
// import { FileStorage } from '../core/file-storage';
import { ReportOrganization } from './report-organization.entity';

@Entity('report')
export class Report extends Base implements IReport {
	@ApiProperty({ type: ReportOrganization })
	@OneToMany(
		() => ReportOrganization,
		(reportOrganization) => reportOrganization.report
	)
	@JoinColumn()
	reportOrganizations?: ReportOrganization[];

	@ApiProperty({ type: ReportCategory })
	@ManyToOne(() => ReportCategory)
	@JoinColumn()
	category?: IReportCategory;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((report: Report) => report.category)
	@Column()
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
	@Column({ nullable: true })
	iconClass?: string;

	@ApiProperty({ type: String, readOnly: true })
	@IsString()
	@Column({ default: false })
	showInMenu?: boolean;

	imageUrl?: string;

	/* @AfterLoad()
	afterLoad?() {
		if (this.image) {
			this.imageUrl = new FileStorage().getProvider().url(this.image);
		}
	} */
}
