/**
 * js/physics.js
 * Pure physics calculations — no DOM / React / Three.js dependencies.
 * Depends on THREE being loaded first (only for Vector3 in position helpers).
 *
 * Constants: g = 9.8 m/s², m = 1 kg, r = 1 m (all objects share these values)
 *
 * Exported as window.Physics
 */
window.Physics = (function () {
  const G = 9.8, M = 1, R = 1;

  // ─────────────────────────────────────────────────────────────────────────
  // Moment of inertia
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Calculate moment of inertia I for rolling objects.
   * @param {'solid_sphere'|'hollow_sphere'|'solid_cyl'|'hollow_cyl'} type
   * @param {number} x  hollow ratio (inner radius / outer radius), used for hollow types
   * @returns {number}  I in kg·m²
   *
   * Derivations:
   *   Solid sphere:   I = 2/5 · MR²
   *   Hollow sphere:  I = 2/5 · MR² · (1 − x⁵)/(1 − x³)
   *   Solid cylinder: I = 1/2 · MR²
   *   Hollow cylinder:I = 1/2 · MR² · (1 − x⁴)/(1 − x²)
   */
  function calcInertia(type, x) {
    switch (type) {
      case 'solid_sphere':  return (2/5) * M * R * R;
      case 'hollow_sphere': return (2/5) * M * R * R * (1 - Math.pow(x, 5)) / (1 - Math.pow(x, 3));
      case 'solid_cyl':     return (1/2) * M * R * R;
      case 'hollow_cyl':    return (1/2) * M * R * R * (1 - Math.pow(x, 4)) / (1 - Math.pow(x, 2));
      default: return 0;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Kinematics
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Downhill vertical displacement as a function of time.
   *   y(t) = c · sin²θ · t² / 2
   * where c = mr²g / (mr² + I)  (effective linear acceleration coefficient)
   *
   * Derived from: mgh = ½mv²(1 + I/(mr²)) with no-slip v = rω
   */
  function calcYDown(t, I, theta) {
    const c = (M * R * R * G) / (M * R * R + I);
    const s = Math.sin(theta);
    return c * s * s * t * t / 2;
  }

  /**
   * Uphill net vertical displacement (clamped to ≥ 0).
   *   Y(t) = V·t·sinθ − y(t)
   * where y(t) is the deceleration term (same formula as downhill).
   */
  function calcYUp(t, I, theta, V) {
    const raw = V * t * Math.sin(theta) - calcYDown(t, I, theta);
    return Math.max(0, raw);
  }

  /**
   * Uphill stop time — when Y(t) = 0 after the peak:
   *   t_stop = V·sinθ / (c · sin²θ) = V·(mr² + I) / (mr²·g·sinθ)
   */
  function calcStopTime(I, theta, V) {
    const c = (M * R * R * G) / (M * R * R + I);
    const s = Math.sin(theta);
    return (V * s) / (c * s * s);
  }

  /**
   * Cumulative rotation angle k(t) in radians (no-slip condition: arc = rθ).
   *   k(t) = y_vert(t) / (r · sinθ)
   */
  function calcK(t, I, theta, isUphill, V) {
    const y = isUphill ? calcYUp(t, I, theta, V) : calcYDown(t, I, theta);
    return y / (Math.sin(theta) * R);
  }

  /**
   * Find the time T at which y(T) = H (downhill) using binary search.
   * Needed because y(t) has no closed-form inverse for general I.
   */
  function calcMaxTimeDown(I, theta, H) {
    const c = (M * R * R * G) / (M * R * R + I);
    const s = Math.sin(theta);
    let t  = Math.sqrt(Math.max((2 * H) / (c * s * s), 0.01));
    let lo = t * 0.99, hi = t * 1.05;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (calcYDown(mid, I, theta) < H) lo = mid; else hi = mid;
    }
    return hi;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3-D position helpers (require THREE)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Object centre position on the slope — returns THREE.Vector3.
   * Slope coordinate system:
   *   Downhill: x_c = s·cosθ + r·sinθ,  y_c = −s·sinθ + r·cosθ
   *   Uphill:   x_c = s·cosθ − r·sinθ,  y_c =  s·sinθ + r·cosθ
   * where s = arc-length along slope = y_vert / sinθ
   */
  function getPos(t, I, maxT, z, theta, isUphill, H, V) {
    const cosT = Math.cos(theta), sinT = Math.sin(theta);
    const tc = Math.min(t, maxT);
    if (isUphill) {
      const Y = calcYUp(tc, I, theta, V);
      const s = Y / sinT;
      return new THREE.Vector3(s * cosT - R * sinT, s * sinT + R * cosT, z);
    } else {
      const y = Math.min(calcYDown(tc, I, theta), H);
      const s = y / sinT;
      return new THREE.Vector3(s * cosT + R * sinT, -s * sinT + R * cosT, z);
    }
  }

  /**
   * Contact-point (cycloid trace) position — returns THREE.Vector3.
   * Derived from rotating the contact point around the moving centre:
   *   x_p = x_c + r·sinθ·(1−cos k) − r·cosθ·sin k   (downhill)
   *   y_p = y_c + r·cosθ·(1−cos k) + r·sinθ·sin k
   */
  function getPtPos(t, I, z, theta, isUphill, H, V) {
    const cosT = Math.cos(theta), sinT = Math.sin(theta);
    const k = calcK(t, I, theta, isUphill, V);
    const sinK = Math.sin(k), cosK = Math.cos(k);
    if (isUphill) {
      const Y = calcYUp(t, I, theta, V);
      const s = Y / sinT;
      return new THREE.Vector3(
        s * cosT - R * sinT * (1 - cosK) - R * cosT * sinK,
        s * sinT + R * cosT * (1 - cosK) - R * sinT * sinK,
        z
      );
    } else {
      const y = Math.min(calcYDown(t, I, theta), H);
      return new THREE.Vector3(
        y / Math.tan(theta) + R * sinT * (1 - cosK) - R * cosT * sinK,
        -y + R * cosT * (1 - cosK) + R * sinT * sinK,
        z
      );
    }
  }

  return { G, M, R, calcInertia, calcYDown, calcYUp, calcStopTime, calcK, calcMaxTimeDown, getPos, getPtPos };
})();
