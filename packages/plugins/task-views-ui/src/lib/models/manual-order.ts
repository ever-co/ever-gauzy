import { ID } from '@gauzy/contracts';

/** The list with the item at `from` moved to `to` (both indexes of the list as it is). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
	const next = [...list];
	if (from < 0 || from >= next.length) return next;
	const target = Math.max(0, Math.min(next.length - 1, to));
	const [item] = next.splice(from, 1);
	next.splice(target, 0, item);
	return next;
}

/**
 * The whole order a drop makes, as the platform stores it: the rows on the page in their new order, then the tasks
 * the view's order names that are not on the page, in the order they had (they were further down: a page holds the
 * first rows). Each task once, at most `max`.
 */
export function orderAfterDrop(
	previousOrder: readonly ID[] | null | undefined,
	pageAfterDrop: readonly ID[],
	max: number
): ID[] {
	const seen = new Set<ID>();
	const order: ID[] = [];
	for (const id of [...pageAfterDrop, ...(previousOrder ?? [])]) {
		if (seen.has(id)) continue;
		seen.add(id);
		order.push(id);
		if (order.length >= max) break;
	}
	return order;
}

/** Whether a drop changed anything (a row dropped where it was moves nothing and saves nothing). */
export function isMove(from: number, to: number, length: number): boolean {
	return from !== to && from >= 0 && from < length && to >= 0 && to < length;
}
