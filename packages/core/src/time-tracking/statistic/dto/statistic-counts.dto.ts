import { IGetCountsStatistics } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

/**
 * Get statistic counts request DTO validation
 */
export class StatisticCountsDTO implements IGetCountsStatistics {
    
    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly organizationId?: string;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsString()
    readonly employeeId?: string;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsString()
    readonly projectId?: string;

    @ApiPropertyOptional({ type: () => Date })
    @IsOptional()
    @IsString()
    readonly startDate?: Date;

    @ApiPropertyOptional({ type: () => Date })
    @IsOptional()
    @IsString()
    readonly endDate?: Date;
}