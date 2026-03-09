import { WidgetCard } from '@gauzy/ui-react-components';

export interface MembersWorkedWidgetProps {
	count: number;
}

export function MembersWorkedWidget({ count }: MembersWorkedWidgetProps) {
	return <WidgetCard label="Members worked" value={count} />;
}
