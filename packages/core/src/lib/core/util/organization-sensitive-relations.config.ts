import { PermissionsEnum } from '@gauzy/contracts';
import { SensitiveRelationConfig } from '../decorators/sensitive-relations.decorator';

const sharedOrganizationRelations = {
	payments: PermissionsEnum.ORG_PAYMENT_VIEW,
	invoices: PermissionsEnum.ALL_ORG_VIEW,
	invoiceEstimateHistories: PermissionsEnum.ALL_ORG_VIEW,
	accountingTemplates: PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES,
	employees: {
		_self: PermissionsEnum.ORG_EMPLOYEES_VIEW,
		user: PermissionsEnum.ORG_USERS_VIEW
	},
	featureOrganizations: PermissionsEnum.ALL_ORG_VIEW,
	contact: PermissionsEnum.ORG_CONTACT_VIEW,
	organizationSprints: PermissionsEnum.ORG_SPRINT_VIEW
};

export const ORGANIZATION_SENSITIVE_RELATIONS: SensitiveRelationConfig = {
	...sharedOrganizationRelations,
	organization: {
		_self: null,
		...sharedOrganizationRelations
	}
};
