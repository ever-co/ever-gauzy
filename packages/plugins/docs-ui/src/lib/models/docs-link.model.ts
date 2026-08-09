import { BaseEntityEnum, ID } from '@gauzy/contracts';

/**
 * The business records a `DocumentLink` can point at from the Documents UI
 * (`01-ux-spec.md` §8.9 / `02-domain-model.md` `DocumentLink`).
 *
 * `DocumentLink.entity` is polymorphic over the whole `BaseEntityEnum`, so the
 * backend accepts more than this list — this registry is only what the *picker*
 * offers and what the panel can deep-link and icon. An inbound link whose
 * `entity` is not registered still renders (generic icon, no deep link) rather
 * than being hidden: a link the user cannot see is worse than one they cannot
 * click.
 */
export interface IDocsLinkEntityDescriptor {
	entity: BaseEntityEnum;
	/** i18n key under `DOCS.LINKS.ENTITY.*`. */
	labelKey: string;
	/** Eva icon name, shared with the detail-panel link rows. */
	icon: string;
	/** Router path for the record, or `null` when the entity has no detail route. */
	route: (entityId: ID) => string | null;
}

export const DOCS_LINK_ENTITIES: IDocsLinkEntityDescriptor[] = [
	{
		entity: BaseEntityEnum.Task,
		labelKey: 'DOCS.LINKS.ENTITY.TASK',
		icon: 'checkmark-square-outline',
		// 🛑 No per-task detail route exists. `tasks-routing.module.ts` declares only `dashboard`,
		// `team`, `me` and `settings/:id` — there is no `dashboard/:id`, so the previous
		// `/pages/tasks/dashboard/${id}` matched nothing and the row was a dead link. `settings/:id`
		// is not a substitute: it is gated on ALL_ORG_EDIT/ORG_PROJECT_EDIT and bounces a
		// read-only user back to the dashboard. `null` is the contract for "no detail route" —
		// the linked-records row then renders the task as plain text instead. Give this a real
		// route the moment a task detail page exists.
		route: () => null
	},
	{
		entity: BaseEntityEnum.OrganizationProject,
		labelKey: 'DOCS.LINKS.ENTITY.PROJECT',
		icon: 'briefcase-outline',
		route: (id) => `/pages/organization/projects/${id}/edit`
	},
	{
		entity: BaseEntityEnum.OrganizationTeam,
		labelKey: 'DOCS.LINKS.ENTITY.TEAM',
		icon: 'people-outline',
		route: () => '/pages/organization/teams'
	},
	{
		entity: BaseEntityEnum.Employee,
		labelKey: 'DOCS.LINKS.ENTITY.EMPLOYEE',
		icon: 'person-outline',
		route: (id) => `/pages/employees/edit/${id}`
	},
	{
		entity: BaseEntityEnum.OrganizationContact,
		labelKey: 'DOCS.LINKS.ENTITY.CONTACT',
		icon: 'book-open-outline',
		route: () => '/pages/contacts/customers'
	},
	{
		entity: BaseEntityEnum.Invoice,
		labelKey: 'DOCS.LINKS.ENTITY.INVOICE',
		icon: 'file-text-outline',
		route: (id) => `/pages/accounting/invoices/edit/${id}`
	}
];

/** Descriptor lookup; `undefined` for entities outside the picker registry. */
export function findLinkEntityDescriptor(entity: BaseEntityEnum): IDocsLinkEntityDescriptor | undefined {
	return DOCS_LINK_ENTITIES.find((descriptor) => descriptor.entity === entity);
}

/** One pickable record inside the add-link flow (entity-agnostic projection). */
export interface IDocsLinkCandidate {
	id: ID;
	label: string;
}
