import { useEffect, useMemo, useState } from 'react';
import { NgxPermissionsService } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';
import { useInjector } from '@gauzy/ui-react';

/**
 * Reactive `*ngxPermissionsOnly` for React: true while the current user holds `permission`.
 *
 * Reads the same `NgxPermissionsService` the Angular templates use (`permissions$` +
 * `getPermissions()`), so gating decisions are identical between the two dashboard flavours
 * and follow role changes live.
 *
 * @param permission Permission to check.
 */
export function usePermission(permission: PermissionsEnum): boolean {
	const injector = useInjector();
	const service = useMemo(() => injector.get(NgxPermissionsService, null), [injector]);
	const [granted, setGranted] = useState<boolean>(() => !!service?.getPermissions()?.[permission]);

	useEffect(() => {
		if (!service) return;
		const subscription = service.permissions$.subscribe((permissions) => {
			setGranted(!!permissions?.[permission]);
		});
		return () => subscription.unsubscribe();
	}, [service, permission]);

	return granted;
}
