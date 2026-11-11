const ESM_ONLY_DEPENDENCIES = 'colors-named|colors-named-hex';

module.exports = {
    verbose: true,
    roots: ['<rootDir>/src'],
    moduleDirectories: ['node_modules'],
    transform: {
        [`node_modules/(${ESM_ONLY_DEPENDENCIES})/.+\\.js$`]: '<rootDir>/jest/esmTransform.js',
        '^.+\\.(t|j)sx?$': ['ts-jest', {tsconfig: './tsconfig.json'}],
    },
    transformIgnorePatterns: [`node_modules/(?!(${ESM_ONLY_DEPENDENCIES})/)`],
    moduleNameMapper: {
        '\\.(css|scss)$': '<rootDir>/jest/styleMock.js',
    },
};
