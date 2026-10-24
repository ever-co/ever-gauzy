import '../nebular-jsx';
import { IActivitiesStatistics } from '@gauzy/contracts';
import { useTranslation } from '@gauzy/ui-react';
import { ProgressBar, progressStatus } from '@gauzy/ui-react-components';
import { durationFormat } from '../../utils/format.utils';
import { NbButton } from '../NbButton';
import { WindowCard } from './WindowCard';

/**
 * `ngx-activity-item [isDashboard]="true"` for one activity, on the same title / progress /
 * duration split as the Projects and Tasks rows. The percentage is truncated to an integer like
 * the Angular `item` setter (`parseInt(...).toFixed(1)`).
 */
export function ActivityItem({ item }: { item: IActivitiesStatistics }) {
	const percentage = parseFloat(parseInt(`${item.durationPercentage ?? 0}`, 10).toFixed(1)) || 0;
	return (
		<div className="gz-rtt-activity-item">
			<div className="gz-rtt-activity-title" title={item.title}>
				{item.title}
			</div>
			<div className="gz-rtt-activity-progress">
				<span className="gz-rtt-progress-cell-value">{percentage}%</span>
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
 * The Apps & URLs window (`gaWindowTemplate` #4): "View Report" in the header + one activity
 * item per row.
 */
export function AppsUrlsWindow({ activities, loading, emptyMessage, onViewReport }: AppsUrlsWindowProps) {
	const { t } = useTranslation();
	// The statistics hook hands over `null` while a request is in flight — normalise once.
	const rows = activities ?? [];
	return (
		<WindowCard
			title={t('TIMESHEET.APPS_URLS')}
			loading={loading}
			hasData={rows.length > 0}
			emptyMessage={emptyMessage}
			action={
				<NbButton appearance="outline" status="primary" size="small" onClick={onViewReport}>
					{t('BUTTONS.VIEW_REPORT')}
				</NbButton>
			}
		>
			<nb-list className="gz-rtt-data-list gz-rtt-apps-urls-list">
				{rows.map((activity, index) => (
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
