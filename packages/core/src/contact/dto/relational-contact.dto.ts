import { IContact } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { Contact } from "./../contact.entity";

export class RelationalContactDTO {

    @ApiPropertyOptional({ type: () => Contact, readOnly: true })
    @IsOptional()
    readonly contact: IContact;
}