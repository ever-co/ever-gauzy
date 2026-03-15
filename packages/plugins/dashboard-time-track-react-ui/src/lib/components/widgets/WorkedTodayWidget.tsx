import { WidgetCard } from '@gauzy/ui-react-components';

export interface WorkedTodayWidgetProps {
	duration: string;
}

export function WorkedTodayWidget({ duration }: WorkedTodayWidgetProps) {
	return <WidgetCard label="Worked today" value={duration} />;
}
