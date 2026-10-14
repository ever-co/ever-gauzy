import { Injector } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { RequestApprovalService } from '@gauzy/ui-core/core';
import { GoalSettingsService } from '@gauzy/ui-core/core';
import { TIME_FRAME_RECORD_VIEW } from '../goal-settings/goal-settings-record-view';
import { APPROVAL_RECORD_VIEW, buildApprovalViewSections } from './approval-record-view';

const ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const SCOPE = {
	organizationId: 'cccccccc-3333-4333-8333-333333333333',
	tenantId: 'eeeeeeee-5555-4555-8555-555555555555'
};

/**
 * Review on #10606: the approval and time-frame pages translated their status badge once, in the loader,
 * so after a language change the labels switched but the status stayed in the previous language. The
 * loaders now keep the raw status and the badge is built with the sections, which the page rebuilds on
 * every language change.
 */
describe('record pages translate their status badge with the sections', () => {
	let language: 'en' | 'fr';
	let injector: Injector;

	const statusOf = (sections: ReturnType<typeof buildApprovalViewSections>) =>
		sections.flatMap((section) => section.fields).find((field) => field.type === 'badge');

	beforeEach(() => {
		language = 'en';
		const translateService = { instant: (key: string) => `${language}:${key}` };
		const services = new Map<unknown, unknown>([
			[TranslateService, translateService],
			[
				RequestApprovalService,
				{
					getAll: async () => ({
						items: [{ id: ID, name: 'Laptop', status: RequestApprovalStatusTypesEnum.APPROVED }]
					})
				}
			],
			[
				GoalSettingsService,
				{ getAllTimeFrames: async () => ({ items: [{ id: ID, name: 'Q4', status: 'Active' }] }) }
			]
		]);
		injector = { get: (token: unknown) => services.get(token) } as Injector;
	});

	it('approval: the loader keeps the raw status, the badge follows the current language', async () => {
		const record = await APPROVAL_RECORD_VIEW.load(ID, injector, SCOPE);
		expect(record.status).toBe(RequestApprovalStatusTypesEnum.APPROVED);

		expect(statusOf(APPROVAL_RECORD_VIEW.sections(record, injector)).value).toEqual(
			expect.objectContaining({ text: 'en:APPROVAL_REQUEST_PAGE.APPROVED', class: 'success' })
		);
		language = 'fr';
		expect(statusOf(APPROVAL_RECORD_VIEW.sections(record, injector)).value).toEqual(
			expect.objectContaining({ text: 'fr:APPROVAL_REQUEST_PAGE.APPROVED' })
		);
	});

	it('time frame: the loader keeps the raw status, the badge follows the current language', async () => {
		const record = await TIME_FRAME_RECORD_VIEW.load(ID, injector, SCOPE);
		expect(record.status).toBe('Active');

		language = 'fr';
		expect(statusOf(TIME_FRAME_RECORD_VIEW.sections(record, injector)).value).toEqual({
			text: 'fr:PIPELINES_PAGE.ACTIVE',
			class: 'success'
		});
	});

	it('the drawer, whose rows carry the grid badge already, still reads it from the row', () => {
		expect(statusOf(buildApprovalViewSections())).toEqual(
			expect.objectContaining({ key: 'status', type: 'badge' })
		);
	});
});
