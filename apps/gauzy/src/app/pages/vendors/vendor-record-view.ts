import { Injector } from '@angular/core';
import { BaseEntityEnum, IOrganizationVendor } from '@gauzy/contracts';
import { OrganizationVendorsService } from '@gauzy/ui-core/core';
import { IRecordViewRouteData, IRecordViewSection } from '@gauzy/ui-core/shared';

/** A vendor, described for `ngx-record-view` — the vendors grid's columns read vertically. */
export function buildVendorViewSections(): IRecordViewSection[] {
	return [
		{
			fields: [
				{ label: 'ORGANIZATIONS_PAGE.NAME', key: 'name' },
				{ label: 'ORGANIZATIONS_PAGE.PHONE', key: 'phone', type: 'phone' },
				{ label: 'ORGANIZATIONS_PAGE.EMAIL', key: 'email', type: 'email' },
				{ label: 'ORGANIZATIONS_PAGE.WEBSITE', key: 'website', type: 'link' }
			]
		},
		{ fields: [{ label: 'SM_TABLE.TAGS', key: 'tags', type: 'tags', wide: true }] }
	];
}

/** `/pages/organization/vendors/view/:id` — one vendor, full width (what a vendor favorite opens). */
export const VENDOR_RECORD_VIEW: IRecordViewRouteData<IOrganizationVendor> = {
	heading: 'ORGANIZATIONS_PAGE.VENDORS',
	backLink: '/pages/organization/vendors',
	load: async (id: string, injector: Injector) => {
		const { items } = await injector.get(OrganizationVendorsService).getAll({ id } as any, ['tags']);
		return items?.[0] ?? null;
	},
	sections: () => buildVendorViewSections(),
	subtitle: (vendor) => vendor.name,
	favorite: { entity: BaseEntityEnum.OrganizationVendor, name: (vendor) => vendor.name }
};
