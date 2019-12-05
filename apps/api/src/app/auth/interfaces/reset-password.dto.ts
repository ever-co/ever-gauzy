/*
 * Copyright (c) Akveo 2019. All Rights Reserved.
 * Licensed under the Personal / Commercial License.
 * See LICENSE_SINGLE_APP / LICENSE_MULTI_APP in the project root for license information on type of purchased license.
 */

import { Email } from './email.dto';
import { ApiModelProperty } from '@nestjs/swagger';

export class ResetPassword extends Email {
	@ApiModelProperty()
	password: string;

	@ApiModelProperty()
	confirmPassword: string;

	@ApiModelProperty()
	// special case for compatibility with ngx-admin
	// tslint:disable
	reset_password_token: string;
	// tslint:enable
}
