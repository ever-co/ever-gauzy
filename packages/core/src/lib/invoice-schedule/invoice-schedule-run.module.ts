import { Module } from '@nestjs/common';
import { InvoiceModule } from '../invoice/invoice.module';
import { RoleModule } from '../role/role.module';
import { TimeLogModule } from '../time-tracking/time-log/time-log.module';
import { UserModule } from '../user/user.module';
import { InvoiceScheduleRunService } from './invoice-schedule-run.service';

/**
 * The sweep of the billing schedules, without what runs it: the queue's worker (`InvoiceScheduleMaintenanceModule`) or,
 * for an API without a queue, the in-process sweep (`InvoiceScheduleInlineModule`). A run reads the time as the
 * schedule's author (the user and role services rebuild their access), then saves and sends the invoice through the
 * invoice module.
 */
@Module({
	imports: [InvoiceModule, RoleModule, TimeLogModule, UserModule],
	providers: [InvoiceScheduleRunService],
	exports: [InvoiceScheduleRunService]
})
export class InvoiceScheduleRunModule {}
