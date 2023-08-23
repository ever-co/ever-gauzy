import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailSendService } from './email-send.service';
import { EmailTemplate } from './../core/entities/internal';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            EmailTemplate
        ])
    ],
    providers: [EmailSendService],
    exports: [EmailSendService], // Export the service to be accessible by other modules
})
export class EmailSendModule { }
