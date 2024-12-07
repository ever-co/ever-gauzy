import {
	RelationId,
	JoinColumn
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { IReport, IReportCategory, IReportOrganization } from '@gauzy/contracts';
import { BaseEntity } from '../core/entities/internal';
import { ReportCategory } from './report-category.entity';
import { ReportOrganization } from './report-organization.entity';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, MultiORMOneToMany, VirtualMultiOrmColumn } from './../core/decorators/entity';
import { MikroOrmReportRepository } from './repository/mikro-orm-report.repository';

@MultiORMEntity('report', { mikroOrmRepository: () => MikroOrmReportRepository })
export class Report extends BaseEntity implements IReport {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn()
	name?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@ColumnIndex()
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

	/** Additional virtual columns */
	@VirtualMultiOrmColumn()
	imageUrl?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@MultiORMManyToOne(() => ReportCategory, (it) => it.reports, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	category?: IReportCategory;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: Report) => it.category)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	categoryId?: IReportCategory['id'];

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	@MultiORMOneToMany(() => ReportOrganization, (it) => it.report, {
		cascade: true
	})
	@JoinColumn()
	reportOrganizations?: IReportOrganization[];
}
