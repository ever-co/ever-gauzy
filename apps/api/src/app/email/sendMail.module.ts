import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';

@Module({  
	imports: [
        MailerModule.forRoot({
			transport: {
			  host: 'smtp.gmail.com',
			  port: 587,
			  secure: false, // upgrade later with STARTTLS
			  auth: {
				user: 'user.900gpt@gmail.com',
                pass: 'Admin@123#'
			  },
			},
			defaults: {
			  from:'"Gauzy" <Gauzy@ever.co>',
			},
			template: {
			  dir: process.cwd() + '/templates/',
			  adapter: new HandlebarsAdapter(), // or new PugAdapter()
			  options: {
				strict: true,
			  },
			},
		  }),
    ],
	controllers: [],
	providers: [],
	exports: []
})
export class SendMailModule {}
