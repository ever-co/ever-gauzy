import { Injector } from '@angular/core';
import { BaseEntityEnum, IEquipment } from '@gauzy/contracts';
import { EquipmentService } from '@gauzy/ui-core/core';
import { IRecordViewRouteData, IRecordViewScope, IRecordViewSection } from '@gauzy/ui-core/shared';

/** The equipment list: where the equipment page's back button leads, and where a deleted piece's page goes. */
export const EQUIPMENT_LIST_LINK = '/pages/organization/equipment';

/** Relations the equipment page reads: those the list loads — the tags, the picture and the sharing requests. */
export const EQUIPMENT_VIEW_RELATIONS = ['tags', 'image', 'equipmentSharings'];

/**
 * Reads one piece of equipment with everything its page shows, within the organization selected in the header.
 * The equipment API serves no single read with relations, so the list read filtered by id brings them along.
 */
export async function loadEquipment(
	service: EquipmentService,
	id: string,
	scope: IRecordViewScope
): Promise<IEquipment | null> {
	const { items } = await service.getAll(EQUIPMENT_VIEW_RELATIONS, {
		id,
		organizationId: scope.organizationId,
		tenantId: scope.tenantId
	} as any);
	return items?.find((item) => item.id === id) ?? null;
}

/** A piece of equipment, described for `ngx-record-view` — the equipment grid's columns read vertically. */
export function buildEquipmentViewSections(): IRecordViewSection[] {
	return [
		{
			fields: [
				{ label: 'EQUIPMENT_PAGE.EQUIPMENT_NAME', key: 'name' },
				{ label: 'EQUIPMENT_PAGE.EQUIPMENT_TYPE', key: 'type' },
				{ label: 'EQUIPMENT_PAGE.EQUIPMENT_SN', key: 'serialNumber' },
				{ label: 'EQUIPMENT_PAGE.EQUIPMENT_MANUFACTURED_YEAR', key: 'manufacturedYear' },
				{ label: 'EQUIPMENT_PAGE.EQUIPMENT_INITIAL_COST', key: 'initialCost' },
				{ label: 'EQUIPMENT_PAGE.EQUIPMENT_CURRENCY', key: 'currency' },
				{ label: 'EQUIPMENT_PAGE.EQUIPMENT_MAX_SHARE_PERIOD', key: 'maxSharePeriod' },
				{ label: 'EQUIPMENT_PAGE.EQUIPMENT_AUTO_APPROVE', key: 'autoApproveShare', type: 'boolean' }
			]
		},
		{ fields: [{ label: 'SM_TABLE.TAGS', key: 'tags', type: 'tags', wide: true }] }
	];
}

/** `/pages/organization/equipment/view/:id` — one piece of equipment, full width (what its favorite opens). */
export const EQUIPMENT_RECORD_VIEW: IRecordViewRouteData<IEquipment> = {
	heading: 'EQUIPMENT_PAGE.HEADER',
	backLink: '/pages/organization/equipment',
	load: async (id: string, injector: Injector, scope: IRecordViewScope) => {
		const { items } = await injector
			.get(EquipmentService)
			.getAll(['tags'], { id, organizationId: scope.organizationId, tenantId: scope.tenantId } as any);
		return items?.find((item) => item.id === id) ?? null;
	},
	sections: () => buildEquipmentViewSections(),
	subtitle: (equipment) => equipment.name,
	favorite: { entity: BaseEntityEnum.Equipment, name: (equipment) => equipment.name }
};
