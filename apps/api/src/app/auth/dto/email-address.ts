import { ApiModelProperty } from '@nestjs/swagger';

export default class EmailAddress {
	@ApiModelProperty()
	email: string;
}
