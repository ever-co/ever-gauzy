import { ICommand } from '@nestjs/cqrs';
import { IOrganizationContactCreateInput } from '@gauzy/contracts';

export interface IOrganizationContactCreateOptions {
	/**
	 * The create may only add a new contact: it may not name an existing contact, reuse existing contact details,
	 * or re-point rows that already exist (projects that have a contact, invoices, payments, expenses, incomes,
	 * time logs). Set for a caller who may create contacts but not edit them. Omitted, the create runs as it
	 * always has.
	 */
	createOnly?: boolean;
}

export class OrganizationContactCreateCommand implements ICommand {
	static readonly type = '[Organization Contact] Create';

	constructor(
		public readonly input: IOrganizationContactCreateInput,
		public readonly options: IOrganizationContactCreateOptions = {}
	) {}
}
