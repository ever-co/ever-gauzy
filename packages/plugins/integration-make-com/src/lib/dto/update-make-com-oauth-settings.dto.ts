import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, ValidateIf } from 'class-validator';

export class UpdateMakeComOAuthSettingsDTO {
    @ApiProperty({
        type: String,
        description: 'Client ID for Make.com OAuth',
        example: 'your-make-client-id'
    })
    @IsString()
    @ValidateIf(o => o.clientSecret !== undefined || o.clientId !== undefined)
    @IsNotEmpty({ message: 'Client ID is required when Client Secret is provided' })
    clientId: string;

    @ApiProperty({
        type: String,
        description: 'Client Secret for Make.com OAuth',
        example: 'your-make-client-secret'
    })
    @IsString()
    @ValidateIf(o => o.clientId !== undefined || o.clientSecret !== undefined)
    @IsNotEmpty({ message: 'Client Secret is required when Client ID is provided' })
    clientSecret: string;
}
