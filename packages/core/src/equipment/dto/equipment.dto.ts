import { CurrenciesEnum, IEquipmentSharing, IImageAsset, ITag } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export abstract class EquipmentDTO {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly name: string;

    @ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	readonly currency: CurrenciesEnum;

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

    @ApiProperty({ type: () => Object })
    @IsOptional()
    readonly tags: ITag[];
}