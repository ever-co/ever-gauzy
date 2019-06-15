module.exports = {
  name: 'gauzy',
  preset: '../../jest.config.js',
  coverageDirectory: '../../coverage/apps/gauzy',
  snapshotSerializers: [
    'jest-preset-angular/AngularSnapshotSerializer.js',
    'jest-preset-angular/HTMLCommentSerializer.js'
  ]
};
