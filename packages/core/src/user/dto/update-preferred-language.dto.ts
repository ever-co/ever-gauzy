import { LanguagesEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsEnum } from "class-validator";

export class UpdatePreferredLanguageDTO {

	@ApiProperty({ type: () => String, enum: LanguagesEnum })
	@IsNotEmpty()
    @IsEnum(LanguagesEnum)
    readonly preferredLanguage: LanguagesEnum;
}