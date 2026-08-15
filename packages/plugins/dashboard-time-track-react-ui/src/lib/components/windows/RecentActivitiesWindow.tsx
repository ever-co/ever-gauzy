import { useRef } from 'react';
import { ID, IOrganization, ITimeSlotStatistics, TimeFormatEnum } from '@gauzy/contracts';
import { useTranslation } from '@gauzy/ui-react';
import { Avatar } from '@gauzy/ui-react-components';
import { dateFormat, utcToLocal } from '../../utils/format.utils';
import { NbButton } from '../NbButton';
import { ScreenshotCarousel, type ScreenshotCarouselHandle } from './ScreenshotCarousel';
import { ScreenshotItem } from './ScreenshotItem';
import { WindowCard } from './WindowCard';

export interface RecentActivitiesWindowProps {
	timeSlotEmployees: ITimeSlotStatistics[];
	loading: boolean;
	emptyMessage: string;
	timeZone: string;
	timeFormat: TimeFormatEnum;
	organization: IOrganization | null | undefined;
	dateFormatOptions: { dateFormat?: string | null; locale?: string | null };
	/** `CHANGE_SELECTED_EMPLOYEE` — shows the avatar and the "View All" button. */
	canChangeSelectedEmployee: boolean;
	/** `redirectToScreenshots(employee)`. */
	onViewAll: (employee: ITimeSlotStatistics) => void;
	/** `/pages/employees/edit/:id` (the avatar link). */
	onOpenEmployee: (id: ID) => void;
	/** `(delete)="onDelete()"` → refresh. */
	onDelete: () => void;
}

/**
 * One employee row of the Recent Activities window: avatar + "Last worked" caption, prev/next
 * arrows, "View All", and the three-per-view screenshot carousel.
 */
function EmployeeActivityRow({
	employee,
	timeZone,
	timeFormat,
	organization,
	dateFormatOptions,
	canChangeSelectedEmployee,
	onViewAll,
	onOpenEmployee,
	onDelete
}: Omit<RecentActivitiesWindowProps, 'timeSlotEmployees' | 'loading' | 'emptyMessage'> & { employee: ITimeSlotStatistics }) {
	const { t } = useTranslation();
	const carouselRef = useRef<ScreenshotCarouselHandle>(null);
	const firstSlot = employee.timeSlots?.[0];
	const lastWorked = firstSlot?.startedAt ? dateFormat(utcToLocal(firstSlot.startedAt), dateFormatOptions) : '';

	return (
		<div className="gz-rtt-row">
			<div className="gz-rtt-col">
				<div className="gz-rtt-hour-label gz-rtt-mb-3 gz-rtt-avatar-row">
					{canChangeSelectedEmployee ? (
						<Avatar
							variant="activity"
							size="sm"
							name={employee.user?.name}
							src={employee.user?.imageUrl}
							appendCaption={t('TIMESHEET.LAST_WORKED')}
							caption={lastWorked}
							presence={employee}
							onClick={() => onOpenEmployee(employee.id)}
						/>
					) : (
						<div />
					)}
					<div className="gz-rtt-button-container">
						<div className="gz-rtt-swiper-button-container">
							<button type="button" className="gz-rtt-swiper-button" aria-label={t('BUTTONS.PREVIOUS')} onClick={() => carouselRef.current?.slidePrev()}>
								<i className="fas fa-angle-left" />
							</button>
							<button type="button" className="gz-rtt-swiper-button" aria-label={t('BUTTONS.NEXT')} onClick={() => carouselRef.current?.slideNext()}>
								<i className="fas fa-angle-right" />
							</button>
						</div>
						{canChangeSelectedEmployee ? (
							<div className="gz-rtt-view-all">
								<NbButton appearance="outline" status="primary" size="small" onClick={() => onViewAll(employee)}>
									{t('BUTTONS.VIEW_ALL')}
								</NbButton>
							</div>
						) : null}
					</div>
				</div>
				<div>
					<ScreenshotCarousel ref={carouselRef}>
						{(employee.timeSlots || []).map((timeSlot) => (
							<div className="gz-rtt-carousel-slide" key={timeSlot.id}>
								<ScreenshotItem
									timeSlot={timeSlot}
									timeZone={timeZone}
									timeFormat={timeFormat}
									employeeId={timeSlot.employee?.id ?? timeSlot.employeeId}
									organization={organization}
									dateFormatOptions={dateFormatOptions}
									onDelete={onDelete}
								/>
							</div>
						))}
					</ScreenshotCarousel>
				</div>
			</div>
		</div>
	);
}

/**
 * The Recent Activities window (`gaWindowTemplate` #0): one row per employee with time slots,
 * or the per-period "No screenshot" message.
 */
export function RecentActivitiesWindow(props: RecentActivitiesWindowProps) {
	const { t } = useTranslation();
	const { timeSlotEmployees, loading, emptyMessage, ...rowProps } = props;
	const rows = (timeSlotEmployees || []).filter((employee) => (employee.timeSlots?.length ?? 0) > 0);
	return (
		<WindowCard
			title={t('TIMESHEET.RECENT_ACTIVITIES')}
			loading={loading}
			hasData={(timeSlotEmployees?.length ?? 0) > 0}
			emptyMessage={emptyMessage}
			bodyClassName="gz-rtt-custom-card-body-inner"
			emptyInBody
		>
			{rows.map((employee) => (
				<EmployeeActivityRow key={employee.id} employee={employee} {...rowProps} />
			))}
		</WindowCard>
	);
}
