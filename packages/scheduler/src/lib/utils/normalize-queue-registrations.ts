import { RegisterQueueOptions } from '@nestjs/bullmq';
import { SchedulerQueueRegistration } from '../interfaces/scheduler-feature-options.interface';

const DEFAULT_QUEUE_NAME = 'default';

export function normalizeQueueRegistrations(queueRegistrations: SchedulerQueueRegistration[]): RegisterQueueOptions[] {
	const queueMap = new Map<string, RegisterQueueOptions>();

	for (const registration of queueRegistrations) {
		const option: RegisterQueueOptions =
			typeof registration === 'string' ? { name: registration } : { ...registration };
		const queueName = normalizeQueueName(option.name);
		queueMap.set(queueName, {
			...option,
			name: queueName
		});
	}

	return Array.from(queueMap.values());
}

export function normalizeQueueName(name?: string): string {
	const queueName = name?.trim() ?? DEFAULT_QUEUE_NAME;
	if (!queueName) {
		throw new Error('Queue name cannot be empty.');
	}
	return queueName;
}
