import { of, throwError } from 'rxjs';
import { IOrganizationDocument, TimeOffRequestFormTypeEnum } from '@gauzy/contracts';
import { downloadFile } from '@gauzy/ui-core/common';
import { TimeOffRequestMutationComponent } from './time-off-request-mutation.component';

jest.mock('@gauzy/ui-core/common', () => ({
	...jest.requireActual('@gauzy/ui-core/common'),
	downloadFile: jest.fn()
}));

/**
 * "Download paid / unpaid request form" in the time-off request dialog (ever-co/ever-gauzy#5481). The dialog took
 * the first organization document for the paid form and the second for the unpaid one, so it opened whatever the
 * list held at those places (or failed on an organization with one document, and did nothing with none). It now
 * finds the form by its name, downloads it, and says so when there is no such form.
 */
describe('TimeOffRequestMutationComponent.getRequestForm', () => {
	const { PAID, UNPAID } = TimeOffRequestFormTypeEnum;
	const TENANT = 'tenant-1';
	const ORGANIZATION = 'org-1';

	const document = (name: string, documentUrl: string) => ({ id: name, name, documentUrl }) as IOrganizationDocument;
	const handbook = document('Employee Handbook', 'https://files.test/handbook.pdf');
	const paid = document('Paid Days off Request', 'https://files.test/paid.pdf');
	const unpaid = document('Unpaid Days off Request', 'https://files.test/unpaid.pdf');

	const download = downloadFile as jest.MockedFunction<typeof downloadFile>;

	/** The real method, run on a stand-in for the dialog. */
	const setup = (items: IOrganizationDocument[] | Error) => {
		const component: any = {
			organization: { id: ORGANIZATION, tenantId: TENANT },
			store: { user: { tenantId: TENANT } },
			documentsService: {
				getAll: jest.fn(() =>
					items instanceof Error ? throwError(() => items) : of({ items, total: items.length })
				)
			},
			toastrService: { warning: jest.fn(), danger: jest.fn() }
		};
		const getRequestForm = (type: TimeOffRequestFormTypeEnum) =>
			TimeOffRequestMutationComponent.prototype.getRequestForm.call(component, type);

		return { component, getRequestForm };
	};

	beforeEach(() => {
		download.mockReset();
		download.mockResolvedValue('downloaded');
	});

	it("reads the selected organization's documents", async () => {
		const { component, getRequestForm } = setup([paid]);

		await getRequestForm(PAID);

		expect(component.documentsService.getAll).toHaveBeenCalledWith({
			tenantId: TENANT,
			organizationId: ORGANIZATION
		});
	});

	it.each([
		['paid form first', [paid, unpaid]],
		['unpaid form first', [unpaid, paid]],
		['another document first', [handbook, unpaid, paid]]
	])('downloads the form of the button pressed, by name, with the %s', async (_, items) => {
		const { component, getRequestForm } = setup(items);

		await getRequestForm(PAID);
		await getRequestForm(UNPAID);

		expect(download.mock.calls).toEqual([
			[paid.documentUrl, paid.name],
			[unpaid.documentUrl, unpaid.name]
		]);
		expect(component.toastrService.warning).not.toHaveBeenCalled();
	});

	it('says no such form is uploaded, and opens no other document, when the organization has none', async () => {
		const { component, getRequestForm } = setup([handbook, unpaid]);

		await getRequestForm(PAID);

		expect(download).not.toHaveBeenCalled();
		expect(component.toastrService.warning).toHaveBeenCalledWith('TIME_OFF_PAGE.REQUEST_FORM_NOT_FOUND', {
			name: 'Paid Days off Request'
		});
	});

	it('says so for an organization without documents too', async () => {
		const { component, getRequestForm } = setup([]);

		await getRequestForm(UNPAID);

		expect(download).not.toHaveBeenCalled();
		expect(component.toastrService.warning).toHaveBeenCalledWith('TIME_OFF_PAGE.REQUEST_FORM_NOT_FOUND', {
			name: 'Unpaid Days off Request'
		});
	});

	it.each([['unavailable'], ['invalid']] as const)(
		'says the form could not be downloaded when its link is %s',
		async (result) => {
			download.mockResolvedValue(result);
			const { component, getRequestForm } = setup([paid]);

			await getRequestForm(PAID);

			expect(component.toastrService.warning).toHaveBeenCalledWith('TIME_OFF_PAGE.REQUEST_FORM_UNAVAILABLE', {
				name: paid.name
			});
		}
	);

	it('says nothing more when the form opened in a new tab', async () => {
		download.mockResolvedValue('opened');
		const { component, getRequestForm } = setup([paid]);

		await getRequestForm(PAID);

		expect(component.toastrService.warning).not.toHaveBeenCalled();
		expect(component.blockedRequestForm).toBeNull();
	});

	it('offers a link to the form when the browser blocked its tab', async () => {
		download.mockResolvedValue('blocked');
		const { component, getRequestForm } = setup([paid]);

		await getRequestForm(PAID);

		expect(component.blockedRequestForm).toEqual({ name: paid.name, url: paid.documentUrl });
		expect(component.toastrService.warning).toHaveBeenCalledWith('TIME_OFF_PAGE.REQUEST_FORM_BLOCKED', {
			name: paid.name
		});
	});

	it('drops that link once another form is asked for', async () => {
		download.mockResolvedValueOnce('blocked').mockResolvedValueOnce('downloaded');
		const { component, getRequestForm } = setup([paid, unpaid]);

		await getRequestForm(PAID);
		await getRequestForm(UNPAID);

		expect(component.blockedRequestForm).toBeNull();
	});

	it('shows the error when the documents cannot be read', async () => {
		const failure = new Error('Network down');
		const { component, getRequestForm } = setup(failure);

		await getRequestForm(PAID);

		expect(component.toastrService.danger).toHaveBeenCalledWith(failure);
		expect(download).not.toHaveBeenCalled();
	});

	it('does nothing before an organization is selected', async () => {
		const { component, getRequestForm } = setup([paid]);
		component.organization = undefined;

		await getRequestForm(PAID);

		expect(component.documentsService.getAll).not.toHaveBeenCalled();
	});
});
