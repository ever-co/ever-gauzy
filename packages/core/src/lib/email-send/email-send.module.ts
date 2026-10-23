import { Module, forwardRef } from '@nestjs/common';
import { EmailSendService } from './email-send.service';
import { CustomSmtpModule } from './../custom-smtp/custom-smtp.module';
import { EmailTemplateModule } from './../email-template/email-template.module';
import { EmailTemplateRenderService } from './email-template-render.service';
import { EmailService } from './email.service';
import { EmailHistoryModule } from './../email-history/email-history.module';
import { OrganizationModule } from './../organization/organization.module';
import { EmailTransportRegistry, getEmailTransportRegistry } from './email-transport.registry';

@Module({
	imports: [
		forwardRef(() => CustomSmtpModule),
		forwardRef(() => EmailTemplateModule),
		forwardRef(() => OrganizationModule),
		forwardRef(() => EmailHistoryModule)
	],
	providers: [
		EmailService,
		EmailSendService,
		EmailTemplateRenderService,
		// One registry per process, whichever module graph (the API, the worker) builds this module.
		{ provide: EmailTransportRegistry, useFactory: getEmailTransportRegistry }
	],
	// `EmailService` for the platform's senders; `EmailSendService` and the transport registry for the plugins that
	// send mail no template renders, or supply a transport (plan 04 §5.5).
	exports: [EmailService, EmailSendService, EmailTransportRegistry]
})
export class EmailSendModule {}
