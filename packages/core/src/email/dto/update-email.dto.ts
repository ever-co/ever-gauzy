import { IEmailTemplate, IEmailUpdateInput, IUser } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateEmailDto implements IEmailUpdateInput {

    @ApiProperty({ type: () => String })
	@IsOptional()
	@IsString()
    readonly name: string;

    @ApiProperty({ type: () => String })
	@IsNotEmpty()
    @IsEmail()
	readonly email: string;

    @ApiProperty({ type: () => String })
	@IsOptional()
	@IsString()
    readonly content?: string;

    @ApiProperty({ type: () => Object })
	@IsOptional()
    readonly emailTemplate?: IEmailTemplate;

    @ApiProperty({ type: () => String })
	@IsOptional()
	@IsString()
    readonly emailTemplateId?: string;

    @ApiProperty({ type: () => Object })
	@IsOptional()
    readonly user?: IUser;

    @ApiProperty({ type: () => String })
	@IsOptional()
	@IsString()
    readonly userId?: string;

    @ApiProperty({ type: () => Boolean })
	@IsOptional()
    readonly isArchived?: boolean;

}