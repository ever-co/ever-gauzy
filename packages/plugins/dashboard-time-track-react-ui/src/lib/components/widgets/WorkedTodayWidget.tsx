import { Card } from '@gauzy/ui-react-components';

export interface WorkedTodayWidgetProps {
	duration: string;
}

export function WorkedTodayWidget({ duration }: WorkedTodayWidgetProps) {
	return <Card label="Worked today" value={duration} />;
}
