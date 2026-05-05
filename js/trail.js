/**
 * js/trail.js
 * Cycloid contact-point trail rendering using chunked TubeGeometry.
 * Depends on: THREE (global), Physics (global)
 *
 * The trail is built incrementally:
 *   - Points are appended as time advances (forward playback).
 *   - Existing completed chunks are reused; only the active tail chunk is rebuilt.
 *   - On reverse playback the visible endpoint walks backward without re-tracing.
 *   - On direction flip, all meshes are discarded and rebuilt from history.
 *
 * Exported as window.TrailSystem
 */
window.TrailSystem = (function () {
  const DT      = 0.004;  // sample interval = timeStep / 5
  const CHUNK   = 48;     // points per completed chunk
  const OVERLAP = 4;      // extra points for smooth chunk joins
  const TUBE_R  = 0.06;   // tube radius in world units
  const TUBE_SEG = 7;     // tube radial segments

  // ── Cache factory ──────────────────────────────────────────────────────────

  /**
   * Create an empty per-object trail cache.
   * One cache object should exist per rolling object (solid, hollow…).
   */
  function mkCache() {
    return {
      allPts:          [],     // all sampled THREE.Vector3 points so far
      allTs:           [],     // corresponding time values
      lastT:           -1,     // last sampled time
      chunkStart:      0,      // index of first point in current tail
      completedMeshes: [],     // frozen chunk meshes already in scene
      currentMesh:     null,   // live tail mesh (rebuilt each frame change)
      prevTEnd:        -1,     // tEnd from last call (detect reverse)
      wasReverse:      false,  // direction state from last call
    };
  }

  // ── Geometry helpers ───────────────────────────────────────────────────────

  function removeMesh(m, trail) {
    if (!m) return;
    trail.remove(m);
    if (m.geometry) m.geometry.dispose();
    if (m.material) m.material.dispose();
  }

  /**
   * Build a TubeGeometry mesh from an array of THREE.Vector3 points.
   * Deduplicates coincident points to avoid CatmullRomCurve3 artefacts.
   * @returns {THREE.Mesh|null}
   */
  function buildTube(pts, color) {
    const clean = [pts[0]];
    for (let i = 1; i < pts.length; i++)
      if (pts[i].distanceTo(clean[clean.length - 1]) > 1e-5) clean.push(pts[i]);
    if (clean.length < 2) return null;
    try {
      const curve = new THREE.CatmullRomCurve3(clean, false, 'chordal', 0.5);
      const tSeg  = Math.max(clean.length * 2, 16);
      const geo   = new THREE.TubeGeometry(curve, tSeg, TUBE_R, TUBE_SEG, false);
      const mat   = new THREE.MeshPhongMaterial({ color, shininess: 90, emissive: color, emissiveIntensity: 0.2 });
      return new THREE.Mesh(geo, mat);
    } catch (e) { return null; }
  }

  // ── Main update ────────────────────────────────────────────────────────────

  /**
   * Update the trail for one object.  Must be called every time `time` changes.
   *
   * @param {string}       key      cache key: 'solid' | 'hollow' | 'cylinder' | 'hollowCyl'
   * @param {object}       cache    the full cache map returned by createCacheMap()
   * @param {THREE.Group}  trail    Three.js group that owns all trail meshes
   * @param {number}       I        moment of inertia for this object
   * @param {number}       maxT     simulation end time for this object
   * @param {number}       z        Z-offset (lane) for this object
   * @param {number}       color    hex colour for tube material
   * @param {number}       time     current simulation time
   * @param {object}       phy      { theta, isUphill, height, initSpeed }
   */
  function updateTrail(key, cache, trail, I, maxT, z, color, time, phy) {
    const { theta, isUphill, height, initSpeed } = phy;
    const tEnd = Math.min(time, maxT);
    const c    = cache[key];

    // ── Detect direction change ──
    const isReverse  = c.prevTEnd > tEnd + 1e-4;
    const dirChanged = isReverse !== (c.wasReverse ?? false) && c.prevTEnd >= 0;
    c.wasReverse = isReverse;
    c.prevTEnd   = tEnd;

    // ── On direction flip: clear all meshes, trim point history ──
    if (dirChanged) {
      c.completedMeshes.forEach(m => removeMesh(m, trail));
      removeMesh(c.currentMesh, trail);
      c.completedMeshes = []; c.currentMesh = null; c.chunkStart = 0;
      if (!isReverse && c.allTs.length > 0) {
        let cutIdx = c.allTs.length - 1;
        while (cutIdx > 0 && c.allTs[cutIdx] > tEnd + 1e-4) cutIdx--;
        c.allPts = c.allPts.slice(0, cutIdx + 1);
        c.allTs  = c.allTs.slice(0, cutIdx + 1);
        c.lastT  = c.allTs.length > 0 ? c.allTs[c.allTs.length - 1] : -1;
      }
    }

    // ── Forward: append new sample points ──
    if (!isReverse) {
      const startI = c.lastT < 0 ? 0 : Math.floor(c.lastT / DT) + 1;
      for (let i = startI; ; i++) {
        const t = i * DT;
        if (t > tEnd + 1e-9) break;
        c.allPts.push(Physics.getPtPos(Math.min(t, tEnd), I, z, theta, isUphill, height, initSpeed));
        c.allTs.push(Math.min(t, tEnd));
        c.lastT = Math.min(t, tEnd);
        if (t >= tEnd) break;
      }
      // Ensure exact endpoint is included
      if (c.allPts.length > 0) {
        const exactEnd = Physics.getPtPos(tEnd, I, z, theta, isUphill, height, initSpeed);
        if (exactEnd.distanceTo(c.allPts[c.allPts.length - 1]) > 1e-5) {
          c.allPts.push(exactEnd); c.allTs.push(tEnd); c.lastT = tEnd;
        }
      }
    }

    // ── Empty / zero case ──
    if (tEnd <= 0 || c.allPts.length < 2) {
      c.completedMeshes.forEach(m => removeMesh(m, trail));
      removeMesh(c.currentMesh, trail);
      c.completedMeshes = []; c.currentMesh = null;
      if (tEnd <= 0) {
        c.allPts = []; c.allTs = []; c.lastT = -1; c.chunkStart = 0; c.prevTEnd = -1; c.wasReverse = false;
      }
      return;
    }

    // ── Reverse: binary-search the visible endpoint index, then slice ──
    if (isReverse) {
      let lo = 0, hi = c.allTs.length - 1, idx = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (c.allTs[mid] <= tEnd + 1e-6) { idx = mid; lo = mid + 1; } else hi = mid - 1;
      }
      if (dirChanged) {
        // First reverse frame: rebuild all visible chunks
        const visible = c.allPts.slice(0, idx + 1);
        let cs = 0;
        while (visible.length - cs >= CHUNK + OVERLAP) {
          const mesh = buildTube(visible.slice(cs, cs + CHUNK + OVERLAP), color);
          if (mesh) { trail.add(mesh); c.completedMeshes.push(mesh); }
          cs += CHUNK;
        }
        c.chunkStart = cs;
        c.currentMesh = visible.slice(cs).length >= 2 ? buildTube(visible.slice(cs), color) : null;
        if (c.currentMesh) trail.add(c.currentMesh);
      } else {
        // Subsequent reverse frames: prune excess completed chunks
        const keepChunks = Math.floor(idx / CHUNK);
        while (c.completedMeshes.length > keepChunks) removeMesh(c.completedMeshes.pop(), trail);
        c.chunkStart = keepChunks * CHUNK;
        removeMesh(c.currentMesh, trail);
        const activePts  = c.allPts.slice(c.chunkStart, idx + 1);
        c.currentMesh = activePts.length >= 2 ? buildTube(activePts, color) : null;
        if (c.currentMesh) trail.add(c.currentMesh);
      }
      return;
    }

    // ── Forward: freeze full chunks, rebuild live tail ──
    while (c.allPts.length - c.chunkStart >= CHUNK + OVERLAP) {
      const chunkPts = c.allPts.slice(c.chunkStart, c.chunkStart + CHUNK + OVERLAP);
      const mesh     = buildTube(chunkPts, color);
      if (mesh) { trail.add(mesh); c.completedMeshes.push(mesh); }
      c.chunkStart += CHUNK;
    }
    removeMesh(c.currentMesh, trail);
    const activePts = c.allPts.slice(c.chunkStart);
    c.currentMesh = activePts.length >= 2 ? buildTube(activePts, color) : null;
    if (c.currentMesh) trail.add(c.currentMesh);
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  /**
   * Create the initial cache map for all four objects.
   */
  function createCacheMap() {
    return { solid: mkCache(), hollow: mkCache(), cylinder: mkCache(), hollowCyl: mkCache() };
  }

  /**
   * Dispose all trail meshes and reset cache to empty state.
   * @param {THREE.Group} trailGroup
   * @param {object}      cache       cache map (mutated in-place)
   */
  function clearTrailGroup(trailGroup, cache) {
    while (trailGroup.children.length > 0) {
      const child = trailGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      trailGroup.remove(child);
    }
    Object.keys(cache).forEach(k => { cache[k] = mkCache(); });
  }

  return { mkCache, createCacheMap, buildTube, updateTrail, clearTrailGroup };
})();
