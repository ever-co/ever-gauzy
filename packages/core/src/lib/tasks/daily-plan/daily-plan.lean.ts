/**
 * The lean shape of a daily plan list (`GET /daily-plan…?shape=lean`).
 *
 * Ever Teams reads the plans of a person with `employee`, `employee.user`, `tasks`, `tasks.members` and
 * `tasks.members.user`; with the whole user row (and its image) under every member of every task that is about a
 * megabyte for thirty plans, of which the app shows a name and an avatar per person. The lean shape keeps the plans
 * and their tasks as they are (every task column, so a client that writes a task back sends the same task) and trims
 * the people: the plan's employee and each task member keep their ids, their name and the fields of their user that
 * draw an avatar or a link.
 */

type AnyRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is AnyRecord => typeof value === 'object' && value !== null && !Array.isArray(value);

function pick(source: AnyRecord, keys: readonly string[]): AnyRecord {
	const out: AnyRecord = {};
	for (const key of keys) {
		if (source[key] !== undefined) out[key] = source[key];
	}
	return out;
}

/** The plan's employee: the name shown on a past plan and the user the Work Diary link and notifications name. */
export function leanPlanEmployee(employee: unknown): unknown {
	if (!isRecord(employee)) return employee;
	const lean = pick(employee, ['id', 'userId', 'fullName', 'organizationId', 'tenantId']);
	if ('user' in employee) {
		lean.user = isRecord(employee.user)
			? pick(employee.user, ['id', 'name', 'firstName', 'lastName', 'username', 'imageUrl'])
			: employee.user;
	}
	return lean;
}

/**
 * A task member: its ids (a client that writes the task back keeps the member by `userId` / `user.id`) and the user
 * fields that draw the avatar. The image keeps only its two addresses.
 */
export function leanTaskMember(member: unknown): unknown {
	if (!isRecord(member)) return member;
	const lean = pick(member, ['id', 'userId', 'fullName', 'organizationId', 'tenantId']);
	if ('user' in member) {
		if (isRecord(member.user)) {
			const user = pick(member.user, ['id', 'name', 'firstName', 'lastName', 'imageUrl']);
			if ('image' in member.user) {
				user.image = isRecord(member.user.image) ? pick(member.user.image, ['id', 'thumbUrl', 'fullUrl']) : member.user.image;
			}
			lean.user = user;
		} else {
			lean.user = member.user;
		}
	}
	return lean;
}

function leanTask(task: unknown): unknown {
	if (!isRecord(task) || !Array.isArray(task.members)) return task;
	return { ...task, members: task.members.map(leanTaskMember) };
}

/** A plan list as the client asked for it with `shape=lean`: the same plans and tasks, the people trimmed. */
export function leanDailyPlans<T>(plans: T[]): T[] {
	return plans.map((plan) => {
		if (!isRecord(plan)) return plan;
		const lean: AnyRecord = { ...plan };
		if ('employee' in plan) lean.employee = leanPlanEmployee(plan.employee);
		if (Array.isArray(plan.tasks)) lean.tasks = plan.tasks.map(leanTask);
		return lean as T;
	});
}
