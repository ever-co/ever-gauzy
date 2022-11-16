import { ITag } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional } from "class-validator";

export class RelationalTagDTO {

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    readonly tags: ITag[];
}