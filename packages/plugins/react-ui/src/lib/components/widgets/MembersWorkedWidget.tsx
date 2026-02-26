import { StatCard } from '../ui/StatCard';

export interface MembersWorkedWidgetProps {
	count: number;
}

export function MembersWorkedWidget({ count }: MembersWorkedWidgetProps) {
	return <StatCard label="Members worked" value={count} />;
}
