import '../nebular-jsx';
import { ID, IManualTimesStatistics } from '@gauzy/contracts';
import { useTranslation } from '@gauzy/ui-react';
import { Avatar } from '@gauzy/ui-react-components';
import { dateFormat, durationFormat } from '../../utils/format.utils';
import { NbButton } from '../NbButton';
import { WindowCard } from './WindowCard';

export interface ManualTimeWindowProps {
	manualTimes: IManualTimesStatistics[];
	loading: boolean;
	emptyMessage: string;
	dateFormatOptions: { dateFormat?: string | null; locale?: string | null };
	/** `redirectToManualTimeReport()`. */
	onViewReport: () => void;
	/** `/pages/employees/edit/:id`. */
	onOpenEmployee: (id: ID) => void;
}

/**
 * The Manual Time window (`gaWindowTemplate` #1): "View Report" + a Member / Project /
 * Duration / Date table.
 */
export function ManualTimeWindow({ manualTimes, loading, emptyMessage, dateFormatOptions, onViewReport, onOpenEmployee }: ManualTimeWindowProps) {
	const { t } = useTranslation();
	// The statistics hook hands over `null` while a request is in flight — normalise once.
	const rows = manualTimes ?? [];
	return (
		<WindowCard title={t('TIMESHEET.MANUAL_TIME')} loading={loading} hasData={rows.length > 0} emptyMessage={emptyMessage} flexHeader>
			<div className="gz-rtt-custom-card-button">
				<NbButton appearance="outline" status="primary" size="small" onClick={onViewReport}>
					{t('BUTTONS.VIEW_REPORT')}
				</NbButton>
			</div>
			<nb-list>
				<nb-list-item>
					<div className="gz-rtt-w-100">
						<div className="gz-rtt-row gz-rtt-py-2 gz-rtt-font-weight-bold">
							<div className="gz-rtt-col-3">{t('TIMESHEET.MEMBER')}</div>
							<div className="gz-rtt-col">{t('TIMESHEET.PROJECT')}</div>
							<div className="gz-rtt-col">{t('TIMESHEET.DURATION')}</div>
							<div className="gz-rtt-col">{t('TIMESHEET.DATE')}</div>
						</div>
					</div>
				</nb-list-item>
				{rows.map((manualTime) => (
					<nb-list-item key={manualTime.id}>
						<div className="gz-rtt-w-100">
							<div className="gz-rtt-row">
								<div className="gz-rtt-col-3">
									<Avatar
										size="sm"
										name={manualTime.user?.name}
										src={manualTime.user?.imageUrl}
										presence={manualTime.employee}
										onClick={manualTime.employeeId ? () => onOpenEmployee(manualTime.employeeId) : undefined}
									/>
								</div>
								<div className="gz-rtt-col gz-rtt-project-name">{manualTime.project?.name}</div>
								<div className="gz-rtt-col">{durationFormat(manualTime.duration)}</div>
								<div className="gz-rtt-col">{dateFormat(manualTime.startedAt, dateFormatOptions)}</div>
							</div>
						</div>
					</nb-list-item>
				))}
			</nb-list>
		</WindowCard>
	);
}
