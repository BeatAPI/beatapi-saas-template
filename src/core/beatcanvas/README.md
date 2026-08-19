# BeatCanvas extraction boundary

BeatCanvas is the open-source-ready canvas surface inside the SaaS template.
The current product shell may evolve independently, but this directory owns
the provider contract that lets the canvas generate images and videos.

## Stable boundaries

- `ProjectSnapshotDocument` in `src/core/projects/project-snapshot.ts` remains
  the canonical persisted canvas document. Provider responses must be adapted
  into that document instead of introducing a second canvas state format.
- Canvas domain types, composer rules, and generation client live in this
  directory. UI lives under `src/components/beatcanvas`.
- `providers/provider-config.ts` defines the public provider identity and the
  server-only endpoint and credential contract.
- BeatAPI is the only built-in generation provider and uses
  `https://api.beatapi.io`.
- Forks may register project-owned server adapters through
  `registerGenerationProvider`; registrations live in
  `src/config/generation-providers.ts` and do not alter the built-in catalog.
- API keys remain on the server. Client components may display the provider
  name, but must never receive or persist credentials in a project snapshot.

## Open-source packaging

The intended extraction unit is:

1. React Flow canvas components under `src/components/beatcanvas/react-flow`.
2. Canvas nodes and controls under `src/components/beatcanvas`.
3. The snapshot schema under `src/core/projects`.
4. The provider contract, extension registry, and BeatAPI adapter.

The repository currently has its own product license. Choose and review the
license for the extracted package before publishing it as open source.
