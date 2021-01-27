import {
	Entity,
	Index,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	OneToMany,
	AfterLoad
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { IReport, IReportCategory } from '@gauzy/contracts';
import { FileStorage } from '../core/file-storage';
import {
	BaseEntity,
	ReportCategory,
	ReportOrganization
} from '../core/entities/internal';

@Entity('report')
export class Report extends BaseEntity implements IReport {
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

	@AfterLoad()
	afterLoad?() {
		if (this.image) {
			this.imageUrl = new FileStorage().getProvider().url(this.image);
		}
	}
}
