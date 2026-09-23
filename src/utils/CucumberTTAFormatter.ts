/**
 * Cucumber formatter that feeds CustomReporter, so BDD runs get the same
 * tta-report HTML as Playwright runs. Each scenario is a "test", its feature a
 * "describe", and each Given/When/Then a "test.step". Hooks are left out.
 */
import { Formatter, IFormatterOptions } from '@cucumber/cucumber';
import type * as messages from '@cucumber/messages';
import CustomTTAReporter from './CustomReporter';

const ms = (d?: { seconds: number; nanos: number }): number =>
    d ? Math.round(d.seconds * 1000 + d.nanos / 1e6) : 0;

const STATUS: Record<string, string> = {
    PASSED: 'passed',
    FAILED: 'failed',
    UNDEFINED: 'failed',
    AMBIGUOUS: 'failed',
    SKIPPED: 'skipped',
    PENDING: 'skipped',
    UNKNOWN: 'skipped',
};

export default class CucumberTTAFormatter extends Formatter {
    // The reporter only reads the fields its Playwright types name, so plain
    // objects shaped like TestCase/TestResult/TestStep are enough — hence `any`.
    private reporter: any = new CustomTTAReporter();
    private testCaseCount = 0;
    private began = false;
    private tests = new Map<string, any>();
    private stepStarts = new Map<string, number>();

    constructor(options: IFormatterOptions) {
        super(options);
        options.eventBroadcaster.on('envelope', (e: messages.Envelope) => this.onEnvelope(e));
    }

    private onEnvelope(e: messages.Envelope): void {
        if (e.testCase) this.testCaseCount++;
        else if (e.testCaseStarted) this.onTestCaseStarted(e.testCaseStarted);
        else if (e.testStepStarted) this.stepStarts.set(e.testStepStarted.testStepId, ms(e.testStepStarted.timestamp));
        else if (e.testStepFinished) this.onTestStepFinished(e.testStepFinished);
        else if (e.testCaseFinished) this.onTestCaseFinished(e.testCaseFinished);
    }

    private onTestCaseStarted(started: messages.TestCaseStarted): void {
        if (!this.began) {
            this.began = true;
            const config = { projects: [{ name: 'chromium (cucumber)' }], workers: 1 };
            this.reporter.onBegin(config, { allTests: () => ({ length: this.testCaseCount }) });
        }
        const { pickle, gherkinDocument } = this.eventDataCollector.getTestCaseAttempt(started.id);
        const scenario = this.findScenario(gherkinDocument, pickle.astNodeIds[0]);
        const test = {
            id: started.id,
            title: pickle.name,
            location: { file: pickle.uri, line: scenario?.location.line ?? 0 },
            parent: { title: gherkinDocument.feature?.name ?? pickle.uri, type: 'describe' },
            tags: pickle.tags.map(t => t.name),
        };
        this.tests.set(started.id, test);
        this.reporter.onTestBegin(test);
    }

    private onTestStepFinished(finished: messages.TestStepFinished): void {
        const attempt = this.eventDataCollector.getTestCaseAttempt(finished.testCaseStartedId);
        const testStep = attempt.testCase.testSteps.find(s => s.id === finished.testStepId);
        const pickleStep = attempt.pickle.steps.find(s => s.id === testStep?.pickleStepId);
        const result = finished.testStepResult;
        // Hooks aren't Gherkin steps; skipped steps never ran (the reporter would show them as passed).
        if (!pickleStep || STATUS[result.status] === 'skipped') return;

        const keyword = this.findStepKeyword(attempt.gherkinDocument, pickleStep.astNodeIds[0]);
        const failed = STATUS[result.status] === 'failed';
        this.reporter.onStepEnd(this.tests.get(finished.testCaseStartedId), {}, {
            category: 'test.step',
            title: `${keyword}${pickleStep.text}`,
            duration: ms(result.duration),
            startTime: new Date(this.stepStarts.get(finished.testStepId) ?? Date.now()),
            error: failed ? { message: result.message ?? result.status, stack: result.exception?.stackTrace } : undefined,
        });
    }

    private onTestCaseFinished(finished: messages.TestCaseFinished): void {
        const attempt = this.eventDataCollector.getTestCaseAttempt(finished.testCaseStartedId);
        const worst = attempt.worstTestStepResult;
        const status = STATUS[worst.status] ?? 'skipped';
        const duration = attempt.testCase.testSteps
            .reduce((sum, s) => sum + ms(attempt.stepResults[s.id]?.duration), 0);

        const all = Object.values(attempt.stepAttachments).flat();
        const attachments: object[] = all
            .filter(a => a.mediaType.startsWith('image/'))
            .map((a, i) => ({
                name: a.fileName ?? `screenshot-${i + 1}`,
                contentType: 'image/png',
                body: Buffer.from(a.body, a.contentEncoding === 'BASE64' ? 'base64' : 'utf-8'),
            }));
        // hooks.ts attaches video/trace as file paths; reshape to what CustomReporter copies.
        for (const a of all.filter(a => a.mediaType === 'text/uri-list')) {
            if (a.fileName === 'video') attachments.push({ name: 'video', contentType: 'video/webm', path: a.body });
            if (a.fileName === 'trace') attachments.push({ name: 'trace', contentType: 'application/zip', path: a.body });
        }

        this.reporter.onTestEnd(this.tests.get(finished.testCaseStartedId), {
            status,
            duration,
            retry: attempt.attempt,
            attachments,
            error: status === 'failed' ? { message: worst.message ?? worst.status, stack: worst.exception?.stackTrace } : undefined,
            stdout: [],
            stderr: [],
        });
    }

    async finished(): Promise<void> {
        if (this.began) await this.reporter.onEnd({});
        await super.finished();
    }

    // Scenarios and steps can sit under a Rule or a Background; walk them all.
    private *children(doc: messages.GherkinDocument): Generator<messages.FeatureChild | messages.RuleChild> {
        for (const child of doc.feature?.children ?? []) {
            yield child;
            if (child.rule) yield* child.rule.children;
        }
    }

    private findScenario(doc: messages.GherkinDocument, id: string): messages.Scenario | undefined {
        for (const c of this.children(doc)) if (c.scenario?.id === id) return c.scenario;
        return undefined;
    }

    private findStepKeyword(doc: messages.GherkinDocument, id: string): string {
        for (const c of this.children(doc)) {
            const step = (c.scenario ?? c.background)?.steps.find(s => s.id === id);
            if (step) return step.keyword;
        }
        return '';
    }
}
