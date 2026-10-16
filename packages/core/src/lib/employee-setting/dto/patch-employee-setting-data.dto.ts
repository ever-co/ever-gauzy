import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsDefined,
	IsEnum,
	IsNotEmpty,
	IsString,
	ValidateIf,
	ValidateNested
} from 'class-validator';
import {
	EmployeeSettingDataOperationEnum,
	IEmployeeSettingDataOperation,
	IEmployeeSettingDataPatchInput
} from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import {
	MAX_EMPLOYEE_SETTING_DATA_OPERATIONS,
	MAX_EMPLOYEE_SETTING_DATA_PATH_DEPTH
} from '../employee-setting-data.utils';

/**
 * One change to an employee setting's `data`.
 */
export class EmployeeSettingDataOperationDTO implements IEmployeeSettingDataOperation {
	@ApiProperty({ enum: EmployeeSettingDataOperationEnum })
	@IsEnum(EmployeeSettingDataOperationEnum)
	readonly op: EmployeeSettingDataOperationEnum;

	@ApiProperty({ type: () => [String], example: ['sidebar_preferences', 'views', 'is_pinned'] })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(MAX_EMPLOYEE_SETTING_DATA_PATH_DEPTH)
	@IsString({ each: true })
	@IsNotEmpty({ each: true })
	readonly path: string[];

	@ApiPropertyOptional({ description: 'The value a set operation writes (any JSON value).' })
	@ValidateIf((operation: EmployeeSettingDataOperationDTO) => operation.op === EmployeeSettingDataOperationEnum.SET)
	@IsDefined()
	readonly value?: unknown;
}

/**
 * Patch Employee Setting Data DTO request validation
 */
export class PatchEmployeeSettingDataDTO extends TenantOrganizationBaseDTO implements IEmployeeSettingDataPatchInput {
	@ApiProperty({ type: () => [EmployeeSettingDataOperationDTO] })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(MAX_EMPLOYEE_SETTING_DATA_OPERATIONS)
	@ValidateNested({ each: true })
	@Type(() => EmployeeSettingDataOperationDTO)
	readonly operations: EmployeeSettingDataOperationDTO[];
}
