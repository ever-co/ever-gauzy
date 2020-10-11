module.exports = {
	name: 'integration-hubstaff',
	preset: '../../jest.config.js',
	transform: {
		'^.+\\.[tj]sx?$': 'ts-jest'
	},
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
	coverageDirectory: '../../coverage/libs/integration-hubstaff'
};
