import { Module } from '@nestjs/common';
import { EmployeeNotificationModule } from '../../employee-notification/employee-notification.module';
import { TimerReminderService } from './timer-reminder.service';

/**
 * The timer reminder sweep, without what runs it: the queue's worker (`TimerReminderMaintenanceModule`) or, for an
 * API without a queue, the in-process sweep (`TimerReminderInlineModule`). The reminders are filed through the
 * notification service, so they reach the Inbox and its delivery lanes as every other notification does.
 */
@Module({
	imports: [EmployeeNotificationModule],
	providers: [TimerReminderService],
	exports: [TimerReminderService]
})
export class TimerReminderModule {}
