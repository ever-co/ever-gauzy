import { IEmailTemplate, IEmailUpdateInput, IUser } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateEmailDTO implements IEmailUpdateInput {

    @ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
    readonly name: string;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsEmail()
	readonly email: string;

    @ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
    readonly content?: string;

    @ApiProperty({ type: () => Object, readOnly: true })
	@IsOptional()
    readonly emailTemplate?: IEmailTemplate;

    @ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
    readonly emailTemplateId?: string;

    @ApiProperty({ type: () => Object, readOnly: true })
	@IsOptional()
    readonly user?: IUser;

    @ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
    readonly userId?: string;

    @ApiProperty({ type: () => Boolean, readOnly: true })
	@IsOptional()
    readonly isArchived?: boolean;
}