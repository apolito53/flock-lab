# Flock Lab

**The canonical home for our swarm-behavior experiments, from 2D flocking to 3D autonomous systems.**

Flock Lab is a place to investigate how many independent agents can produce coherent, expressive collective motion through local interactions. The experiments begin with Reynolds-style flocking, then add elected leaders, leader gravity, environmental influences, alternative movement models, and full 3D simulation.

## Current experiments

### Crosswake

[Play Crosswake](./experiments/fleet-combat/). Watch 18 Meridian fighters meet 18 Vesper fighters around the wreck of the Pale Sun. Each fleet flies in three autonomous wings using the observatory’s flocking model. Order Meridian to engage, split wings, or rally to recharge shields. Orbit, pause, or replay the same starting encounter.

### 3D Swarm Observatory

[Enter the 3D experiment](./experiments/3d-flocking/). The observation camera orbits, pans, and zooms around autonomous XYZ boids. Top and side views use orthographic projection. A single leader flies a climbing figure-eight. Its spherical gravity has adjustable strength and range. Disable leadership for a local-rules baseline, or disable only the leader’s momentum to compare its steering. Pause, scatter, replay the seed, or inspect world-space trails and the live heading agreement, RMS radius, and mean speed.

### 2D Flocking & Leadership Explorer

The original browser experiment lives at [`experiments/2d-flocking/`](./experiments/2d-flocking/).

It includes:
- Alignment, cohesion, and separation with independent controls.
- Random, vanguard, and weighted Director leader election.
- Shared-heading and leader-wake follower behaviors.
- Independent leader gravity strength and radius.
- A leader-only momentum toggle. Followers retain inertia when the leader switches to direct steering.
- Population, crosswind, pointer repulsion, startle, pause, and directional-coherence controls.

The previous hosted preview remains available at [The Flock Lab on Nova Projects](https://nova-projects-xi.vercel.app/projects/2026-11-16-the-flock-lab).

## Repository map

- `experiments/2d-flocking/` — original 2D interactive sandbox and experiment notes.
- `experiments/3d-flocking/` — 3D CPU simulation, observer camera, and controls.
- `experiments/fleet-combat/` — observer-controlled starfighter skirmishes.
- `docs/behavior-model.md` — behavior model, steering layers, and current assumptions.
- `docs/roadmap.md` — staged direction for 3D and GPU-accelerated work.
- `references/README.md` — related projects and technical references.

## Working principles

1. Keep experiments inspectable. Prefer small controls that isolate one behavior at a time.
2. Preserve baselines. New forces and movement models should be independently switchable and comparable.
3. Keep individual agents individual. Collective behavior should emerge from local rules and shared influences, not from secretly animating a single blob.
4. Separate behavior from simulation scale and rendering. A 2D CPU prototype, a 3D CPU prototype, and a WebGPU implementation should share concepts without being forced into one architecture.
5. Preserve working experiments and their notes. This repository is the long-term home for the work.

## Run the experiments

The experiments are buildless and have no external dependencies. Serve the repository root locally.

```bash
python -m http.server 8000
```

Visit `http://localhost:8000/` to choose an experiment, or go directly to `http://localhost:8000/experiments/3d-flocking/`.

## 3D direction

The CPU prototype extends agent state and neighborhood behavior into XYZ space. GPU compute and rendering remain a future scaling experiment. The existing [WebGPU Particle Lab](https://github.com/apolito53/web-gpu-lab) is a technical reference for raw WebGPU compute, WGSL, storage buffers, 3D projection, trails, profiling, and large particle workloads. It is a reference point, not a claim that its current particle simulation already implements flocking.

See [the roadmap](./docs/roadmap.md) before choosing the next implementation step.
