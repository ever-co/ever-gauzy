/**
 * The ids a shipment line holds of rows it has no relation to (security audit P0 #6c).
 *
 * A line names the order line it ships and the location its units came from. Neither column is a relation, so the
 * platform's cross-tenant check, which reads the relation join columns of a written row, never saw them: `POST` and
 * `PUT /fulfillment-lines`, `updateFulfillmentLine` and the lines a shipment is created with stored another tenant's
 * order line or location as given.
 *
 * The line service holds these columns to the caller's tenant with `assertPlainReferencesNotForeign` (`@gauzy/core`).
 */
import { PlainReferenceColumns } from '@gauzy/core';

/** The plain id columns of a shipment line. */
export const FULFILLMENT_LINE_REFERENCES: PlainReferenceColumns = {
	orderLineId: 'order_line',
	warehouseId: 'warehouse'
};
