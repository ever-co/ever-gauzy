import { IEmailTemplate, IEmailUpdateInput, IUser } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateEmailDto implements IEmailUpdateInput {

    @ApiProperty({ type: () => String })
	@IsOptional()
	@IsString()
    name: string;

    @ApiProperty({ type: () => String })
	@IsNotEmpty()
    @IsEmail()
	readonly email: string;

    @ApiProperty({ type: () => String })
	@IsOptional()
	@IsString()
    content?: string;

    @ApiProperty({ type: () => Object })
	@IsOptional()
    emailTemplate?: IEmailTemplate;

    @ApiProperty({ type: () => String })
	@IsOptional()
	@IsString()
    emailTemplateId?: string;

    @ApiProperty({ type: () => Object })
	@IsOptional()
    user?: IUser;

    @ApiProperty({ type: () => String })
	@IsOptional()
	@IsString()
    userId?: string;

    @ApiProperty({ type: () => Boolean })
	@IsOptional()
    isArchived?: boolean;

}