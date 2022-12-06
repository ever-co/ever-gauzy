import { IBaseRelationsEntityModel } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, TransformFnParams } from "class-transformer";
import { IsArray, IsOptional } from "class-validator";

/**
 * Get relations request DTO validation
 */
export class RelationsQueryDTO implements IBaseRelationsEntityModel {

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    @Transform(({ value }: TransformFnParams) => (value) ? value.map((element: string) => element.trim()) : [])
    readonly relations: string[] = [];
}