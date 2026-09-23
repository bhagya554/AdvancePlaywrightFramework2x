// tsx, not ts-node: ts-node needs TypeScript's JS API, which TypeScript 7 no longer ships.
process.env.TSX_TSCONFIG_PATH = process.env.TSX_TSCONFIG_PATH || 'src/cucumber/tsconfig.json';

// Exactly one hooks file may load. CUCUMBER_ARTIFACTS=1 swaps in the variant
// that records video/trace/screenshot for the TTA report.
const support = [
    'src/cucumber/support/world.ts',
    process.env.CUCUMBER_ARTIFACTS
        ? 'src/cucumber/support/hooks_customreporter_video_trace_screenshot.ts'
        : 'src/cucumber/support/hooks.ts',
];

const common = {
    requireModule: ['tsx/cjs'],
    format: ['progress-bar', 'html:reports/cucumber/report.html', 'summary', './src/utils/CucumberTTAFormatter.cjs'],
    formatOptions: { snippetInterface: 'async-await' },
    publishQuiet: true,
};

module.exports = {
    default: {
        ...common,
        require: [...support, 'src/cucumber/**/steps/**/*.ts'],
        paths: ['src/cucumber/**/features/**/*.feature'],
    },
    level0: {
        ...common,
        require: [...support, 'src/cucumber/level-00-installation/steps/**/*.ts'],
        paths: ['src/cucumber/level-00-installation/features/**/*.feature'],
    },
    level1: {
        ...common,
        require: [...support, 'src/cucumber/level-01-basic/steps/**/*.ts'],
        paths: ['src/cucumber/level-01-basic/features/**/*.feature'],
    },
    level2: {
        ...common,
        require: [
            ...support,
            'src/cucumber/level-01-basic/steps/**/*.ts',
            'src/cucumber/level-02-data-driven/steps/**/*.ts',
        ],
        paths: ['src/cucumber/level-02-data-driven/features/**/*.feature'],
    },
};