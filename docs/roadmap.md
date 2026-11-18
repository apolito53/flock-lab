# Roadmap

The roadmap is exploratory. Each stage should produce a playable, measurable experiment before adding another layer.

## 1. Consolidate the 2D behavior lab

- Preserve the current 2D baseline and all independent controls.
- Compare heading-following, wake-following, and leader gravity under repeatable conditions.
- Add simple obstacle fields to observe splitting, bottleneck pressure, and regrouping.
- Explore leader succession, temporary subgroup leaders, and multiple interacting swarms.
- Improve diagnostics: local density, average speed, group spread, leader distance, and subgroup count.

## 2. Build a 3D CPU prototype

The [3D Swarm Observatory](../experiments/3d-flocking/) implements this stage as an external observation experiment.

- Extend position, velocity, heading, and steering vectors from XY to XYZ.
- Add a camera that can orbit, pan, zoom, and inspect the swarm from any angle.
- Give leader gravity a spherical influence volume.
- Test 3D alignment, cohesion, separation, leader influence, and inertia with modest populations.
- Keep simulation rules independent from rendering and input.

## 3. Move the 3D simulation to WebGPU

Use [WebGPU Particle Lab](https://github.com/apolito53/web-gpu-lab) as a technical reference for compute passes, WGSL, storage buffers, explicit bind groups, rendering, trails, profiling, and benchmarking.

Likely GPU work:
- Ping-pong agent-state buffers for position and velocity.
- Compute passes for spatial-cell assignment, neighborhood ranges, and steering updates.
- Spatial hashing or a uniform grid to avoid all-pairs neighbor scans at scale.
- Separate behavior parameters from rendering parameters.
- Deterministic benchmark scenarios and GPU timestamp measurements.

The existing Particle Lab is a particle simulation and rendering reference; it is not assumed to already contain a boids neighbor-search or multi-agent behavior system.

## 4. Explore richer collective systems

- Multiple populations with different movement and interaction rules.
- Parent swarms and temporary local leaders.
- Environmental fields, obstacles, corridors, and moving attractors.
- Predators, targets, formations, and role-based agents.
- Large-scale density and flow visualization.

## 5. Downstream applications

The core should remain a general-purpose swarm and agent simulation playground. Zombie hordes, crowds, schools of fish, autonomous formations, and possible zero-G fleet experiments can become separate applications of the same ideas rather than being baked into the core model.
