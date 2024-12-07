export class ObjectUtils {
    /**
     * Checks if given value is an object.
     * We cannot use instanceof because it has problems when running on different contexts.
     * And we don't simply use typeof because typeof null === "object".
     */
    static isObject(val: any): val is Object {
        return val !== null && typeof val === "object"
    }
}
