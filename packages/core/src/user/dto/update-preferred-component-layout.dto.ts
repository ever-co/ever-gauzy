import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty } from "class-validator";
import { ComponentLayoutStyleEnum, IUserUpdateInput } from "@gauzy/contracts";

export class UpdatePreferredComponentLayoutDTO implements IUserUpdateInput {

	@ApiProperty({ type: () => String, enum: ComponentLayoutStyleEnum })
	@IsNotEmpty()
    @IsEnum(ComponentLayoutStyleEnum)
    readonly preferredComponentLayout: ComponentLayoutStyleEnum;
}