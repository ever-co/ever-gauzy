/**
 * Checks if the user has all the required permissions.
 *
 * @param permissions The list of permissions the user has.
 * @param requires The permissions required to perform the action.
 * @returns A boolean indicating whether the user has all the required permissions.
 */
export function hasAllPermissions<T>(permissions: T[], ...requires: T[]) {
	return requires.every((permission) => permissions.includes(permission));
}

/**
 * Checks if the user has any of the required permissions.
 *
 * @param permissions The list of permissions the user has.
 * @param requires The permissions required to perform the action.
 * @returns A boolean indicating whether the user has any of the required permissions.
 */
export function hasAnyPermission<T>(permissions: T[], ...requires: T[]) {
	return requires.some((permission) => permissions.includes(permission));
}
