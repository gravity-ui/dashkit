module.exports = {
    verbose: true,
    roots: ['<rootDir>/src'],
    moduleDirectories: ['node_modules'],
    transform: {
        '^.+\\.(t|j)sx?$': ['ts-jest', {tsconfig: './tsconfig.json'}],
    },
    transformIgnorePatterns: ['node_modules/(?!(@gravity-ui)/)'],
};
