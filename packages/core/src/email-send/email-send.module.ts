import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailSendService } from './email-send.service';
import { EmailTemplate } from './../core/entities/internal';
import { CustomSmtpModule } from './../custom-smtp/custom-smtp.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            EmailTemplate
        ]),
        CustomSmtpModule,
    ],
    providers: [EmailSendService],
    exports: [EmailSendService], // Export the service to be accessible by other modules
})
export class EmailSendModule { }
