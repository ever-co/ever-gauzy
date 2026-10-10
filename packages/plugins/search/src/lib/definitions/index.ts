import { ISearchIndexRegistration } from '@gauzy/contracts';
import { PRODUCT_INDEX } from './product.definition';
import { PRODUCT_VARIANT_INDEX } from './product-variant.definition';
import { ORGANIZATION_CONTACT_INDEX } from './organization-contact.definition';
import { INVOICE_INDEX } from './invoice.definition';
import { EXPENSE_INDEX } from './expense.definition';
import { INCOME_INDEX } from './income.definition';
import { PROJECT_INDEX } from './project.definition';
import { TASK_INDEX } from './task.definition';
import { EMPLOYEE_INDEX } from './employee.definition';
import { DOCUMENT_INDEX } from './document.definition';
import { ORDER_INDEX } from './order.definition';

export { PRODUCT_INDEX } from './product.definition';
export { PRODUCT_VARIANT_INDEX } from './product-variant.definition';
export { ORGANIZATION_CONTACT_INDEX } from './organization-contact.definition';
export { INVOICE_INDEX } from './invoice.definition';
export { EXPENSE_INDEX } from './expense.definition';
export { INCOME_INDEX } from './income.definition';
export { PROJECT_INDEX } from './project.definition';
export { TASK_INDEX } from './task.definition';
export { EMPLOYEE_INDEX } from './employee.definition';
export { DOCUMENT_INDEX } from './document.definition';
export { ORDER_INDEX } from './order.definition';

/**
 * Every entity this package makes searchable.
 *
 * This is the declaration half of "which entities are searchable". Nothing else in the package holds a
 * list of entity types: the indexer, the query service, the suggestion provider, the facet builder and
 * the reindex planner all read the registry this array is registered into, so an entity that is
 * searchable is searchable everywhere and an entity that is not is invisible everywhere.
 *
 * The set covers the platform's own records — parties, invoices, expenses, income, projects, tasks,
 * employees and documents — as well as the catalogue and the order, because a search that finds a
 * product but not the invoice for it is a search a user has to leave in order to finish their task.
 */
export const SEARCH_INDEX_DEFINITIONS: ISearchIndexRegistration[] = [
	PRODUCT_INDEX,
	PRODUCT_VARIANT_INDEX,
	ORGANIZATION_CONTACT_INDEX,
	INVOICE_INDEX,
	EXPENSE_INDEX,
	INCOME_INDEX,
	PROJECT_INDEX,
	TASK_INDEX,
	EMPLOYEE_INDEX,
	DOCUMENT_INDEX,
	ORDER_INDEX
];
