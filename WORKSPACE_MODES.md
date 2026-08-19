# Workspace Modes

BeatAPI SaaS Template has one application shell and two workspace views.

| Mode | Best for | Route |
| --- | --- | --- |
| Studio | Guided, form-first generation | `/studio/:projectId` |
| Canvas | Multi-step node workflows | `/canvas/:projectId` |

Both modes share projects, snapshots, tasks, assets, credits, billing, authentication, and provider configuration. Switching the mode changes presentation only; it does not fork the backend or create a second dashboard.

The default is configured with `VITE_WORKSPACE_MODE`. Canvas is the default
experience. Each project stores its last active mode so project cards resume in
the correct view.
