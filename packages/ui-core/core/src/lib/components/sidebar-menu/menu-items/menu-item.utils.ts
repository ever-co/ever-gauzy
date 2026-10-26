import { IMenuItem } from './interface/menu-item.interface';

export function isSameMenuItem(a: IMenuItem | null | undefined, b: IMenuItem | null | undefined): boolean {
	if (!a || !b) {
		return false;
	}
	if (a === b) {
		return true;
	}
	return !!a.id && a.id === b.id;
}
