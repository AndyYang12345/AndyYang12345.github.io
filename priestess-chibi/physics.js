// Screen-plane disc physics. Rendering and model geometry stay independent of this solver.
export function springStep(body, dt, strength = 1) {
  body.sv += (-170 * body.squash - 8.5 * body.sv) * dt;
  body.squash += body.sv * dt;
  const limit = Math.min(.32, .21 * strength + .06);
  if (body.squash < -limit || body.squash > limit) {
    body.squash = Math.max(-limit, Math.min(limit, body.squash));
    body.sv *= -.25;
  }
}

export function kick(body, strength = 1, impact = 1) {
  body.sv -= Math.min(4.5, 2.6 * strength * impact);
}

function walls(b, bounds, restitution, react) {
  for (const [axis, velocity, extent] of [['x', 'vx', bounds.x], ['y', 'vy', bounds.y]]) {
    const limit = Math.max(0, extent - b.radius);
    if (Math.abs(b[axis]) <= limit) continue;
    const sign = Math.sign(b[axis]) || 1;
    b[axis] = sign * limit;
    if (sign * b[velocity] > 0) {
      const speed = Math.abs(b[velocity]);
      b[velocity] = -sign * speed * restitution;
      react?.(b, Math.min(1.6, .6 + speed * .18));
    }
  }
}

export function stepDiscs(bodies, dt, bounds, options, react) {
  const {edges = true, collide = false, restitution = .94, speed = 1, moving = true} = options;
  for (const b of bodies) {
    if (moving) { b.x += b.vx * dt * speed; b.y += b.vy * dt * speed; }
    if (edges) walls(b, bounds, restitution, react);
    else {
      // Leave the window completely before entering from the opposite side.
      if (b.x > bounds.x + b.radius) b.x = -bounds.x - b.radius;
      if (b.x < -bounds.x - b.radius) b.x = bounds.x + b.radius;
      if (b.y > bounds.y + b.radius) b.y = -bounds.y - b.radius;
      if (b.y < -bounds.y - b.radius) b.y = bounds.y + b.radius;
    }
  }
  if (!collide) return;
  // Several positional passes keep dense crowds stable; impulses only act on approaching pairs.
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const distance = Math.hypot(dx, dy), minimum = a.radius + b.radius;
      if (distance >= minimum) continue;
      const nx = distance > 1e-8 ? dx / distance : 1;
      const ny = distance > 1e-8 ? dy / distance : 0;
      const ia = 1 / a.mass, ib = 1 / b.mass, inverseMass = ia + ib;
      const overlap = minimum - distance + 1e-5;
      a.x -= nx * overlap * ia / inverseMass; a.y -= ny * overlap * ia / inverseMass;
      b.x += nx * overlap * ib / inverseMass; b.y += ny * overlap * ib / inverseMass;
      const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (relative < 0 && moving) {
        const impulse = -(1 + restitution) * relative / inverseMass;
        a.vx -= impulse * nx * ia; a.vy -= impulse * ny * ia;
        b.vx += impulse * nx * ib; b.vy += impulse * ny * ib;
        const impact = Math.min(1.8, .6 - relative * .15);
        react?.(a, impact); react?.(b, impact);
      }
    }
    if (edges) for (const b of bodies) walls(b, bounds, restitution, react);
  }
}
