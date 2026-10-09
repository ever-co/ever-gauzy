import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsDateString,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	MaxLength
} from 'class-validator';
import { ID, IPayrollItem, IPayrollRun, IUser, PayrollFrequencyEnum, PayrollRunStatusEnum } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany
} from './../core/decorators/entity';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { PayrollItem } from './../payroll-item/payroll-item.entity';
import { MikroOrmPayrollRunRepository } from './repository/mikro-orm-payroll-run.repository';

/**
 * One payroll run — a single pay period for an organization (issue #2453).
 *
 * The three totals are derived from the run's items and are recomputed by the server when the run
 * is processed. They are stored rather than computed on read so a paid run keeps the numbers it
 * was actually paid with, even if an item is later corrected.
 */
@MultiORMEntity('payroll_run', { mikroOrmRepository: () => MikroOrmPayrollRunRepository })
export class PayrollRun extends TenantOrganizationBaseEntity implements IPayrollRun {
	@ApiProperty({ type: () => Date })
	@IsNotEmpty()
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ type: 'date' })
	periodStart: Date;

	@ApiProperty({ type: () => Date })
	@IsNotEmpty()
	@IsDateString()
	@MultiORMColumn({ type: 'date' })
	periodEnd: Date;

	@ApiProperty({ type: () => Date })
	@IsNotEmpty()
	@IsDateString()
	@MultiORMColumn({ type: 'date' })
	payDate: Date;

	@ApiProperty({ enum: PayrollFrequencyEnum })
	@IsEnum(PayrollFrequencyEnum)
	@MultiORMColumn({ type: 'varchar' })
	frequency: PayrollFrequencyEnum;

	@ApiProperty({ enum: PayrollRunStatusEnum })
	@IsEnum(PayrollRunStatusEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', default: PayrollRunStatusEnum.DRAFT })
	status: PayrollRunStatusEnum;

	/** ISO 4217 currency code. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ length: 3 })
	currency: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 14,
		scale: 2,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	totalGross: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 14,
		scale: 2,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	totalDeductions: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 14,
		scale: 2,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	totalNet: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	@MultiORMColumn({ nullable: true })
	notes?: string;

	/** When the run was approved. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	approvedAt?: Date;

	/** When the run was marked paid. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	paidAt?: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Who approved the run. Payroll is money leaving the company, so the sign-off is recorded
	 * separately from the base entity's generic `updatedByUserId`.
	 */
	@MultiORMManyToOne(() => User, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	approvedBy?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: PayrollRun) => it.approvedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	approvedByUserId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Earnings and deductions that make up this run.
	 */
	@MultiORMOneToMany(() => PayrollItem, (it) => it.payrollRun, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	items?: IPayrollItem[];
}
