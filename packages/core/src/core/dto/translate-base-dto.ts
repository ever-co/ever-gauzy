import { LanguagesEnum, TranslatePropertyInput } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { TenantOrganizationBaseDTO } from './tenant-organization-base.dto';

export abstract class TranslationBaseDTO extends TenantOrganizationBaseDTO {
	
	@ApiProperty({ type: () => String })
    @IsNotEmpty()
	@IsString()
    readonly name: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    readonly description: string;

    @ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly languageCode: string;
}

export abstract class TranslatableBaseDTO<T> extends TenantOrganizationBaseDTO {

	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@ValidateNested({ each: true })
	@Type(() => TranslationBaseDTO)
	readonly translations: T;
	
	@ApiPropertyOptional({ type: () => Function })
	@IsOptional()
	readonly translate: (language: LanguagesEnum) => string;

	@ApiPropertyOptional({ type: () => Function })
	@IsOptional()
	readonly translateNested: (language: LanguagesEnum, pros: TranslatePropertyInput[]) => any;
}