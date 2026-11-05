# State propagation acceptance study — not the finished TNOS website

This interactive page is a **focused, source-grounded proof of one required communication capability**, not a separate product, a revised TNOS specification, or a replacement for the complete GitHub Sponsors narrative.

## Authoritative source

`TNOS_GitHub_Sponsors_Introduction_Working(20261105-161625).md` is the working master. The public narrative in Part I is still pending inventor review. No private Part II implementation notes, formulas, paths, or audit material are copied into this public page.

The scene uses these established **public-draft** ideas as its requirements:

| Working introduction | Requirement made visible in this scene |
| --- | --- |
| Part I §2, "How and Why I Started TNOS" | Missing information and unsupported inference are not silently treated as known. |
| Part I §3, "An Operating System Built Around a Different Approach to AI" | An external environmental event can change what the computational system is permitted to conclude, without a new chat message. |
| Part I §3, "TranquilSpeak and Contextual Computing" | A measured value is tied to its source, revision, interpretation and relevant context instead of simply being displayed. |
| Part I §3, "The Nine-Stage Cognitive Architecture" | A request, an actual result, its observation, and subsequent feedback are **distinct responsibilities**. This study illustrates the distinction without asserting execution of the native nine-stage stack. |
| Part I §3, "TNOS Workbench" | An engineering environment needs to make interacting components and causes understandable; the model exposes its own evidence and state transitions. |
| Part I §4, "Why Sponsorship Matters" | The public site can support informed sponsorship only after communicating the work and its limits. |

This page intentionally attempts to satisfy the **context-preserving, outcome-aware, state-dependent** goals of the website. It is a substantive visual interaction test, not a generic website hero, a chat box, or a collection of decorative interconnections.

## The one source of truth

`state.mjs` is the authority for an independent browser simulation. The scene, Violet's captions, the evidence display, and action permission are consumers of that same state.

1. A visitor opens/closes a model doorway, treated as an **environment event** distinct from a chat request.
2. The browser scene updates its **physical model** toward the new angle. Previously admitted computational permission is invalidated immediately.
3. An observer reads the scene's modeled angle. If the reading is current, sourced and within the permitted tolerance, it is admitted. Stale readings and unsupported sources are rejected.
4. The resulting **computational model** derives a passage permission from that admitted state and its relevant contextual record.
5. A requested crossing may proceed only when the current grounded permission allows it.
6. Completing a request is **not** assumed. A later observed model position qualifies the result, which changes feedback used in the next state.

The geometry is semantically tied to these facts: a hinged door, a corridor, a crossing marker, and a connection that only establishes itself when evidence is admitted. It is not a claim that the browser is a physical TNOS computer.

The page loads Three.js for the spatial rendering, with a local Canvas renderer when that dependency or WebGL is unavailable. The observation reads the **scene model pose**, not an external camera, physical sensor or pixel verification. The code cannot infer the visitor's understanding or sponsorship intent.

## Evaluate

Start a local static server from the repository root, e.g. `python3 -m http.server 8000`, then open `http://localhost:8000/state-study/`.

Run `node --test tests/state-study.test.mjs` for the eight tests covering denied action before observation, stale-revision rejection, changed authorization, requested-versus-observed action, feedback, contextual provenance, and invalid source rejection.

**Do not infer the visual design is approved from the passing model tests.** The next decision is an inventor evaluation of the actual causal scene. The current root homepage remains a separate previous working prototype until this study is accepted or corrected.

## Publication status

This folder is a clearly labeled experimental presentation study. It does not publish the private working master or claim the full TNOS system, Workbench, or MCP server is functioning within the browser. It does not claim that the layout, expressive form of Violet, or full opening presentation has been accepted.
