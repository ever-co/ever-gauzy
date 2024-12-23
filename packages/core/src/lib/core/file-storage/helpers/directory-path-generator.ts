// Concrete implementation of the path generator
import * as moment from 'moment';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { RequestContext } from '../../context';
import { IDirectoryPathGenerator } from './directory-path-generator.interface';

export class DirectoryPathGenerator implements IDirectoryPathGenerator {
	public getBaseDirectory(name: string): string {
		return path.join(name, moment().format('YYYY/MM/DD'));
	}

	public getSubDirectory(): string {
		const user = RequestContext.currentUser();
		const tenantId = user?.tenantId || uuid();
		const employeeId = user?.employeeId || uuid();
		return path.join(tenantId, employeeId);
	}
}
