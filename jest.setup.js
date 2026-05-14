require('@testing-library/jest-dom')

// Stub fetch for jsdom-only client component tests. Many components fire
// /api/* requests in useEffect; without a default stub jsdom throws
// "fetch is not defined" and unrelated tests fail. Each test that cares
// about specific fetch behavior should jest.spyOn(globalThis, 'fetch')
// and provide its own mock.
if (typeof window !== 'undefined' && typeof globalThis.fetch !== 'function') {
  globalThis.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '',
      headers: new Map(),
    })
  )
}

// Browser-only mocks — skip when running in Node environment (API route tests)
if (typeof window !== 'undefined') {
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })

  // Mock IntersectionObserver
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() { return null }
    disconnect() { return null }
    unobserve() { return null }
  }
}
