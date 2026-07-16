export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'api',
        'worker',
        'web',
        'shared',
        'db',
        'config',
        'ci',
        'docs',
        'deps',
        'release',
        'crawler-core',
        'seo-engine',
        'schema-engine',
      ],
    ],
  },
};
