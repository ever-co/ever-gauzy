import { Module } from '@nestjs/common';
import { EmailSendService } from './email-send.service';
import { CustomSmtpModule } from './../custom-smtp/custom-smtp.module';
import { EmailTemplateModule } from './../email-template/email-template.module';
import { EmailTemplateRenderService } from './email-template-render.service';

@Module({
    imports: [
        CustomSmtpModule,
        EmailTemplateModule
    ],
    providers: [EmailSendService, EmailTemplateRenderService],
    exports: [EmailSendService], // Export the service to be accessible by other modules
})
export class EmailSendModule { }
