import { When } from '../../support/bdd';
import * as createButton from '../../support/pages/CreateButton.po';
import { CreateButtonData } from '../../../src/support/Base/pagedata/CreateButtonPageData';

// The "+ Create" header button no longer opens an nb-menu of in-page "Add X" cards; it now opens
// the Quick Actions dialog (ngx-quick-actions) — a grouped nb-menu of navigation links. The legacy
// per-option flow (click option -> verify card header -> close/cancel) is gone, so this spec now
// verifies the Quick Actions dialog itself: it opens, shows its groups, and lists each quick action.
// "Contact" is dropped (there is no Create Contact action — only Create Lead/Customer/Client).

When('I open the Quick Actions dialog', async () => {
	await createButton.createButtonVisible();
	await createButton.clickCreateButton();
	await createButton.verifyQuickActionsDialog(CreateButtonData.quickActionsTitle);
});

When('I see the quick action group headers', async () => {
	await createButton.verifyGroupHeaderExist(CreateButtonData.accountingGroup);
	await createButton.verifyGroupHeaderExist(CreateButtonData.projectManagementGroup);
	await createButton.verifyGroupHeaderExist(CreateButtonData.organizationGroup);
	await createButton.verifyGroupHeaderExist(CreateButtonData.timeTrackingGroup);
	await createButton.verifyGroupHeaderExist(CreateButtonData.contactsGroup);
	await createButton.verifyGroupHeaderExist(CreateButtonData.jobsGroup);
});

When('I see each quick action option', async () => {
	await createButton.verifyOptionExist(CreateButtonData.income);
	await createButton.verifyOptionExist(CreateButtonData.expense);
	await createButton.verifyOptionExist(CreateButtonData.invoice);
	await createButton.verifyOptionExist(CreateButtonData.estimate);
	await createButton.verifyOptionExist(CreateButtonData.payment);
	await createButton.verifyOptionExist(CreateButtonData.timeLog);
	await createButton.verifyOptionExist(CreateButtonData.candidate);
	await createButton.verifyOptionExist(CreateButtonData.proposal);
	await createButton.verifyOptionExist(CreateButtonData.contract);
	await createButton.verifyOptionExist(CreateButtonData.team);
	await createButton.verifyOptionExist(CreateButtonData.task);
	await createButton.verifyOptionExist(CreateButtonData.project);
	await createButton.verifyOptionExist(CreateButtonData.employee);
	await createButton.verifyOptionExist(CreateButtonData.lead);
	await createButton.verifyOptionExist(CreateButtonData.customer);
	await createButton.verifyOptionExist(CreateButtonData.client);
});

When('I close the Quick Actions dialog', async () => {
	await createButton.closeButtonVisible();
	await createButton.clickCloseButton();
	await createButton.createButtonVisible();
});
