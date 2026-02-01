/* eslint-disable */
export default {
	displayName: 'gauzy',
	preset: '../../jest.preset.js',
	coverageDirectory: '../../coverage/apps/gauzy',
	snapshotSerializers: [
		'jest-preset-angular/AngularSnapshotSerializer.js',
		'jest-preset-angular/HTMLCommentSerializer.js'
	]
};
