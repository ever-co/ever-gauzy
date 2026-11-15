import { Module } from '@nestjs/common';
import { EmployeeNotificationModule } from '../../employee-notification/employee-notification.module';
import { TaskDueReminderService } from './task-due-reminder.service';

/**
 * The task due reminder sweep, without what runs it: the queue's worker (`TaskDueReminderMaintenanceModule`) or, for an
 * API without a queue, the in-process sweep (`TaskDueReminderInlineModule`). The reminders are filed through the
 * notification service, so they reach the Inbox and its delivery lanes as every other notification does.
 */
@Module({
	imports: [EmployeeNotificationModule],
	providers: [TaskDueReminderService],
	exports: [TaskDueReminderService]
})
export class TaskDueReminderModule {}
