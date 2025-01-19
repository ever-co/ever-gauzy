import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BookmarkQueryParamsResolver } from '@gauzy/ui-core/core';
import { DateRangePickerResolver } from '@gauzy/ui-core/shared';
import { VideoPageComponent } from './pages/video-page/video-page.component';
import { VideoDetailPageComponent } from './pages/video-detail-page/video-detail-page.component';

const routes: Routes = [
	{
		path: '',
		data: {
			title: 'Videos',
			selectors: {
				date: true,
				employee: true,
				project: false,
				team: false
			},
			datePicker: {
				unitOfTime: 'day',
				isLockDatePicker: true,
				isSaveDatePicker: true,
				isSingleDatePicker: true,
				isDisableFutureDate: true
			},
			reuseRoute: false
		},
		resolve: {
			dates: DateRangePickerResolver,
			bookmarkParams: BookmarkQueryParamsResolver
		},
		component: VideoPageComponent
	},
	{
		path: ':id',
		data: {
			title: 'Video',
			selectors: {
				date: true,
				employee: true,
				project: false,
				team: false
			},
			datePicker: {
				unitOfTime: 'day',
				isLockDatePicker: true,
				isSaveDatePicker: true,
				isSingleDatePicker: true,
				isDisableFutureDate: true
			},
			reuseRoute: true
		},
		component: VideoDetailPageComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class VideoUiRoutingModule {}
