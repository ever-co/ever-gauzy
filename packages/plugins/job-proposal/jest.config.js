module.exports = {
	name: 'job-proposal',
	preset: '../../../jest.config.js',
	transform: {
		'^.+\\.[tj]sx?$': 'ts-jest'
	},
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
	coverageDirectory: '../../coverage/plugins/job-proposal'
};
