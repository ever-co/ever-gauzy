// /*
//  * Copyright (c) Akveo 2019. All Rights Reserved.
//  * Licensed under the Personal / Commercial License.
//  * See LICENSE_SINGLE_APP / LICENSE_MULTI_APP in the project root for license information on type of purchased license.
//  */

// import { Injectable, Logger } from '@nestjs/common';

// @Injectable()
// export class EmailService {
//   constructor(private readonly logger: Logger) {}

//   public async sendEmail(email: string, text: string): Promise<boolean> {
//     this.logger.log(`email to be sent to: ${email}. Text: ${text}`);
//     return Promise.resolve(true);
//   }

//   public async sendResetPasswordEmail(email, name, token): Promise<boolean> {
//     const text = `Hello ${name},`
//       + '\nWe have received password reset request. '
//       + `To do this, please proceed at ${process.env.API_BASE_URL}/#/auth/reset-password?reset_password_token=${token}`
//       + '\nIf it wasn\'t you, take no action or contact support.'
//       + '\n\nThank you,'
//       + '\nSupport team.';
//     return this.sendEmail(email, text);
//   }
// }
