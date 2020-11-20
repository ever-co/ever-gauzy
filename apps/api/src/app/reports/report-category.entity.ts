import { Entity, Index, Column, OneToMany } from 'typeorm';
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
	iconClass?: string;

	@ApiProperty({ type: Report })
	@OneToMany(() => Report, (report) => report.category)
	reports: IReport[];
}
