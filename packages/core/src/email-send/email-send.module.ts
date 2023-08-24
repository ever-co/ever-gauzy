import { Module, forwardRef } from '@nestjs/common';
import { EmailSendService } from './email-send.service';
import { CustomSmtpModule } from './../custom-smtp/custom-smtp.module';
import { EmailTemplateModule } from './../email-template/email-template.module';
import { EmailTemplateRenderService } from './email-template-render.service';
import { EmailService } from './email.service';
import { EmailModule } from './../email/email.module';
import { OrganizationModule } from './../organization/organization.module';

@Module({
    imports: [
        forwardRef(() => CustomSmtpModule),
        forwardRef(() => EmailTemplateModule),
        forwardRef(() => OrganizationModule),
        forwardRef(() => EmailModule),
    ],
    providers: [EmailService, EmailSendService, EmailTemplateRenderService],
    exports: [EmailService], // Export the service to be accessible by other modules
})
export class EmailSendModule { }
