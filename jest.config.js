const nextJest = require('next/jest')

/** @type {import('jest').Config} */
const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/app/(.*)$': '<rootDir>/src/app/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/**/layout.tsx',
    '!src/app/**/loading.tsx',
    '!src/app/**/not-found.tsx',
    '!src/app/**/error.tsx',
  ],
  coverageThreshold: {
    // Current baseline — raise as test coverage improves.
    // Only temporal route + TemporalTracker have tests today.
    global: {
      branches: 50,
      functions: 35,
      lines: 10,
      statements: 10,
    },
  },
}

// next/jest overrides transformIgnorePatterns; apply our ESM exclusions after
module.exports = async () => {
  const jestConfig = await createJestConfig(config)()
  jestConfig.transformIgnorePatterns = [
    '/node_modules/(?!(monarch-money-api|graphql-request|node-fetch|data-uri-to-buffer|fetch-blob|formdata-polyfill|form-data)/)',
  ]
  return jestConfig
}
