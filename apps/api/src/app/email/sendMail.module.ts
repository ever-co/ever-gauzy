import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
require('dotenv').config();

@Module({
	imports: [
		MailerModule.forRootAsync({
			useFactory: () => ({
				transport: {
					host: 'smtp.gmail.com', // set your host and port according to server configuration
					port: 587,
					secure: false, // upgrade later with STARTTLS
					auth: {
						user: process.env.MAIL_ID, // generate new .env file and put mail_id and password
						pass: process.env.MAIL_PASS
					},
					defaults: {
						from: '"nest-modules" <modules@nestjs.com>',
					},
				},
			}),
		}),
	],
	controllers: [],
	providers: [],
	exports: []
})
export class SendMailModule { }
