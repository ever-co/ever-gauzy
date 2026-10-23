import '../nebular-jsx';
import { ID, IManualTimesStatistics } from '@gauzy/contracts';
import { useTranslation } from '@gauzy/ui-react';
import { Avatar } from '@gauzy/ui-react-components';
import { dateFormat, durationFormat, isAgentEmployee } from '../../utils/format.utils';
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
 * The Manual Time window (`gaWindowTemplate` #1): "View Report" in the header + a Member /
 * Project / Duration / Date table.
 */
export function ManualTimeWindow({ manualTimes, loading, emptyMessage, dateFormatOptions, onViewReport, onOpenEmployee }: ManualTimeWindowProps) {
	const { t } = useTranslation();
	// The statistics hook hands over `null` while a request is in flight — normalise once.
	const rows = manualTimes ?? [];
	return (
		<WindowCard
			title={t('TIMESHEET.MANUAL_TIME')}
			loading={loading}
			hasData={rows.length > 0}
			emptyMessage={emptyMessage}
			action={
				<NbButton appearance="outline" status="primary" size="small" onClick={onViewReport}>
					{t('BUTTONS.VIEW_REPORT')}
				</NbButton>
			}
		>
			<nb-list className="gz-rtt-data-list gz-rtt-manual-time-list">
				<nb-list-item className="gz-rtt-data-list-head">
					<div className="gz-rtt-w-100">
						<div className="gz-rtt-row gz-rtt-font-weight-bold">
							<div className="gz-rtt-col-3 gz-rtt-cell gz-rtt-cell-clip">{t('TIMESHEET.MEMBER')}</div>
							<div className="gz-rtt-col gz-rtt-cell gz-rtt-cell-clip">{t('TIMESHEET.PROJECT')}</div>
							<div className="gz-rtt-col gz-rtt-cell gz-rtt-cell-figure gz-rtt-cell-clip">{t('TIMESHEET.DURATION')}</div>
							<div className="gz-rtt-col gz-rtt-cell gz-rtt-cell-figure gz-rtt-cell-clip">{t('TIMESHEET.DATE')}</div>
						</div>
					</div>
				</nb-list-item>
				{rows.map((manualTime) => {
					const duration = durationFormat(manualTime.duration);
					const date = dateFormat(manualTime.startedAt, dateFormatOptions);
					return (
						<nb-list-item key={manualTime.id}>
							<div className="gz-rtt-w-100">
								<div className="gz-rtt-row gz-rtt-align-items-center">
									<div className="gz-rtt-col-3 gz-rtt-cell">
										<Avatar
											size="sm"
											name={manualTime.user?.name}
											src={manualTime.user?.imageUrl}
											presence={manualTime.employee}
											badge={isAgentEmployee(manualTime.employee as { kind?: string }) ? t('EMPLOYEES_PAGE.AGENT_BADGE') : undefined}
											onClick={manualTime.employeeId ? () => onOpenEmployee(manualTime.employeeId) : undefined}
										/>
									</div>
									<div className="gz-rtt-col gz-rtt-cell gz-rtt-project-name" title={manualTime.project?.name}>
										{manualTime.project?.name}
									</div>
									<div className="gz-rtt-col gz-rtt-cell gz-rtt-cell-figure gz-rtt-cell-clip" title={duration}>
										{duration}
									</div>
									<div className="gz-rtt-col gz-rtt-cell gz-rtt-cell-figure gz-rtt-cell-clip" title={date}>
										{date}
									</div>
								</div>
							</div>
						</nb-list-item>
					);
				})}
			</nb-list>
		</WindowCard>
	);
}
