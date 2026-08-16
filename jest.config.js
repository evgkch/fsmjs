/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    // Let ESM-style `./x.js` specifiers resolve to their `.ts` sources.
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    testMatch: ['**/test/**/*.spec.ts'],
    // Mid-rewrite: these cover modules still on the old Graph/Signature shape. Each entry
    // goes away as its module is ported to the two-layer core (see tsconfig.json).
    testPathIgnorePatterns: [
        '/node_modules/',
    ],
};
