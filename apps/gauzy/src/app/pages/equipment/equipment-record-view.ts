import { IEquipment } from '@gauzy/contracts';
import { EquipmentService } from '@gauzy/ui-core/core';
import { IRecordViewScope } from '@gauzy/ui-core/shared';

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
