
import { IOrganizationVendor } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString } from "class-validator";

export class OrganizationVendorFeatureDTO {

    @ApiProperty({ type: () => Object, readOnly: true })
    @IsOptional()
    @IsObject()
    readonly vendor: IOrganizationVendor;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly vendorId: string;
}