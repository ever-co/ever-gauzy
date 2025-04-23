export default {
	displayName: 'desktop-activity',
	preset: '../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	moduleFileExtensions: ['ts', 'js'],
	coverageDirectory: '../../coverage/packages/desktop-activity'
};
