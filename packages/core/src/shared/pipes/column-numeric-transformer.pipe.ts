import { ValueTransformer } from "typeorm";
import { isNullOrUndefined } from "@gauzy/common";

/**
 * Convert Non-integer numbers string to integer
 * From https://github.com/typeorm/typeorm/issues/873#issuecomment-502294597 
 */
export class ColumnNumericTransformerPipe implements ValueTransformer {
    to(data?: number | null): number | null {
        if (!isNullOrUndefined(data)) {
            return data
        }
        return null
    }

    from(data?: string | null): number | null {
        if (!isNullOrUndefined(data)) {
            const res = parseFloat(data)
            if (isNaN(res)) {
                return null
            } else {
                return res
            }
        }
        return null
    }
}