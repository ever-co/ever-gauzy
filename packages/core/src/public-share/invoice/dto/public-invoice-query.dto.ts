import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, TransformFnParams } from "class-transformer";
import { IsOptional } from "class-validator";

export class PublicInvoiceQueryDTO {

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Transform(({ value }: TransformFnParams) => (value) ? value.map((element: string) => element.trim()) : {})
    readonly relations: string[] = [];
}