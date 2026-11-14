import { inboxEmailsNotifications } from './inbox-notification-emails';

describe('inboxEmailsNotifications', () => {
	it('is true only when the Inbox and its notification emails are both exactly "true"', () => {
		expect(
			inboxEmailsNotifications({ GAUZY_INBOX_ENABLED: 'true', GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED: 'true' })
		).toBe(true);
	});

	it.each([
		[{}],
		[{ GAUZY_INBOX_ENABLED: 'true' }],
		[{ GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED: 'true' }],
		[{ GAUZY_INBOX_ENABLED: 'false', GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED: 'true' }],
		// The plugin reads any other spelling as off, and so does this
		[{ GAUZY_INBOX_ENABLED: 'TRUE', GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED: '1' }]
	])('is false for %j', (env) => {
		expect(inboxEmailsNotifications(env)).toBe(false);
	});
});
