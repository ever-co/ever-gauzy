import { IEquipmentSharing, IImageAsset } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class EquipmentDTO extends TenantOrganizationBaseDTO {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly name: string;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsString()
    readonly type: string;

    @ApiProperty({ type: () => Object })
    @IsOptional()
    readonly image: IImageAsset;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsString()
    readonly serialNumber?: string;

    @ApiProperty({ type: () => Number })
    @IsOptional()
    @IsNumber()
    readonly manufacturedYear: number;

    @ApiProperty({ type: () => Number })
    @IsOptional()
    @IsNumber()
    readonly initialCost: number;

    @ApiProperty({ type: () => Number })
    @IsOptional()
    @IsNumber()
    readonly maxSharePeriod: number;

    @ApiProperty({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    readonly autoApproveShare: boolean;

    @ApiProperty({ type: () => Object })
    @IsOptional()
    readonly equipmentSharings: IEquipmentSharing[];
}