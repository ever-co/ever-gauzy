import { Entity, Index, Column, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { IReport, IReportCategory } from '@gauzy/models';
import { Report } from './report.entity';
import { Base } from '../core/entities/base';

@Entity('report_category')
export class ReportCategory extends Base implements IReportCategory {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name?: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	icon?: string;

	@ApiProperty({ type: Report })
	@ManyToOne(() => Report, (report) => report.category)
	reports: IReport[];
}
