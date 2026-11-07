import '../core/entities/internal';

import { getMetadataArgsStorage } from 'typeorm';
import { OrganizationProject } from './organization-project.entity';
import { OrganizationProjectEmployee } from './organization-project-employee.entity';

/**
 * Generic project reads are open to any employee who views projects, and can load the project's members. A client
 * rate is read through the project rate routes only, which check who may: neither column is selected by default on
 * TypeORM nor serialized on MikroORM.
 */

const ENTITIES: Array<[string, Function]> = [
	['OrganizationProject', OrganizationProject],
	['OrganizationProjectEmployee', OrganizationProjectEmployee]
];

function typeOrmOptionsOf(entity: Function) {
	const columns = getMetadataArgsStorage().columns;
	const column = columns.find((args) => args.target === entity && args.propertyName === 'billRateValue');
	return column?.options;
}

async function mikroOrmPropertyOf(className: string): Promise<{ hidden?: boolean } | undefined> {
	const previous = process.env.DB_ORM;
	process.env.DB_ORM = 'mikro-orm';
	let property: { hidden?: boolean } | undefined;
	try {
		await jest.isolateModulesAsync(async () => {
			require('../core/entities/internal');
			const { MetadataStorage } = require('@mikro-orm/core');
			const metadata = Object.values(MetadataStorage.getMetadata()) as any[];
			const entity = metadata.find((meta) => meta.className === className && meta.properties.billRateValue);
			property = entity?.properties.billRateValue;
		});
	} finally {
		if (previous === undefined) {
			delete process.env.DB_ORM;
		} else {
			process.env.DB_ORM = previous;
		}
	}
	return property;
}

describe('client rate columns', () => {
	it.each(ENTITIES)('%s leaves its client rate out of a TypeORM read that does not select it', (_name, entity) => {
		expect(typeOrmOptionsOf(entity)).toEqual(expect.objectContaining({ select: false }));
	});

	it.each(ENTITIES)('%s keeps its client rate out of MikroORM serialization', async (name) => {
		const property = await mikroOrmPropertyOf(name);

		expect(property).toEqual(expect.objectContaining({ hidden: true }));
	});
});
