import { ApiModelProperty } from '@nestjs/swagger';
import EmailAddress from './email-address';

export default class ResetPasswordParameters extends EmailAddress {
	@ApiModelProperty()
	newPassword: string;

	@ApiModelProperty()
	confirmedPassword: string;

	@ApiModelProperty()
	ResetPasswordToken: string;
}
