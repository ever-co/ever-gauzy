import { IOrganization } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

/**
 * Seeds the commerce defaults a newly created organization needs before it can issue a document: the
 * default channel and region, the seven numbering series, the default tax category, the currency price
 * preference, the measurement families and the search definitions. Idempotent.
 */
export class OrganizationCommerceDefaultsCreateCommand implements ICommand {
	static readonly type = '[Organization] Commerce Defaults Create';

	constructor(public readonly organization: Pick<IOrganization, 'id'>) {}
}
