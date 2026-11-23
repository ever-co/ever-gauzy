import { suggestEmailCorrection, webInboxUrl } from './email-hints';

describe('suggestEmailCorrection', () => {
	it.each([
		['jane@gmial.com', 'jane@gmail.com'],
		['jane@gmail.con', 'jane@gmail.com'],
		['jane@yaho.com', 'jane@yahoo.com'],
		['jane@hotmial.com', 'jane@hotmail.com'],
		['jane@outlok.com', 'jane@outlook.com'],
		['jane@icloud.co', 'jane@icloud.com']
	])('corrects %s to %s', (typed, expected) => {
		expect(suggestEmailCorrection(typed)).toBe(expected);
	});

	it.each(['jane@gmail.com', 'jane@ymail.com', 'jane@me.com', 'jane@mail.com'])(
		'leaves the known domain in %s alone',
		(email) => {
			expect(suggestEmailCorrection(email)).toBeNull();
		}
	);

	it.each(['jane@acme.com', 'jane@ever.co', 'jane@life.com', 'jane@company.io'])(
		'does not "correct" the company domain in %s',
		(email) => {
			expect(suggestEmailCorrection(email)).toBeNull();
		}
	);

	it.each(['', 'jane', 'jane@', '@gmail.com', 'jane@gmai', null, undefined])(
		'says nothing for the incomplete address %p',
		(email) => {
			expect(suggestEmailCorrection(email)).toBeNull();
		}
	);
});

describe('webInboxUrl', () => {
	it('links a known provider, whatever the case of the domain', () => {
		expect(webInboxUrl('Jane@Gmail.com')).toBe('https://mail.google.com/mail/u/0/#inbox');
	});

	it('has no link for any other domain', () => {
		expect(webInboxUrl('jane@acme.com')).toBeNull();
		expect(webInboxUrl('not-an-email')).toBeNull();
	});
});
