import { CustomFieldsObject } from '@gauzy/common';

/**
 * This interface should be implemented by any entity which can be extended
 * with custom fields.
 */
export interface HasCustomFields {
    customFields?: CustomFieldsObject;
}
