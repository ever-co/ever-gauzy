import { Injector } from '@angular/core';
import { IMerchant, IWarehouse } from '@gauzy/contracts';
import { MerchantService } from '@gauzy/ui-core/core';
import { IRecordViewRouteData, IRecordViewSection } from '@gauzy/ui-core/shared';

/** Relations a merchant's View reads — the same the merchants grid loads. */
export const MERCHANT_VIEW_RELATIONS = ['logo', 'contact', 'tags', 'warehouses'];

/** A merchant, described for `ngx-record-view`. Shared by the merchants drawer and the merchant's page. */
export function buildMerchantViewSections(merchant: IMerchant): IRecordViewSection[] {
	// Same reading as the grid's contact cell (ContactRowComponent): country, city, address.
	const contact = merchant.contact
		? [merchant.contact.country, merchant.contact.city, merchant.contact.address].filter(Boolean).join(', ')
		: null;
	const warehouses = (merchant.warehouses || []).map((warehouse: IWarehouse) => warehouse.name).join(', ');

	return [
		{
			fields: [
				{ label: 'INVENTORY_PAGE.NAME', key: 'name' },
				{ label: 'INVENTORY_PAGE.CODE', key: 'code' },
				{ label: 'INVENTORY_PAGE.CONTACT', value: contact },
				{ label: 'INVENTORY_PAGE.DESCRIPTION', key: 'description', type: 'multiline', wide: true },
				{ label: 'INVENTORY_PAGE.ACTIVE', key: 'active', type: 'boolean' }
			]
		},
		{
			fields: [
				{ label: 'INVENTORY_PAGE.EMAIL', key: 'email', type: 'email' },
				{ label: 'INVENTORY_PAGE.PHONE', key: 'phone', type: 'phone' },
				{ label: 'SM_TABLE.CURRENCY', key: 'currency' }
			]
		},
		{
			fields: [
				{ label: 'INVENTORY_PAGE.TAGS', key: 'tags', type: 'tags', wide: true },
				{ label: 'INVENTORY_PAGE.WAREHOUSES', value: warehouses }
			]
		}
	];
}

/** `/pages/organization/inventory/merchants/view/:id` — one merchant, full width. */
export const MERCHANT_RECORD_VIEW: IRecordViewRouteData<IMerchant> = {
	heading: 'INVENTORY_PAGE.MERCHANTS',
	backLink: '/pages/organization/inventory/merchants',
	load: (id: string, injector: Injector) => injector.get(MerchantService).getById(id, MERCHANT_VIEW_RELATIONS),
	sections: (merchant) => buildMerchantViewSections(merchant),
	subtitle: (merchant) => merchant.name
};
