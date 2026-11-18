/** Import boundaries. Add a `forbidden` rule each time /correct finds a cross-layer import. */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular import. Move the shared code into a module both sides import.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'core-is-leaf',
      severity: 'error',
      comment: 'core must not import cli or plugin. Move the shared code into packages/core.',
      from: { path: '^packages/core/' },
      to: { path: '^packages/(cli|plugin)/' },
    },
    {
      name: 'not-to-dev-dep',
      severity: 'error',
      comment: 'Production code imports a devDependency. Move it to dependencies or keep it in test code.',
      from: { path: '^packages/[^/]+/src', pathNot: '\\.(test|spec)\\.[jt]sx?$' },
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only', 'triple-slash-type-reference'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
  },
};
