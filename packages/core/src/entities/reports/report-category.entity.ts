import { Entity, Index, Column, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { DeepPartial, IReport, IReportCategory } from '@gauzy/common';
import { BaseEntity, Report } from '../internal';

@Entity('report_category')
export class ReportCategory extends BaseEntity implements IReportCategory {
	constructor(input?: DeepPartial<ReportCategory>) {
		super(input);
	}

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
