import { UntypedFormBuilder } from '@angular/forms';
import { CandidateStore, Store, ToastrService } from '@gauzy/ui-core/core';
import { EditCandidateMainComponent } from './edit-candidate-main.component';

/*
 * Built by hand: what is under test is the message an avatar upload failure shows, not the template.
 */
describe('EditCandidateMainComponent — the avatar upload error', () => {
	let danger: jest.Mock;
	let component: EditCandidateMainComponent;

	beforeEach(() => {
		danger = jest.fn();
		component = new EditCandidateMainComponent(
			new UntypedFormBuilder(),
			{} as Store,
			{ danger } as unknown as ToastrService,
			{} as CandidateStore
		);
	});

	it.each([
		['the nested server message', { error: { message: 'Too large' }, message: 'Http failure' }, 'Too large'],
		['a validation list, joined', { message: ['Bad type', 'Too large'] }, 'Bad type; Too large'],
		['the top-level message when the nested one is unusable', { error: { message: { code: 1 } }, message: 'Too large' }, 'Too large'],
		['the top-level message when the nested one is blank', { error: { message: '  ' }, message: 'Too large' }, 'Too large'],
		['the fallback when neither is usable', { error: { message: [] }, message: 42 }, 'INVENTORY_PAGE.COULD_NOT_UPLOAD_IMAGE'],
		['the fallback for no error at all', null, 'INVENTORY_PAGE.COULD_NOT_UPLOAD_IMAGE']
	])('shows %s', (_case, error, shown) => {
		component.handleImageUploadError(error);

		expect(danger).toHaveBeenCalledWith(shown);
	});
});
