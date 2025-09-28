import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsDate, IsOptional, IsUUID } from 'class-validator';
import { MultiORMEntity, MultiORMManyToOne, MultiORMColumn, ColumnIndex } from '../core/decorators/entity';
import { CurrenciesEnum, ID, IEmployee, IEmployeeHourlyRate } from '@gauzy/contracts';
import { MikroOrmEmployeeHourlyRateRepository } from './repository/mikro-orm-hourly-rates.repository';
import { Transform, TransformFnParams } from 'class-transformer';
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { BasePerEntityType, Employee } from '../core/entities/internal';

@MultiORMEntity('employee_hourly_rate', { mikroOrmRepository: () => MikroOrmEmployeeHourlyRateRepository })
export class EmployeeHourlyRate extends BasePerEntityType implements IEmployeeHourlyRate {
	[EntityRepositoryType]?: MikroOrmEmployeeHourlyRateRepository;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Transform((params: TransformFnParams) => parseInt(params.value || 0, 10))
	@MultiORMColumn({ nullable: true })
	billRateValue?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Transform((params: TransformFnParams) => parseInt(params.value || 0, 10))
	@MultiORMColumn({ nullable: true })
	minimumBillingRate?: number;

	@ApiPropertyOptional({ type: () => String, enum: CurrenciesEnum, example: CurrenciesEnum.USD })
	@IsOptional()
	@IsEnum(CurrenciesEnum)
	@MultiORMColumn({ nullable: true })
	billRateCurrency?: CurrenciesEnum;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
	lastUpdate?: Date;

	/*
		|--------------------------------------------------------------------------
		| @ManyToOne
		|--------------------------------------------------------------------------
		*/
	/**
	 * Employee
	 */
	@ApiPropertyOptional({ type: () => Employee })
	@IsOptional()
	@MultiORMManyToOne(() => Employee, (it) => it.hourlyRates, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee?: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: EmployeeHourlyRate) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: ID;
}
