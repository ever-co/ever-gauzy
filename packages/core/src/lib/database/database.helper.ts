import { isMySQL } from '@gauzy/config';

/**
 *
 * @Desc Used to replace double quotes " with backticks ` in case the selected DB type is MySQL
 */
export const prepareSQLQuery = (queryStr: string): string => {
	if (isMySQL()) {
		return queryStr.replace(/"/g, '`');
	}
	return queryStr;
}
