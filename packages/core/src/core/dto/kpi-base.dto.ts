import { IGoalKPITemplate } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString } from "class-validator";

export class KpiBaseDTO {
    @ApiProperty({ type: () => Object })
    @IsOptional()
    @IsObject()
    readonly kpi: IGoalKPITemplate;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsString()
    readonly kpiId: string;
}