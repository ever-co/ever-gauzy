import { ICustomSmtp, ICustomSmtpUpdateInput } from '@gauzy/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { CreateCustomSmtpDTO } from './create-custom-smtp.dto';

/**
 * Updates custom SMTP Request DTO validation
 */
export class UpdateCustomSmtpDTO extends CreateCustomSmtpDTO implements ICustomSmtpUpdateInput {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	id: ICustomSmtp['id'];
}
