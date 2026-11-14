import { TransformFnParams } from 'class-transformer';

/**
 * Reads a list of ids sent as a body array, or in a query string either repeated (`ids[]=a&ids[]=b`) or once
 * (`ids=a`), which the query parser hands over as a single string.
 */
export const toIdList = ({ value }: TransformFnParams): unknown => {
	if (typeof value === 'string') {
		return [value];
	}
	return value;
};
