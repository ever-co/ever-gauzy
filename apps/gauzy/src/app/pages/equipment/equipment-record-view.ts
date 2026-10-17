import { Injector } from '@angular/core';
import { BaseEntityEnum, IEquipment } from '@gauzy/contracts';
import { EquipmentService } from '@gauzy/ui-core/core';
import { IRecordViewRouteData, IRecordViewScope, IRecordViewSection } from '@gauzy/ui-core/shared';

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
