import '../nebular-jsx';
import { ID, IMembersStatistics } from '@gauzy/contracts';
import { useTranslation } from '@gauzy/ui-react';
import { Avatar, Badge, progressStatus } from '@gauzy/ui-react-components';
import { durationFormat } from '../../utils/format.utils';
import { RangePeriod } from '../../utils/period.utils';
import { WindowCard } from './WindowCard';

export interface MembersWindowProps {
	members: IMembersStatistics[];
	loading: boolean;
	emptyMessage: string;
	selectedPeriod: RangePeriod | undefined;
	/** `isMoreThanWeek()` — hides the 7-bar graph and stacks the week cell. */
	moreThanWeek: boolean;
	/** `/pages/employees/edit/:id`. */
	onOpenEmployee: (id: ID) => void;
}

/**
 * The Members window (`gaWindowTemplate` #5): Member info / Today / This week|Over period table
 * with duration + activity badge per cell and the 7-bar weekly graph.
 */
export function MembersWindow({ members, loading, emptyMessage, selectedPeriod, moreThanWeek, onOpenEmployee }: MembersWindowProps) {
	const { t } = useTranslation();
	// The statistics hook hands over `null` while a request is in flight — normalise once.
	const rows = members ?? [];
	return (
		<WindowCard
			title={t('TIMESHEET.MEMBERS')}
			loading={loading}
			hasData={rows.length > 0}
			emptyMessage={emptyMessage}
			className="gz-rtt-member-list"
			emptyInBody
		>
			<div className="gz-rtt-list">
				<nb-list>
					<nb-list-item>
						<div className="gz-rtt-w-100">
							<div className="gz-rtt-row gz-rtt-font-weight-bold">
								<div className="gz-rtt-col-3">{t('TIMESHEET.MEMBER_INFO')}</div>
								<div className="gz-rtt-col-3 gz-rtt-text-center">{t('TIMESHEET.TODAY')}</div>
								<div className="gz-rtt-col gz-rtt-text-left">
									{t(selectedPeriod === RangePeriod.PERIOD ? 'TIMESHEET.OVER_PERIOD' : 'TIMESHEET.THIS_WEEK')}
								</div>
							</div>
						</div>
					</nb-list-item>
					{rows.map((member) => {
						const todayOverall = member.todayTime?.overall || 0;
						const weekOverall = member.weekTime?.overall || 0;
						return (
							<nb-list-item key={member.id}>
								<div className="gz-rtt-w-100">
									<div className="gz-rtt-row">
										<div className="gz-rtt-col-3">
											<Avatar
												size="sm"
												name={member.user?.name}
												src={member.user?.imageUrl}
												presence={member as { isOnline?: boolean; isAway?: boolean }}
												onClick={member.id ? () => onOpenEmployee(member.id) : undefined}
											/>
										</div>
										<div className="gz-rtt-col-3 gz-rtt-text-center">
											<div className="gz-rtt-activity">
												<div className="gz-rtt-duration">{durationFormat(member.todayTime?.duration || 0)}</div>
												<div className="gz-rtt-activity-percentage">
													<Badge status={progressStatus(todayOverall)} text={`${todayOverall}%`} />
												</div>
											</div>
										</div>
										<div className="gz-rtt-col gz-rtt-text-center">
											<div className={moreThanWeek ? undefined : 'gz-rtt-d-flex'}>
												<div className="gz-rtt-activity gz-rtt-text-center">
													<div className="gz-rtt-duration">{durationFormat(member.weekTime?.duration || 0)}</div>
													<div className="gz-rtt-activity-percentage">
														<Badge status={progressStatus(weekOverall)} text={`${weekOverall}%`} />
													</div>
												</div>
												{!moreThanWeek ? (
													<div className="gz-rtt-member-weekly-activity-graph">
														{(member.weekHours || []).map((weekHour, index) => (
															<div key={index} className="gz-rtt-bar-graph-entry" style={{ height: `${weekHour.duration}%` }} />
														))}
													</div>
												) : null}
											</div>
										</div>
									</div>
								</div>
							</nb-list-item>
						);
					})}
				</nb-list>
			</div>
		</WindowCard>
	);
}
