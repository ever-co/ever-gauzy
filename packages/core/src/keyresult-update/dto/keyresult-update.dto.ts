import { IKeyResult } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { TenantOrganizationBaseDTO } from '../../core/dto';

export class KeyresultUpdateDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	@IsString()
	readonly owner: string;

	@ApiProperty({ type: () => Number, readOnly: true })
	@IsNotEmpty()
	@IsNumber()
	readonly progress: number;

	@ApiProperty({ type: () => Number, readOnly: true })
	@IsNotEmpty()
	@IsNumber()
	readonly update: number;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	@IsString()
	readonly status: string;

	@ApiPropertyOptional({ type: () => String, readOnly: true })
	@IsOptional()
	readonly keyResultId: string;

	@ApiProperty({ type: () => Object, readOnly: true })
	@IsOptional()
	@IsObject()
	readonly keyResult: IKeyResult;
}
