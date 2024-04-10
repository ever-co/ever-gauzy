module.exports = {
	name: 'job-proposal-template',
	preset: '../../../jest.config.js',
	transform: {
		'^.+\\.[tj]sx?$': 'ts-jest'
	},
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
	coverageDirectory: '../../coverage/plugins/job-proposal-template'
};
