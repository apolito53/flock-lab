# The Flock Lab

**Flock Lab · Experiment 01 · 2D flocking and leadership**

A deliberately plain, standalone playground for the local-neighbor flocking system from [The Space Between Wings](https://github.com/apolito53/nova-projects/tree/main/projects/2026-11-11-the-space-between-wings). The birds have become dots and the twilight landscape has become a square field, leaving the behavior easy to inspect.

The original local rules remain: alignment, cohesion, and separation. Their controls are independent. Population, horizontal crosswind, pointer disturbance, scatter, pause, and directional coherence remain available. All ordinary agents retain inertial velocity integration.

## Leadership experiment

The character marker is a draggable destination. When leadership is enabled, the selected leader steers toward that marker and followers receive an additional influence while retaining their ordinary local rules.

- **None:** the original flocking baseline; no agent has special status.
- **Random:** choose one agent at random. It remains selected until another election or a new flock.
- **Vanguard:** choose the agent nearest the character. Re-evaluate periodically, but retain the incumbent unless another agent is meaningfully closer to prevent rapid leader churn.
- **Director:** choose a leader using a simple weighted score: proximity to the character (50%), current heading toward the character (35%), and nearby group support (15%). Re-evaluate periodically with a small incumbent advantage. This is an intentionally provisional Director policy; it does not yet inspect obstacles or global route quality.

## Leader momentum

The **Leader momentum** toggle affects only the currently elected leader. When enabled, it uses ordinary inertial velocity integration. When disabled, the leader recomputes its heading directly from its objective and current local influences, including alignment, cohesion, separation, wind, boundary avoidance, pointer disturbance, and a brief Startle pulse. Its cruising speed remains steady. Every follower continues using inertial integration, so the swarm responds to the leader’s sharper turns with its own natural turning lag. The control is unavailable while no leader is elected.

## Leader gravity

Leader gravity is a separate force from directional influence. Every follower inside the configurable radius receives an inward acceleration toward the elected leader's current position. The pull uses a smooth falloff to zero at the radius and is softened very close to the leader; ordinary separation pushes back at close range, so the group can gather around a moving center without occupying one point. A faint dashed ring shows the active radius.

The default gravity strength is 55% with a 760 px radius. Set directional influence to zero to isolate the gravitational behavior, or combine the forces to see how they interact. Both gravity strength and radius can be adjusted while the simulation runs.

Two follower styles can be compared:

- **Shared heading:** followers blend the leader's current velocity into their own steering, while still aligning with nearby agents and maintaining separation/cohesion.
- **Leader wake:** followers are gently drawn toward a broad trailing corridor behind the leader. Their existing lateral offset is mostly retained so the result is not a single-file queue.

Directional influence and leader gravity are independently adjustable. The leader itself receives a modest steering force toward the character. Drag the ringed leader to perturb its position, drag the outlined character marker to redirect the horde, or move elsewhere in the field to repel nearby agents. The checked **Cursor repulsion** toggle can disable pointer-driven repulsion without affecting leader dragging, character dragging, or the Startle the flock button.

This is an exploration instrument, not a finished horde controller or a faithful model of any particular game's AI. It is intended to compare the feel of collective direction, literal following, and decentralized flocking before choosing what belongs in Greyline.

Everything lives in one self-contained HTML file. No external assets, libraries, APIs, audio, or tracking.


## Canonical source

This experiment is maintained in the [Flock Lab repository](https://github.com/apolito53/flock-lab). The earlier hosted preview remains at [Nova Projects](https://nova-projects-xi.vercel.app/projects/2026-11-16-the-flock-lab).
