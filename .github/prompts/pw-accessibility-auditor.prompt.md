---
mode: agent
description: Add automated accessibility checks with @axe-core/playwright — scoped scans, severity triage, WCAG mapping, and an honest coverage caveat.
tools: ['codebase', 'search', 'editFiles', 'runCommands']
---

# PW Accessibility Auditor

Add accessibility checks for: `${input:target:Which page or component should I audit?}`

Conventions are in `.github/instructions/playwright-framework.instructions.md`. These
checks are the **floor** — axe catches roughly a third of real issues. Never claim a
page is "fully accessible".

## Prerequisite: the dependency is not installed

`@axe-core/playwright` is **not** in `package.json`. Say so before writing code, and
give the command:

```bash
npm i -D @axe-core/playwright
```

Everything here is a `devDependency` — nothing ships. Do not silently import a package
that is absent; the spec fails at collection and looks like a framework problem.

## Framework fit

- Spec under `src/tests/`, e.g. `src/tests/a11y/`.
- Import `test` from `@fixtures/test-base`; take both the state fixture and `page` —
  `AxeBuilder` needs the raw `Page`, the fixture gets you to the screen without
  re-doing login.
- Reach the page via `open()` or a state fixture, never a literal URL.
- **Scan after the page is ready** — call the POM's `assertLoaded()` first. Scanning a
  half-rendered DOM yields violations that vanish on re-run.
- TTACart marks elements with `data-test`, not ARIA. Expect real findings around names,
  roles and labels. Those are the point, not false positives.

## Workflow

1. **Run `AxeBuilder`** after a web-first readiness assertion.
2. **Scope the scan** — `.include()` / `.exclude()`; tag rules (`wcag2a`, `wcag2aa`).
3. **Triage by impact** — gate on `critical` + `serious`; record `moderate`/`minor` as
   tracked debt, do not silently pass or fail the build on cosmetics.
4. **Map to WCAG** using the `tags` and `helpUrl` axe returns — surface the success
   criterion so it is actionable.
5. **Attach the full report** with `testInfo.attach` so the custom reporter carries it.
6. **State the coverage gap** — keyboard, focus order, screen reader and cognitive
   checks need a human.

## Shape

```typescript
test('inventory has no critical or serious violations', async ({ page, loginWithInventory }, testInfo) => {
    await loginWithInventory.assertLoaded();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

    await testInfo.attach('axe-results', {
        body: JSON.stringify(results.violations, null, 2),
        contentType: 'application/json',
    });

    const blocking = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious');
    expect(blocking.map((v) => `${v.id} (${v.impact}) — ${v.helpUrl}`)).toEqual([]);
});
```

## Do not

- Write the import before telling the engineer to install the package.
- Fabricate WCAG criteria — use what axe actually returns.
- Scan before the DOM settles.
- Add `data-test` attributes as an accessibility fix. They are test hooks and give an
  element no accessible name.
- Claim the page is accessible because axe passed.
