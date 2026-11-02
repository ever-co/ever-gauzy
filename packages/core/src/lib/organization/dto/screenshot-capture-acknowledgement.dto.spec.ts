/**
 * 🛑 This import must stay FIRST: the organization DTOs pick from the entity, which reaches the decorator graph.
 */
import '../../core/entities/internal';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CurrenciesEnum } from '@gauzy/contracts';
import { CreateOrganizationDTO } from './create-organization.dto';
import { ScreenshotCaptureAcknowledgementDTO } from './screenshot-capture-acknowledgement.dto';

/**
 * Issue #9872 — a partial acknowledgement passes validation, so the rule refuses it with
 * `SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_REQUIRED` and the statements still missing. A statement that is sent must
 * still be a boolean.
 */
describe('ScreenshotCaptureAcknowledgementDTO', () => {
	const errorsOf = async (plain: Record<string, unknown>) =>
		validate(plainToInstance(ScreenshotCaptureAcknowledgementDTO, plain));

	it('accepts a partial acknowledgement, for the rule to report what is missing', async () => {
		expect(await errorsOf({ lawfulBasis: true })).toEqual([]);
		expect(await errorsOf({})).toEqual([]);
	});

	it('accepts all three statements', async () => {
		expect(await errorsOf({ lawfulBasis: true, employeeNotice: true, worksCouncil: false })).toEqual([]);
	});

	it('refuses a statement that is not a boolean', async () => {
		const errors = await errorsOf({ lawfulBasis: 'yes', employeeNotice: true });

		expect(errors.map((error) => error.property)).toEqual(['lawfulBasis']);
	});

	it('validates the acknowledgement nested in an organization write', async () => {
		const organization = (screenshotCaptureAcknowledgement: Record<string, unknown>) =>
			validate(
				plainToInstance(CreateOrganizationDTO, {
					name: 'Acme GmbH',
					currency: CurrenciesEnum.EUR,
					allowScreenshotCapture: true,
					screenshotCaptureAcknowledgement
				})
			);

		expect(await organization({ lawfulBasis: true })).toEqual([]);
		expect((await organization({ worksCouncil: 1 })).map((error) => error.property)).toEqual([
			'screenshotCaptureAcknowledgement'
		]);
	});
});
