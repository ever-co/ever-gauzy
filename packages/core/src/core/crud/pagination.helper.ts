import { isClassInstance, isObject } from "@gauzy/common";

/**
 * Interface of the simple literal object with any string keys.
 */
export interface SimpleObjectLiteral {
    [key: string]: any;
}

/**
 * Parses the given value and converts it to a boolean using JSON.parse.
 *
 * @param value - The value to be parsed.
 * @returns {boolean} - The boolean representation of the parsed value.
 */
export const parseBool = (value: any): boolean => Boolean(JSON.parse(value));

/**
 * Converts native parameters based on the database connection type.
 *
 * @param parameters - The parameters to be converted.
 * @returns {any} - The converted parameters based on the database connection type.
 */
export const convertNativeParameters = (parameters: any): any => {
    try {
        // Mapping boolean values to their numeric representation
        if (Array.isArray(parameters)) {
            // If it's an array, process each element
            return parameters.map((item: any) => convertNativeParameters(item));
            // Mapping boolean values to their numeric representation
        } else if (typeof parameters === "object" && parameters !== null) {
            // Recursively convert nested objects
            return Object.keys(parameters).reduce((acc, key) => {
                acc[key] = convertNativeParameters(parameters[key]);
                return acc;
            }, {} as SimpleObjectLiteral);
        } else {
            return parseBool(parameters);
        }
    } catch (error) {
        return parameters;
    }
};

/**
 * Parse object to specific type
 *
 * @param source
 * @returns
 */
export function parseObject(source: Object, callback: Function) {
    if (isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!isClassInstance(source[key])) {
                    parseObject(source[key], callback);
                }
            } else {
                Object.assign(source, { [key]: callback(source[key]) })
            }
        }
    }
    return source;
}
