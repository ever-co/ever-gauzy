import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateActivepiecesWebhookDto {
    @ApiProperty({ example: 'https://example.com' })
    @IsString()
    @IsNotEmpty()
    targetUrl!: string;

    @ApiProperty({ example: ['employee.created', 'task.updated'] })
    @IsArray()
    @IsNotEmpty()
    events!: string[];

    @ApiProperty({
        example: 'Employee Events Hook',
        required: false
    })
    @IsString()
    @IsOptional()
    name?: string;
}
