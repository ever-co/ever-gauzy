import { isNotificationFanOutEnabled } from './fan-out-enabled';
import { actorDisplayName, followedTaskFieldsChanged } from './follower-fan-out.service';

describe('isNotificationFanOutEnabled', () => {
	it('is off unless exactly "true", warning once for anything else', () => {
		const warn = jest.fn();
		expect(isNotificationFanOutEnabled({}, warn)).toBe(false);
		expect(isNotificationFanOutEnabled({ GAUZY_NOTIFICATION_FANOUT_ENABLED: 'false' }, warn)).toBe(false);
		expect(isNotificationFanOutEnabled({ GAUZY_NOTIFICATION_FANOUT_ENABLED: 'true' }, warn)).toBe(true);
		expect(warn).not.toHaveBeenCalled();
		expect(isNotificationFanOutEnabled({ GAUZY_NOTIFICATION_FANOUT_ENABLED: 'yes' }, warn)).toBe(false);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).not.toContain('yes');
	});
});

describe('followedTaskFieldsChanged', () => {
	it('names the followed fields an update stated, and nothing for an update without them', () => {
		expect(followedTaskFieldsChanged({ status: 'completed' } as never)).toEqual(['status']);
		expect(followedTaskFieldsChanged({ taskStatusId: 's1', title: 'x' } as never)).toEqual(['taskStatusId']);
		expect(followedTaskFieldsChanged({ title: 'renamed' } as never)).toEqual([]);
		expect(followedTaskFieldsChanged(undefined)).toEqual([]);
	});
});

describe('actorDisplayName', () => {
	it('prefers the full name, then the name, then the email', () => {
		expect(actorDisplayName({ firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace');
		expect(actorDisplayName({ firstName: ' ', name: 'ada' })).toBe('ada');
		expect(actorDisplayName({ email: 'ada@example.com' })).toBe('ada@example.com');
		expect(actorDisplayName(null)).toBe('Someone');
	});
});
