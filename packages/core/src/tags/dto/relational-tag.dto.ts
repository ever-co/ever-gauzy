import { ITag } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional } from "class-validator";

export class RelationalTagDTO {
    
    @ApiProperty({ type: () => Object, isArray: true, readOnly: true })
    @IsOptional()
    readonly tags: ITag[];
}