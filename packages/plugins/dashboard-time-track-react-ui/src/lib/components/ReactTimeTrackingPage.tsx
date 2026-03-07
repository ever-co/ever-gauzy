import { TimeTrackingDashboardWidgets } from './TimeTrackingDashboardWidgets';
import { theme } from '@gauzy/ui-react-components';

/**
 * ReactTimeTrackingPage
 *
 * React component rendered inside the "React Time Tracking" dashboard tab.
 * Displays the live Time Tracking stat widgets via the Angular injector bridge.
 */
export function ReactTimeTrackingPage() {
	return (
		<div style={{ padding: '1rem', fontFamily: theme.font, background: 'transparent' }}>
			<TimeTrackingDashboardWidgets />
		</div>
	);
}
