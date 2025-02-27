module.exports = {
    verbose: true,
    setupFilesAfterEnv: ['<rootDir>/jest/setup.js'],
    roots: ['<rootDir>/jest', '<rootDir>/src'],
    moduleDirectories: ['node_modules', '<rootDir>/jest'],
    transform: {
        '^.+\\.(t|j)sx?$': ['ts-jest', {tsconfig: './tsconfig.json'}],
    },
    transformIgnorePatterns: ['node_modules/(?!(@gravity-ui)/)'],
    snapshotSerializers: ['enzyme-to-json/serializer'],
};
