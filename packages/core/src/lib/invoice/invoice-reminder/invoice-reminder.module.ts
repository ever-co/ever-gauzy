import { Module } from '@nestjs/common';
import { EmailSendModule } from '../../email-send/email-send.module';
import { InvoiceModule } from '../invoice.module';
import { InvoiceReminderService } from './invoice-reminder.service';

/**
 * The payment reminder sweep, without what runs it: the queue's worker (`InvoiceReminderMaintenanceModule`) or, for an
 * API without a queue, the in-process sweep (`InvoiceReminderInlineModule`). The reminders are emails to the clients of
 * the organizations that turned them on; the invoice module renders the PDF they carry.
 */
@Module({
	imports: [EmailSendModule, InvoiceModule],
	providers: [InvoiceReminderService],
	exports: [InvoiceReminderService]
})
export class InvoiceReminderModule {}
