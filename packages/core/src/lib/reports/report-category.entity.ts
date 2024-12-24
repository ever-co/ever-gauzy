import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { IReport, IReportCategory } from '@gauzy/contracts';
import { BaseEntity, Report } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmReportCategoryRepository } from './repository/mikro-orm-report-category.repository';

@MultiORMEntity('report_category', { mikroOrmRepository: () => MikroOrmReportCategoryRepository })
export class ReportCategory extends BaseEntity implements IReportCategory {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn()
	name?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn({ nullable: true })
	iconClass?: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 *
	 */
	@MultiORMOneToMany(() => Report, (it) => it.category, {
		cascade: true
	})
	reports: IReport[];
}
