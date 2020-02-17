import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as Email from 'email-templates';
import * as Handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';
import { Repository } from 'typeorm';
import { CrudService } from '../core';
import { EmailTemplate } from '../email-template';
import { User } from '../user';
import { Email as IEmail } from './email.entity';

@Injectable()
export class EmailService extends CrudService<IEmail> {
	constructor(
		@InjectRepository(IEmail)
		private readonly emailRepository: Repository<IEmail>,
		@InjectRepository(EmailTemplate)
		private readonly emailTemplateRepository: Repository<EmailTemplate>
	) {
		super(emailRepository);
	}

	email = new Email({
		message: {
			from: 'Gauzy@Ever.co'
		},
		transport: {
			jsonTransport: true
		},
		i18n: {},
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
		},
		render: (view, locals) => {
			return new Promise(async (resolve, reject) => {
				const emailTemplate = await this.emailTemplateRepository.find({
					name: view,
					languageCode: locals.locale || 'en'
				});

				if (!emailTemplate || emailTemplate.length < 1) {
					return resolve('');
				}

				const template = Handlebars.compile(emailTemplate[0].template);
				const html = template(locals);
				resolve(html);
			});
		}
	});

	languageCode: string;

	welcomeUser(user: User) {
		this.languageCode = 'he';

		this.email
			.send({
				template: 'welcome-user',
				message: {
					to: `${user.email}`,
					subject: 'Welcome to Gauzy'
				},
				locals: {
					locale: this.languageCode,
					email: user.email
				}
			})
			.then((res) => {
				this.createEmailRecord(res.originalMessage, this.languageCode);
			})
			.catch(console.error);
	}

	async requestPassword(user: User, url: string) {
		this.languageCode = 'he';

		this.email
			.send({
				template: 'password',
				message: {
					to: `${user.email}`,
					subject: 'Forgotten Password'
				},
				locals: {
					locale: this.languageCode,
					generatedUrl: url
				}
			})
			.then((res) => {
				this.createEmailRecord(res.originalMessage, this.languageCode);
			})
			.catch(console.error);
	}

	createEmailRecord(message, languageCode): Promise<IEmail> {
		console.log(message);

		const email = new IEmail();

		email.name = message.subject;
		email.content = message.html;
		email.languageCode = languageCode;

		return this.emailRepository.save(email);
	}

	// tested e-mail send functionality
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
