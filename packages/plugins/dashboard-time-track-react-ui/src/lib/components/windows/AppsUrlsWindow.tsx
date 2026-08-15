import '../nebular-jsx';
import { IActivitiesStatistics } from '@gauzy/contracts';
import { useTranslation } from '@gauzy/ui-react';
import { ProgressBar, progressStatus } from '@gauzy/ui-react-components';
import { durationFormat } from '../../utils/format.utils';
import { NbButton } from '../NbButton';
import { WindowCard } from './WindowCard';

/**
 * `ngx-activity-item [isDashboard]="true"` for one activity: title (5 cols), `x%` + tiny bar,
 * duration. The percentage is truncated to an integer like the Angular `item` setter
 * (`parseInt(...).toFixed(1)`).
 */
export function ActivityItem({ item }: { item: IActivitiesStatistics }) {
	const percentage = parseFloat(parseInt(`${item.durationPercentage ?? 0}`, 10).toFixed(1)) || 0;
	return (
		<div className="gz-rtt-activity-item">
			<div className="gz-rtt-activity-title" title={item.title}>
				{item.title}
			</div>
			<div className="gz-rtt-activity-progress">
				<div className="gz-rtt-percentage-col">{percentage}%</div>
				<ProgressBar className="gz-rtt-tracking-progress" value={percentage} status={progressStatus(percentage)} height="5px" />
			</div>
			<div className="gz-rtt-activity-duration">{durationFormat(item.duration)}</div>
		</div>
	);
}

export interface AppsUrlsWindowProps {
	activities: IActivitiesStatistics[];
	loading: boolean;
	emptyMessage: string;
	/** `redirectToAppUrlReport()`. */
	onViewReport: () => void;
}

/**
 * The Apps & URLs window (`gaWindowTemplate` #4): "View Report" + one activity item per row.
 */
export function AppsUrlsWindow({ activities, loading, emptyMessage, onViewReport }: AppsUrlsWindowProps) {
	const { t } = useTranslation();
	return (
		<WindowCard title={t('TIMESHEET.APPS_URLS')} loading={loading} hasData={(activities?.length ?? 0) > 0} emptyMessage={emptyMessage} flexHeader>
			<div className="gz-rtt-custom-card-button">
				<NbButton appearance="outline" status="primary" size="small" onClick={onViewReport}>
					{t('BUTTONS.VIEW_REPORT')}
				</NbButton>
			</div>
			<nb-list>
				{activities.map((activity, index) => (
					<nb-list-item key={`${activity.title ?? ''}-${index}`}>
						<div className="gz-rtt-w-100">
							<ActivityItem item={activity} />
						</div>
					</nb-list-item>
				))}
			</nb-list>
		</WindowCard>
	);
}
