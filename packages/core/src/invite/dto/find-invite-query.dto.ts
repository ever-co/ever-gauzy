import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, TransformFnParams } from "class-transformer";
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

/**
 * Get public invite request DTO validation
 */
export enum RelationEnum {
    'organization' = 'organization'
}

export class FindInviteQueryDTO {

    @ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	@IsEmail()
	readonly email: string;

    @ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	@IsString()
	readonly token: string;

    @ApiPropertyOptional({ type: () => String, enum: RelationEnum, readOnly: true })
    @IsOptional()
    @Transform(({ value }: TransformFnParams) => (value) ? value.map((element: string) => element.trim()) : {})
    @IsEnum(RelationEnum, { each: true })
    readonly relations: string[];
}