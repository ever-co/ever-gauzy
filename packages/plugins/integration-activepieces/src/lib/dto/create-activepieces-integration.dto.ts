import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ActivepiecesGrantType } from '../activepieces.type';

export class CreateActivepiecesIntegrationDto {
    @ApiProperty({
        description: 'The client ID of the ActivePieces integration',
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    client_id!: string;

    @ApiProperty({
        description: 'The client secret of the ActivePieces integration',
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    client_secret!: string;

    @ApiProperty({
        description: 'The authorization code received from ActivePieces',
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    cod!: string;

    @ApiProperty({
        description: 'The grant type for the ActivePieces integration',
        type: () => String
    })
    @IsString()
    @IsIn(['authorization_code', 'refresh_token'])
    @IsOptional()
    grant_type?: ActivepiecesGrantType;
}
