import { IEmployee } from '@gauzy/contracts';
import { Employee } from './employee.entity';

/** Relations as find options name them: `true` for a relation loaded, or the relations loaded below it. */
type LoadedRelations = { readonly [relation: string]: unknown };

/**
 * Sets an employee's `fullName` to their user's name, when the user is loaded and has a name.
 *
 * @param employee - The loaded employee.
 */
export function setEmployeeFullName(employee: IEmployee): void {
	if (employee?.user?.name) {
		employee.fullName = employee.user.name;
	}
}

/**
 * The relations loaded below one relation: none below a leaf (`true`).
 *
 * @param relation - The relation's entry in the loaded relations.
 */
function relationsBelow(relation: unknown): LoadedRelations {
	if (typeof relation === 'object' && relation !== null) {
		return relation as LoadedRelations;
	}
	return {};
}

/**
 * A relation's loaded value as a list: the entities of a to-many relation, or the one value of a to-one relation.
 *
 * @param loaded - The relation's value on an entity.
 */
function asList(loaded: unknown): unknown[] {
	if (Array.isArray(loaded)) {
		return loaded;
	}
	return [loaded];
}

/**
 * Sets the `fullName` of every employee found along the relations loaded on some entities, the employees themselves
 * included.
 *
 * With `relationLoadStrategy: 'query'`, TypeORM runs an employee's load hook (`EmployeeSubscriber`) before it loads
 * the employee's user, so the hook finds no user and sets no name. A read that loads its relations that way calls
 * this once its entities are loaded.
 *
 * @param entities - The loaded entities.
 * @param relations - The relations loaded on them.
 */
export function setLoadedEmployeesFullName(entities: readonly unknown[], relations: LoadedRelations): void {
	for (const entity of entities) {
		if (typeof entity !== 'object' || entity === null) {
			continue;
		}
		if (entity instanceof Employee) {
			setEmployeeFullName(entity);
		}
		for (const [property, relation] of Object.entries(relations)) {
			if (!relation) {
				continue;
			}
			const loaded: unknown = (entity as Record<string, unknown>)[property];
			setLoadedEmployeesFullName(asList(loaded), relationsBelow(relation));
		}
	}
}
