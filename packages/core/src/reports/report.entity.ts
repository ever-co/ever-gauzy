import {
	Index,

	RelationId,
	JoinColumn
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { IReport, IReportCategory, IReportOrganization } from '@gauzy/contracts';
import { BaseEntity } from '../core/entities/internal';
import { ReportCategory } from './report-category.entity';
import { ReportOrganization } from './report-organization.entity';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmReportRepository } from './repository/mikro-orm-report.repository';
import { MultiORMManyToOne, MultiORMOneToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('report', { mikroOrmRepository: () => MikroOrmReportRepository })
export class Report extends BaseEntity implements IReport {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@MultiORMColumn()
	name?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@MultiORMColumn({ nullable: true })
	slug?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn({ nullable: true })
	description?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn({ nullable: true })
	image?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn({ nullable: true })
	iconClass?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn({ default: false })
	showInMenu?: boolean;

	imageUrl?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	@ApiProperty({ type: () => ReportCategory })
	@MultiORMManyToOne(() => ReportCategory, (it) => it.reports, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	category?: IReportCategory;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: Report) => it.category)
	@Index()
	@MultiORMColumn()
	categoryId?: IReportCategory['id'];

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	@ApiProperty({ type: () => ReportOrganization })
	@MultiORMOneToMany(() => ReportOrganization, (it) => it.report, {
		cascade: true
	})
	@JoinColumn()
	reportOrganizations?: IReportOrganization[];
}
