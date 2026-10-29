import 'reflect-metadata';
import {
	getExportRedactedProperties,
	OPAQUE_EXPORT_MASK,
	redactForExport
} from '../export-import/export-redact.decorator';
import { isExportSkipped } from '../export-import/skip-export.decorator';
import { AccountDeletionRequest } from './account-deletion-request.entity';

/**
 * The export-redaction guard (`export-redact.entities.spec.ts`) flagged `emailHash` and `requestIpHash`: both are
 * unsalted SHA-256 digests, so a candidate address (or any IPv4) can be confirmed against them.
 */
describe('AccountDeletionRequest export marks', () => {
	it('is never exported', () => {
		expect(isExportSkipped(AccountDeletionRequest)).toBe(true);
	});

	it('marks every value that identifies the requester or the link', () => {
		const marks = getExportRedactedProperties(AccountDeletionRequest);

		expect([...marks.keys()].sort()).toEqual(['email', 'emailHash', 'requestIpHash', 'tokenHash']);
		// NOT NULL, so a fixed mask rather than an empty cell that would refuse the row on import.
		expect(marks.get('emailHash')).toEqual({ opaque: true });
		expect(marks.get('requestIpHash')).toEqual({ blank: true });
	});

	it('writes no digest into an archive row', () => {
		const emailHash = 'a'.repeat(64);
		const requestIpHash = 'b'.repeat(64);
		const row = Object.assign(new AccountDeletionRequest(), {
			email: 'someone@example.com',
			emailHash,
			tokenHash: 'c'.repeat(64),
			requestIpHash,
			userAgent: 'Mozilla/5.0',
			locale: 'en'
		});

		const redacted = redactForExport(AccountDeletionRequest, row);

		expect(redacted.emailHash).toBe(OPAQUE_EXPORT_MASK);
		expect(redacted.requestIpHash).toBe('');
		expect(JSON.stringify(redacted)).not.toContain('aaaa');
		expect(JSON.stringify(redacted)).not.toContain('bbbb');
		expect(redacted.locale).toBe('en');
	});
});
