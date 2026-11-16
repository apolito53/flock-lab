# Flock Lab

**The canonical home for our swarm-behavior experiments, from 2D flocking to 3D autonomous systems.**

Flock Lab is a place to investigate how many independent agents can produce coherent, expressive collective motion through local interactions. The experiments begin with Reynolds-style flocking, then add elected leaders, leader gravity, environmental influences, alternative movement models, and eventually full 3D simulation.

## Current experiment

### 2D Flocking & Leadership Explorer

The current browser experiment lives at [`experiments/2d-flocking/`](./experiments/2d-flocking/).

It includes:
- Alignment, cohesion, and separation with independent controls.
- Random, vanguard, and weighted Director leader election.
- Shared-heading and leader-wake follower behaviors.
- Independent leader gravity strength and radius.
- A leader-only momentum toggle. Followers retain inertia when the leader switches to direct steering.
- Population, crosswind, pointer repulsion, startle, pause, and directional-coherence controls.

The previous hosted preview remains available at [The Flock Lab on Nova Projects](https://nova-projects-xi.vercel.app/projects/2026-11-16-the-flock-lab).

## Repository map

- `experiments/2d-flocking/` — current 2D interactive sandbox and experiment notes.
- `docs/behavior-model.md` — behavior model, steering layers, and current assumptions.
- `docs/roadmap.md` — staged direction for 3D and GPU-accelerated work.
- `references/README.md` — related projects and technical references.

## Working principles

1. Keep experiments inspectable. Prefer small controls that isolate one behavior at a time.
2. Preserve baselines. New forces and movement models should be independently switchable and comparable.
3. Keep individual agents individual. Collective behavior should emerge from local rules and shared influences, not from secretly animating a single blob.
4. Separate behavior from simulation scale and rendering. A 2D CPU prototype, a 3D CPU prototype, and a WebGPU implementation should share concepts without being forced into one architecture.
5. Preserve working experiments and their notes. This repository is the long-term home for the work.

## Run the current 2D experiment

No build step or external dependency is required. Open `experiments/2d-flocking/index.html` in a modern browser, or serve the repository root locally:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000/experiments/2d-flocking/`.

## 3D direction

The 3D work will extend agent state and neighborhood behavior into XYZ space, then explore GPU compute and rendering. The existing [WebGPU Particle Lab](https://github.com/apolito53/web-gpu-lab) is a technical reference for raw WebGPU compute, WGSL, storage buffers, 3D projection, trails, profiling, and large particle workloads. It is a reference point, not a claim that its current particle simulation already implements flocking.

See [the roadmap](./docs/roadmap.md) before choosing the next implementation step.
