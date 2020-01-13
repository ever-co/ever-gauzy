import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as Email from 'email-templates';
import { User } from '../user';

@Injectable()
export class EmailService {
	async sendEmail(user: User, url: string) {
		const email = new Email({
			message: {
				from: 'Gauzy',
				subject: 'Forgotten Password'
			},
			transport: {
				jsonTransport: true
			},
			views: {
				options: {
					extension: 'hbs'
				}
			},
			preview: {
				open: {
					app: 'firefox',
					wait: false
				}
			}
		});

		email
			.send({
				template:
					'C:/Coding/gauzy/apps/api/src/app/email-templates/views',
				message: {
					to: `${user.email}`
				},
				locals: {
					generatedUrl: url
				}
			})
			.then((res) => {
				console.log(res);
			})
			.catch(console.error);
	}

	async nodemailerSendEmail(user: User, url: string) {
		const testAccount = await nodemailer.createTestAccount();

		const transporter = nodemailer.createTransport({
			host: 'smtp.ethereal.email',
			port: 587,
			secure: false, // true for 465, false for other ports
			auth: {
				user: testAccount.user,
				pass: testAccount.pass
			}
		});

		// Gmail example:

		// const transporter = nodemailer.createTransport({
		// 	service: 'gmail',
		// 	auth: {
		// 		user: 'user@gmail.com',
		// 		pass: 'password'
		// 	}
		// });

		const info = await transporter.sendMail({
			from: 'Gauzy',
			to: user.email,
			subject: 'Forgotten Password',
			text: 'Forgot Password',
			html:
				'Hello! <br><br> We received a password change request.<br><br>If you requested to reset your password<br><br>' +
				'<a href=' +
				url +
				'>Click here</a>'
		});

		console.log('Message sent: %s', info.messageId);
		console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
	}
}
