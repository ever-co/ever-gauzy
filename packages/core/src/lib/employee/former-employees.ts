import { ID } from '@gauzy/contracts';

/**
 * Employees whose work ended — "End Work" deactivates and archives them (`EmployeeSubscriber`) — keep their
 * memberships, so that "Back to Work" restores them. Until then no member list shows them: not a team's, a
 * sprint's, a project module's, a department's nor a client's. Only the Employees page lists them, on request.
 */

/** Tells which of the given employees still work in the organization (`EmployeeService`). */
export interface IWorkingEmployeeLookup {
	findWorkingEmployeeIds(employeeIds: ID[]): Promise<Set<ID>>;
}

/** The key under which every member list of the API is answered. */
const MEMBER_LIST_KEY = 'members';

/**
 * The keys a response carries its records under: a page (`items`), a GraphQL connection (`nodes`, `edges[].node`).
 */
const RECORD_KEYS = new Set(['items', 'nodes', 'edges', 'node']);

/**
 * The relations whose records are organizational member lists too: a team's projects, a sprint's project, a
 * module's parent and children, a project's client... A relation not named here is not searched: a task's `members` are its assignees
 * and a comment's its mentions, records of who did the work, which keep every employee they name.
 */
const MEMBERSHIP_HOLDER_KEYS = new Set([
	// Lists of them
	'teams',
	'organizationTeams',
	'projects',
	'organizationProjects',
	'modules',
	'organizationProjectModules',
	'children',
	'sprints',
	'organizationSprints',
	'departments',
	'organizationDepartments',
	'organizationContacts',
	// One of them
	'project',
	'organizationProject',
	'parent',
	'organizationTeam',
	'organizationSprint',
	'organizationProjectModule',
	'organizationContact',
	'organizationDepartment'
]);

/** One member list found in a response, and where it sits. */
interface IMemberList {
	holder: Record<string, unknown>;
	list: unknown[];
}

/** A member of a list: a membership row (team, sprint, module), or an employee (department, client). */
type Member = Record<string, unknown> & {
	id?: ID;
	employeeId?: ID;
	employee?: { id?: ID } | ID;
	isActive?: boolean;
	isArchived?: boolean;
	deletedAt?: Date | string | null;
};

/**
 * Whether a member is a membership row: it names its employee by `employeeId`, or by `employee` — MikroORM maps
 * the column through the relation and leaves `employeeId` unset, the relation holding the employee or its key.
 */
function isMembership(member: Member): boolean {
	return 'employeeId' in member || 'employee' in member;
}

/** The employee a membership row names. */
function membershipEmployeeId(member: Member): ID | undefined {
	const employee = member.employee;
	return member.employeeId ?? (typeof employee === 'string' ? employee : employee?.id);
}

/** Whether a member is an employee row (a many-to-many `members`): it is an employee of a user. */
function isEmployee(member: Member): boolean {
	return 'userId' in member || 'user' in member;
}

/** Whether an employee row states its working status itself: both flags were read. */
function statesItsStatus(member: Member): boolean {
	return typeof member.isActive === 'boolean' && typeof member.isArchived === 'boolean';
}

/**
 * Collects the member lists of the records of a response: the records it answers (itself, a page's `items`, a
 * connection's nodes) and the organizational records related to them ({@link MEMBERSHIP_HOLDER_KEYS}), at any depth
 * — a module's children's children are read in a page as in a single record. The walk is breadth-first and
 * iterative, and visits each object once, so a deep tree or a cycle of relations ends it rather than overflowing.
 */
function collectMemberLists(response: unknown): IMemberList[] {
	const found: IMemberList[] = [];
	const seen = new WeakSet<object>();
	const queue: unknown[] = [response];

	for (let next = 0; next < queue.length; next++) {
		const value = queue[next];
		if (!value || typeof value !== 'object' || value instanceof Date || seen.has(value)) {
			continue;
		}
		seen.add(value);

		if (Array.isArray(value)) {
			queue.push(...value);
			continue;
		}

		const record = value as Record<string, unknown>;
		if (Array.isArray(record[MEMBER_LIST_KEY])) {
			found.push({ holder: record, list: record[MEMBER_LIST_KEY] as unknown[] });
		}
		for (const [key, item] of Object.entries(record)) {
			if (RECORD_KEYS.has(key) || MEMBERSHIP_HOLDER_KEYS.has(key)) {
				queue.push(item);
			}
		}
	}
	return found;
}

/**
 * Leaves the employees whose work ended out of every member list (`members`) of an API response, in place.
 *
 * A membership row is kept when its employee works, and an employee row when it does. An employee row that
 * carries both status flags is read from them; any other employee, and every membership row, is looked up — once
 * for the whole response. A member whose employee cannot be named, or cannot be looked up, is kept: only an
 * employee known not to work is left out.
 *
 * The response is what the API answers, after the write or read that produced it: no entity is saved from it, so
 * removing a member here never removes a membership.
 *
 * @param response - The answer of a REST route or a GraphQL field.
 * @param lookup - Which employees still work; without it, only the employee rows that state their status are read.
 */
export async function leaveOutFormerEmployees(response: unknown, lookup?: IWorkingEmployeeLookup): Promise<void> {
	const lists = collectMemberLists(response);
	if (!lists.length) {
		return;
	}

	// The employees to look up: every membership's, and those of employee rows that do not state their status
	const lookedUp = new Set<ID>();
	for (const { list } of lists) {
		for (const member of list as Member[]) {
			if (!member || typeof member !== 'object') continue;
			if (isMembership(member)) {
				const employeeId = membershipEmployeeId(member);
				if (employeeId) lookedUp.add(employeeId);
			} else if (isEmployee(member) && !statesItsStatus(member) && member.id) {
				lookedUp.add(member.id);
			}
		}
	}
	const working = lookup && lookedUp.size ? await lookup.findWorkingEmployeeIds([...lookedUp]) : null;

	const works = (member: Member): boolean => {
		if (!member || typeof member !== 'object') {
			return true;
		}
		if (isMembership(member)) {
			const employeeId = membershipEmployeeId(member);
			return !employeeId || !working || working.has(employeeId);
		}
		if (!isEmployee(member)) {
			return true;
		}
		if (statesItsStatus(member)) {
			// A soft delete keeps the flags: a deleted employee (read `withDeleted`) works no more than an ended one
			return member.isActive && !member.isArchived && !member.deletedAt;
		}
		return !member.id || !working || working.has(member.id);
	};

	for (const entry of lists) {
		const kept = (entry.list as Member[]).filter(works);
		if (kept.length !== entry.list.length) {
			entry.holder[MEMBER_LIST_KEY] = kept;
		}
	}
}

/**
 * The employees a save of a many-to-many member list links: the stated ones, and the linked employees whose work
 * ended. The member pickers offer working employees only, and the lists never show the others, so an edit never
 * sends them back; saving the stated list as it is would unlink them, and Back to Work could not restore them.
 *
 * @param stated - The members the edit states.
 * @param linked - The members linked now, as stored (with their status flags), deleted employees included: a soft
 *   delete keeps the flags, and recovering the employee restores the link.
 * @returns The stated members, and the linked former employees the edit did not state.
 */
export function withFormerEmployeeLinks<
	T extends { id?: ID; isActive?: boolean; isArchived?: boolean; deletedAt?: Date | string | null }
>(stated: T[], linked: T[] = []): T[] {
	const former = (linked ?? []).filter(
		(employee) =>
			employee &&
			(employee.isActive === false || employee.isArchived === true || !!employee.deletedAt) &&
			!stated.some((it) => it?.id === employee.id)
	);
	return [...stated, ...former];
}
