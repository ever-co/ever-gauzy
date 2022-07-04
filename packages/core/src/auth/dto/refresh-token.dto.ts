import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class RefreshTokenDto {

    @ApiProperty({ type: String })
    @IsNotEmpty()
    @IsString()
    refresh_token: string
}