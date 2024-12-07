import { IContact } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString } from "class-validator";

export class RelationalContactDTO {

    @ApiPropertyOptional({ type: () => Object, readOnly: true })
    @IsOptional()
    @IsObject()
    readonly contact: IContact;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly contactId: IContact['id'];
}