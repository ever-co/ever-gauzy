import { ChatMemberRoleEnum, IChatCategory, IChatConversationWithState } from '@gauzy/contracts';

/** The categories in the order the sidebar shows them: by position, then by name. */
export function sortCategories(categories: readonly IChatCategory[]): IChatCategory[] {
	return [...categories].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || (a.name ?? '').localeCompare(b.name ?? ''));
}

/** One position to write after a move. */
export interface CategoryPosition {
	id: string;
	position: number;
}

/**
 * Moves a category one place up or down and numbers the list again from 0: the positions that changed, the only
 * ones to write (`PATCH /chat/categories/:id { position }`). Nothing when the category is already at that end.
 */
export function moveCategory(categories: readonly IChatCategory[], id: string, direction: -1 | 1): CategoryPosition[] {
	const ordered = sortCategories(categories);
	const index = ordered.findIndex((category) => String(category.id) === String(id));
	const target = index + direction;
	if (index < 0 || target < 0 || target >= ordered.length) return [];
	const moved = [...ordered];
	[moved[index], moved[target]] = [moved[target], moved[index]];
	return moved
		.map((category, position) => ({ id: String(category.id), position, before: category.position ?? 0 }))
		.filter((entry) => entry.position !== entry.before)
		.map(({ id: categoryId, position }) => ({ id: categoryId, position }));
}

/**
 * The order of the categories after moving one a place up or down: their ids, first to last, for the one reorder call
 * (`POST /chat/categories/reorder`, saved in one transaction). Null when the category is already at that end, or unknown.
 */
export function movedCategoryOrder(categories: readonly IChatCategory[], id: string, direction: -1 | 1): string[] | null {
	const ordered = sortCategories(categories);
	const index = ordered.findIndex((category) => String(category.id) === String(id));
	const target = index + direction;
	if (index < 0 || target < 0 || target >= ordered.length) return null;
	const moved = [...ordered];
	[moved[index], moved[target]] = [moved[target], moved[index]];
	return moved.map((category) => String(category.id));
}

/** The position a new category takes: after the last one. */
export function nextCategoryPosition(categories: readonly IChatCategory[]): number {
	return categories.reduce((max, category) => Math.max(max, (category.position ?? 0) + 1), 0);
}

/**
 * Whether I manage a conversation, as the API decides it (`ChatAccessService.requireManager`): `CHAT_MANAGE`, a
 * manager role in it, or its creator.
 */
export function canManageConversation(
	conversation: Pick<IChatConversationWithState, 'state' | 'createdByEmployeeId'>,
	meEmployeeId: string | null,
	isAdmin: boolean
): boolean {
	if (isAdmin) return true;
	if (conversation.state?.role === ChatMemberRoleEnum.MANAGER) return true;
	return !!meEmployeeId && !!conversation.createdByEmployeeId && String(conversation.createdByEmployeeId) === meEmployeeId;
}
