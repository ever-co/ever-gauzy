import { Card } from '@gauzy/ui-react-components';

export interface MembersWorkedWidgetProps {
	count: number;
}

export function MembersWorkedWidget({ count }: MembersWorkedWidgetProps) {
	return <Card label="Members worked" value={count} />;
}
