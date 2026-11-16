# Behavior model

This document describes the current 2D explorer. It is an experimental model, not a claim to reproduce any particular animal or game AI.

## Agent state

Each agent has a position, velocity, stable ID, individual cruising speed, and a few per-agent values for small variation and transient startle response.

The simulation calculates the next velocity for every agent before applying any position updates. This avoids update-order bias where agents later in the loop observe already-moved neighbors.

## Local flocking

Each agent observes neighbors within a fixed social radius. Three local influences are calculated independently:

- **Alignment:** steer toward the average heading of nearby agents.
- **Cohesion:** steer toward the average position of nearby agents.
- **Separation:** repel nearby agents inside a smaller personal-space radius.

The forces are intentionally simple and exposed as independent controls so their effects can be isolated.

## Leadership

Leadership is optional. With no leader elected, the simulation is the original decentralized flocking baseline.

- **Random:** choose one agent and retain it until manually re-elected or a new flock is created.
- **Vanguard:** choose the agent nearest the character marker. Re-evaluate periodically and require a meaningful distance advantage before replacing the incumbent.
- **Director:** score candidates using proximity to the character (50%), heading toward the character (35%), and nearby group support (15%). The current heuristic does not inspect obstacles or route quality.

The leader has its own steering objective: approach the draggable character marker.

## Follower influences

Followers retain their own local flocking and inertial movement. They may additionally receive:

- **Directional influence:** either blend toward the leader's heading or seek a broad wake behind it.
- **Leader gravity:** an inward acceleration toward the leader's current position, with smooth falloff across a configurable radius and softening close to the center.

Separation competes with leader gravity at close range. The intended result is a dense but spatially distributed group, not every agent occupying the leader's exact position.

## Leader momentum

The Leader Momentum toggle affects only the elected leader.

- **Enabled:** the leader uses inertial velocity integration, like the followers.
- **Disabled:** the leader recalculates its heading directly from its objective and current influences, then moves at its individual cruising speed.

In direct mode, the leader still considers local alignment, cohesion, separation, wind, boundary avoidance, cursor disturbance, and transient startle. Followers continue integrating their own velocities, so they naturally lag behind abrupt leader turns.

## Environment and interaction

The square field has soft boundary steering rather than wraparound. The character marker can be dragged to change the leader's objective. The leader can be dragged directly. Cursor repulsion is independently toggleable, while Startle applies a one-shot disturbance to the group.

## Known simplifications

- Neighbor queries use all-pairs comparisons. This is appropriate for the current few-hundred-agent experiment, but scales quadratically.
- The Director has no obstacle awareness or path planner.
- There is no physical body collision solver; separation is a steering influence.
- Leadership is single-level. Subgroups, leader succession after death, and multiple interacting populations remain future experiments.
- The 2D simulation is not yet a reusable engine module; it is intentionally self-contained for rapid experimentation.
