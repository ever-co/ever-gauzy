import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import {
	ID,
	IEmployee,
	IPayrollItem,
	IPayrollRun,
	PayrollItemCategoryEnum,
	PayrollItemTypeEnum
} from '@gauzy/contracts';
import { Employee, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { PayrollRun } from './../payroll-run/payroll-run.entity';
import { MikroOrmPayrollItemRepository } from './repository/mikro-orm-payroll-item.repository';

/**
 * One earning or deduction line within a payroll run (issue #2453).
 *
 * `amount` is always positive; `category` decides whether it adds to or subtracts from net pay.
 * Money is `numeric(14,2)` with a numeric transformer — a bare `decimal` column comes back from
 * PostgreSQL as a string, and a float column silently loses cents.
 */
@MultiORMEntity('payroll_item', { mikroOrmRepository: () => MikroOrmPayrollItemRepository })
export class PayrollItem extends TenantOrganizationBaseEntity implements IPayrollItem {
	@ApiProperty({ enum: PayrollItemTypeEnum })
	@IsEnum(PayrollItemTypeEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar' })
	type: PayrollItemTypeEnum;

	@ApiProperty({ enum: PayrollItemCategoryEnum })
	@IsEnum(PayrollItemCategoryEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar' })
	category: PayrollItemCategoryEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	@MultiORMColumn({ nullable: true })
	description?: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Min(0)
	@MultiORMColumn({
		type: 'numeric',
		precision: 14,
		scale: 2,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	amount: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@MultiORMColumn({
		type: 'numeric',
		precision: 14,
		scale: 4,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	quantity?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@MultiORMColumn({
		type: 'numeric',
		precision: 14,
		scale: 2,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	unitPrice?: number;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@MultiORMColumn({ default: true })
	taxable: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Run this line belongs to.
	 */
	@MultiORMManyToOne(() => PayrollRun, (it) => it.items, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	payrollRun?: IPayrollRun;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: PayrollItem) => it.payrollRun)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	payrollRunId: ID;

	/**
	 * Employee the line is paid to. Nullable so a paid run keeps its history if the employee
	 * record is later removed.
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	employee?: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: PayrollItem) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: ID;
}
