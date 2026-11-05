# TNOS · Companion presentation

This repository serves the public-facing working presentation for Tranquility Neuro Operating System, linked to [GitHub Sponsors](https://github.com/sponsors/jubicudis).

## Design authority

The authority is **TNOS — GitHub Sponsors Introduction (Working Template), v3.9, updated November 5, 2026** and the inventor's subsequent explicit corrections. The published script is authored from **Part I (public introduction)**. Part II is a private audit and must not be published into this repository.

The working master is **incomplete and pending inventor review**. A functioning website does not mean the narration, graphic design, or all capabilities have been approved.

Implementation history does not grant design authority. A rejected implementation must not be carried forward as an implicit requirement. A technical shortcut, visual element, or scene geometry is disposable unless grounded in the paper and accepted by the inventor.

## Presentation constraints

- Violet represents the TNOS interface as a presenter. The website is a scripted presentation, **not** a functioning TNOS AI or the native operating system.
- The presentation uses one experience-state authority. Narration, diagrams, cue progression, interruption, and return consume that state; a pending request does not count as an established result.
- Guided talk and free exploration exist in the **same** environment. An interrupted talk retains its exact cue position and paused state.
- Scene concepts are source-linked: Tranquility's origin, the intended user experience, exactly two reference frames (physical machine / runtime), the TranquilSpeak + mathematics relationship **between** those frames, stages 1–9 with stage 9 feeding a subsequent stage 4 computation, the Workbench, the MCP server, and independently qualified development milestones.
- The Workbench and MCP server are **separate development efforts**, not required to function as one integrated product with the native OS. Their demonstrated implementation statuses are not interchangeable.
- The current scene drawings are **review-only visual realizations** of those source relationships, not a final inventor-approved Violet appearance or a claim of successful native computation.
- No visitor camera, microphone, account, analytics, or user data collection is needed. Browser speech synthesis is optional and user-initiated.

## Technical responsibilities

- `site/content.mjs`: public-draft source-linked passages and subjects; no invented claims.
- `site/state.mjs`: presentation state, qualifying observations, pause, interrupt, return, and exploration.
- `site/app.mjs`: renders source relationships in the stage and observes **only the website's own caption/layout and stage drawing**. This is **not** OpenCV verification, TNOS sensor data, or proof the visitor understands.
- `site/styles.css`: desktop/mobile presentation styling; reduced-motion preference.
- `tests/presentation.test.mjs`: source/state regression tests.

Three.js renders the source-linked spatial explanation when available; a Canvas 2D rendering of the **same relationships** is the fallback. A visual command is not an independently verified visual observation; browser render qualification is deliberately narrow.

## Review and limitations

This is a current implementation of **specified presentation capabilities**, not the final production design. Specific forms for Violet and final stage geometry remain subject to inventor review. Do not introduce arbitrary scenes, objects, metaphors, demonstration data, or unsupported capabilities to fill those undecided details.

The final TNOS operating-system product remains under development; the website does not imply native stages 1–9 have been verified end-to-end. Native kernel/ISO and QEMU boot statements use the evidence qualifications in the working introduction.

No changes are made to the GitHub Sponsors profile by this repository. Links direct visitors to the separate Sponsors page.

To run the site locally, use a static HTTP server (e.g. `python3 -m http.server 8000`) from the repository root. For source and reducer tests use `node --test tests/presentation.test.mjs`. Browser-based visual acceptance must be performed separately; passing tests does not approve the design.
