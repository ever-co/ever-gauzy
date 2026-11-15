import { Module } from '@nestjs/common';
import { EmployeeNotificationModule } from '../../employee-notification/employee-notification.module';
import { MeetingReminderService } from './meeting-reminder.service';

/**
 * The meeting reminder sweep, without what runs it: the queue's worker (`MeetingReminderMaintenanceModule`) or, for an
 * API without a queue, the in-process sweep (`MeetingReminderInlineModule`). The reminders are filed through the
 * notification service, so they reach the Inbox and its delivery lanes as every other notification does.
 */
@Module({
	imports: [EmployeeNotificationModule],
	providers: [MeetingReminderService],
	exports: [MeetingReminderService]
})
export class MeetingReminderModule {}
