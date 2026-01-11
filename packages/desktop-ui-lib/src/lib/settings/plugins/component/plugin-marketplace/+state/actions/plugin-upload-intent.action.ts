import { createAction } from '@ngneat/effects';

export class PluginUploadIntentActions {
	/**
	 * Action to open the upload selection modal
	 * User chooses between installing locally or publishing to marketplace
	 */
	public static readonly openUploadSelection = createAction('[Plugin Upload Intent] Open Upload Selection');

	/**
	 * Action to clear the upload intent
	 */
	public static readonly clearUploadIntent = createAction('[Plugin Upload Intent] Clear Upload Intent');
}
