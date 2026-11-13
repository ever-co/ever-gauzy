import { EmployeeNotificationTypeEnum } from '@gauzy/contracts';
import { EmployeeNotificationTypeTransformer } from './employee-notification-type-transform';

/**
 * The type of a notification is stored as an integer. The integers are the column's own: an existing one never moves
 * (every row written with it would change kind), and a new kind takes the next one.
 */
describe('EmployeeNotificationTypeTransformer', () => {
	const transformer = new EmployeeNotificationTypeTransformer();

	it('stores each kind as its own integer, the timer reminder as 9', () => {
		expect(Object.values(EmployeeNotificationTypeEnum).map((type) => [type, transformer.to(type)])).toEqual([
			[EmployeeNotificationTypeEnum.PAYMENT, 0],
			[EmployeeNotificationTypeEnum.ASSIGNMENT, 1],
			[EmployeeNotificationTypeEnum.INVITATION, 2],
			[EmployeeNotificationTypeEnum.MENTION, 3],
			[EmployeeNotificationTypeEnum.COMMENT, 4],
			[EmployeeNotificationTypeEnum.MESSAGE, 5],
			[EmployeeNotificationTypeEnum.BROADCAST, 6],
			[EmployeeNotificationTypeEnum.RATE_CHANGE_REQUEST, 7],
			[EmployeeNotificationTypeEnum.TASK_UPDATE, 8],
			[EmployeeNotificationTypeEnum.TIMER_REMINDER, 9]
		]);
	});

	it('reads every stored integer back as its kind, and refuses one it does not know', () => {
		for (const type of Object.values(EmployeeNotificationTypeEnum)) {
			expect(transformer.from(transformer.to(type))).toBe(type);
		}
		expect(() => transformer.from(10)).toThrow('Unknown notification type value: 10');
		expect(() => transformer.to('NotAType' as EmployeeNotificationTypeEnum)).toThrow(
			'Unsupported notification type'
		);
	});
});
