import { useMemo } from 'react';
import type { IPluginHostAPI } from '@gauzy/plugin-ui';
import { useInjector } from './use-injector';

/**
 * React hook that provides access to the Plugin Host API from within
 * a React component rendered inside Angular via @gauzy/ui-react-bridge.
 *
 * The host app must provide `PLUGIN_HOST_API` in its Angular root module.
 * Returns null if the provider is not configured.
 *
 * @example
 * ```tsx
 * function MyPluginComponent() {
 *   const host = usePluginHost();
 *
 *   const handleSave = () => {
 *     host?.notifications.success('Saved successfully!');
 *     host?.navigation.navigate(['/pages/dashboard']);
 *   };
 *
 *   const user = host?.user.getCurrentUser();
 *
 *   return (
 *     <div>
 *       <p>Hello, {user?.name}</p>
 *       <button onClick={handleSave}>Save</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePluginHost(): IPluginHostAPI | null {
	const injector = useInjector();

	return useMemo(() => {
		if (!injector) return null;
		try {
			// Lazy-import the token to avoid bundling Angular in React at compile time
			const { PLUGIN_HOST_API } = require('@gauzy/plugin-ui');
			return injector.get(PLUGIN_HOST_API, null) as IPluginHostAPI | null;
		} catch {
			return null;
		}
	}, [injector]);
}
