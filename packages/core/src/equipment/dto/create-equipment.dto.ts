import { IEquipment, IEquipmentSharing, IImageAsset, IOrganization, ITag, ITenant } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateEquipmentDTO implements IEquipment {

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

    @ApiProperty({ type: () => String })
	@IsOptional()
	@IsString()
    readonly currency: string;

    @ApiProperty({ type: () => Number })
	@IsOptional()
	@IsNumber()
    readonly maxSharePeriod: number;

    @ApiProperty({ type: () => Boolean })
	@IsOptional()
    readonly autoApproveShare: boolean;

    @ApiProperty({ type: () => Object })
	@IsOptional()
    readonly equipmentSharings: IEquipmentSharing[];

    @ApiProperty({ type: () => Object })
	@IsOptional()
    readonly tags: ITag[];

    @ApiProperty({ type: () => String })
	@IsOptional()
	@IsString()
    readonly organizationId?: string;

    @ApiProperty({ type: () => Object })
	@IsOptional()
    readonly organization?: IOrganization;

    @ApiProperty({ type: () => String })
	@IsOptional()
	@IsString()
    readonly tenantId?: string;

    @ApiProperty({ type: () => Object })
	@IsOptional()
    readonly tenant?: ITenant;

    @ApiProperty({ type: () => String })
	@IsOptional()
	@IsString()
    readonly id?: string;

    @ApiProperty({ type: () => Date })
	@IsOptional()
	@IsDate()
    readonly createdAt?: Date;

    @ApiProperty({ type: () => Date })
	@IsOptional()
	@IsDate()
    readonly updatedAt?: Date;

}