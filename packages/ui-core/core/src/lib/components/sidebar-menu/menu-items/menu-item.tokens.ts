import { InjectionToken } from '@angular/core';

/**
 * Set to `true` by a host that renders the sidebar menu somewhere other than the menu sidebar,
 * such as the workspace panel. Its rows then always show their full labels, whatever state the
 * menu sidebar is in. Without it, a collapsed sidebar turned the panel's menu into a bare icon rail.
 */
export const GA_MENU_ALWAYS_EXPANDED = new InjectionToken<boolean>('GA_MENU_ALWAYS_EXPANDED');
