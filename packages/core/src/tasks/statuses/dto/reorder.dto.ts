import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNotEmpty, IsNumber, IsUUID, ValidateNested } from 'class-validator';
import { IReorderDTO, IReorderRequestDTO } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';

/**
 * DTO for individual reorder request item.
 */
export class ReorderDTO implements IReorderDTO {
    @ApiProperty({ type: String, description: 'UUID of the record to reorder' })
    @IsNotEmpty() // It should have a value
    @IsUUID() // Must be a UUID
    readonly id: string;

    @ApiProperty({ type: Number, description: 'New order for the record' })
    @IsNotEmpty() // It should have a value
    @IsNumber() // Must be a number
    readonly order: number;
}

/**
 * DTO for the entire reorder request containing multiple items.
 */
export class ReorderRequestDTO extends TenantOrganizationBaseDTO implements IReorderRequestDTO {

    @ApiProperty({ type: () => [ReorderDTO], description: 'List of reordering instructions' })
    @IsArray() // Should be an array
    @ArrayMinSize(1) // Requires at least one item in the array
    @ValidateNested({ each: true }) // Validate each item in the array
    @Type(() => ReorderDTO) // Transform to ReorderDTO
    reorder: ReorderDTO[];
}
