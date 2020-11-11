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
import { IReport, IReportCategory } from '@gauzy/models';
import { ReportCategory } from './report-category.entity';
import { Base } from '../core/entities/base';

@Entity('report')
export class Report extends Base implements IReport {
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
	@Column({ default: false })
	showInMenu?: boolean;
}
