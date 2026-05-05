/**
 * js/markers.js
 * 3-D label-sprite markers that float beside each rolling object,
 * display the object name, and show a rank badge once an object stops.
 * Depends on: THREE (global), Physics (global)
 *
 * Features:
 *   - Four directional tip styles (up / down / left / right).
 *   - Collision-avoidance: tries to keep labels non-overlapping in NDC space.
 *   - Lazy rebuild: sprites are only recreated when direction or rank changes.
 *
 * Exported as window.MarkerSystem
 */
window.MarkerSystem = (function () {
  const MARKER_NAMES     = ['實心球', '空心球', '實心柱', '空心柱'];
  const MARKER_COLORS_BG = ['#aa1a00', '#bb3311', '#0d1eaa', '#1f2fbb'];
  const MARKER_COLORS_BD = ['#ff6644', '#ff9977', '#5577ff', '#7799ff'];
  const TARGET_NDC_H     = 0.20;
  const DIRS             = ['up', 'down', 'left', 'right'];
  const r                = Physics.R;

  // ── Bounding-box overlap (NDC space) ──────────────────────────────────────

  function overlap(a, b) {
    const ox = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
    const oy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    return ox * oy;
  }

  // ── Sprite size / position for a given direction ──────────────────────────

  /**
   * Compute world-space centre and NDC bounding box for a label sprite
   * placed in `dir` relative to `mesh`.
   */
  function getSpriteInfo(mesh, dir, camera) {
    const camDir   = new THREE.Vector3(); camera.getWorldDirection(camDir);
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const camUp    = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

    // Project object centre to NDC, then compute world-space label height
    const ndcM = mesh.position.clone().project(camera);
    const ndcT = ndcM.clone(); ndcT.y += TARGET_NDC_H;
    const wM   = ndcM.clone().unproject(camera);
    const wT   = ndcT.clone().unproject(camera);
    const dep  = mesh.position.clone().sub(camera.position).dot(camDir);
    const dM   = wM.clone().sub(camera.position).normalize();
    const dT   = wT.clone().sub(camera.position).normalize();
    const pM   = camera.position.clone().addScaledVector(dM, dep / dM.dot(camDir));
    const pT   = camera.position.clone().addScaledVector(dT, dep / dT.dot(camDir));
    const sH   = pM.distanceTo(pT);
    const sW   = sH * (340 / 200);
    const tipW = sW * 0.471, tipH = sH * 0.45;

    let center;
    if      (dir === 'left')  center = mesh.position.clone().addScaledVector(camRight, -r).addScaledVector(camRight, -tipW);
    else if (dir === 'right') center = mesh.position.clone().addScaledVector(camRight,  r).addScaledVector(camRight,  tipW);
    else if (dir === 'up')    center = mesh.position.clone().addScaledVector(camUp,     r).addScaledVector(camUp,     tipH);
    else                      center = mesh.position.clone().addScaledVector(camUp,    -r).addScaledVector(camUp,    -tipH);

    const cNDC = center.clone().project(camera);
    const ndcHh = TARGET_NDC_H / 2, ndcHw = ndcHh * (340 / 200) / camera.aspect;
    return {
      sH, sW, tipW, tipH, center,
      bbox: { x0: cNDC.x - ndcHw, y0: cNDC.y - ndcHh, x1: cNDC.x + ndcHw, y1: cNDC.y + ndcHh },
    };
  }

  // ── Canvas texture for one marker ─────────────────────────────────────────

  /**
   * Draw a rounded-rectangle bubble with directional tip and optional rank badge.
   * @returns {THREE.CanvasTexture}
   */
  function makeMarkerTex(idx, rank, dir) {
    const cv = document.createElement('canvas'); cv.width = 340; cv.height = 200;
    const ctx = cv.getContext('2d');
    const isLeft = dir === 'left', isRight = dir === 'right', isUp = dir === 'up', isDown = dir === 'down';
    const bg  = MARKER_COLORS_BG[idx], bdr = MARKER_COLORS_BD[idx];
    const bx  = (isUp || isDown) ? 30 : (isLeft ? 10 : 50);
    const by  = isDown ? 50 : 10;
    const bw  = 280, bh = (isUp || isDown) ? 140 : 180, br2 = 28;

    // Bubble body
    ctx.fillStyle = bg; ctx.beginPath();
    ctx.moveTo(bx+br2,by);       ctx.lineTo(bx+bw-br2,by);    ctx.quadraticCurveTo(bx+bw,by,   bx+bw,by+br2);
    ctx.lineTo(bx+bw,by+bh-br2); ctx.quadraticCurveTo(bx+bw,by+bh,bx+bw-br2,by+bh);
    ctx.lineTo(bx+br2,by+bh);    ctx.quadraticCurveTo(bx,by+bh,  bx,by+bh-br2);
    ctx.lineTo(bx,by+br2);       ctx.quadraticCurveTo(bx,by,     bx+br2,by);
    ctx.closePath(); ctx.fill();

    // Directional tip triangle
    ctx.fillStyle = bg; ctx.beginPath();
    if (isLeft)  { ctx.moveTo(bx+bw,by+bh/2-22); ctx.lineTo(bx+bw+40,by+bh/2); ctx.lineTo(bx+bw,by+bh/2+22); }
    if (isRight) { ctx.moveTo(bx,by+bh/2-22);    ctx.lineTo(bx-40,by+bh/2);    ctx.lineTo(bx,by+bh/2+22);    }
    if (isUp)    { ctx.moveTo(bx+bw/2-22,by+bh); ctx.lineTo(bx+bw/2,190);      ctx.lineTo(bx+bw/2+22,by+bh); }
    if (isDown)  { ctx.moveTo(bx+bw/2-22,by);    ctx.lineTo(bx+bw/2,10);       ctx.lineTo(bx+bw/2+22,by);    }
    ctx.closePath(); ctx.fill();

    // Border
    ctx.strokeStyle = bdr; ctx.lineWidth = 5; ctx.beginPath();
    ctx.moveTo(bx+br2,by);       ctx.lineTo(bx+bw-br2,by);    ctx.quadraticCurveTo(bx+bw,by,   bx+bw,by+br2);
    ctx.lineTo(bx+bw,by+bh-br2); ctx.quadraticCurveTo(bx+bw,by+bh,bx+bw-br2,by+bh);
    ctx.lineTo(bx+br2,by+bh);    ctx.quadraticCurveTo(bx,by+bh,  bx,by+bh-br2);
    ctx.lineTo(bx,by+br2);       ctx.quadraticCurveTo(bx,by,     bx+br2,by);
    ctx.closePath(); ctx.stroke();

    // Text / rank badge
    const cx = bx + bw / 2;
    if (rank != null) {
      const rx = (isLeft || isUp || isDown) ? bx + 44 : bx + bw - 44, ry = by + 44;
      ctx.fillStyle = '#ffdd00'; ctx.beginPath(); ctx.arc(rx, ry, 38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = 'bold 44px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(rank, rx, ry);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 50px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(MARKER_NAMES[idx], cx, by + bh / 2 + 4);
    } else {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 52px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(MARKER_NAMES[idx], cx, by + bh / 2);
    }
    return new THREE.CanvasTexture(cv);
  }

  // ── Rank computation ───────────────────────────────────────────────────────

  /**
   * Compute finish rank for one object given all stopped states.
   * Downhill: smaller maxTime = better rank.
   * Uphill:   larger stopTime (= went higher) = better rank.
   */
  function computeRank(name, stopped, stoppedArr, phyRef) {
    if (!stopped) return null;
    const phy = phyRef.current;
    if (!phy || !phy.theta) return null;
    const { isUphill, maxTime_solid, maxTime_hollowSphere, maxTime_cylinder, maxTime_hollowCylinder,
            I_solid, I_hollowSphere, I_cylinder, I_hollowCylinder, theta, initSpeed } = phy;
    const [s0, s1, s2, s3] = stoppedArr;
    const all = [
      { name: 'solid',     val: isUphill ? Physics.calcStopTime(I_solid,          theta, initSpeed) : maxTime_solid,          stopped: s0 },
      { name: 'hollow',    val: isUphill ? Physics.calcStopTime(I_hollowSphere,    theta, initSpeed) : maxTime_hollowSphere,   stopped: s1 },
      { name: 'cylinder',  val: isUphill ? Physics.calcStopTime(I_cylinder,        theta, initSpeed) : maxTime_cylinder,       stopped: s2 },
      { name: 'hollowCyl', val: isUphill ? Physics.calcStopTime(I_hollowCylinder,  theta, initSpeed) : maxTime_hollowCylinder, stopped: s3 },
    ];
    const sorted = all.filter(o => o.stopped).sort((a, b) => isUphill ? b.val - a.val : a.val - b.val);
    const idx = sorted.findIndex(o => o.name === name);
    return idx >= 0 ? idx + 1 : null;
  }

  // ── Main update ────────────────────────────────────────────────────────────

  /**
   * Called every animation frame.
   * Updates sprite positions; rebuilds textures only when direction or rank changes.
   *
   * @param {THREE.Group}  markersGroup
   * @param {THREE.Object3D[]} meshes      [sphere, hollowSphere, cylinder, hollowCyl]
   * @param {THREE.Camera} camera
   * @param {boolean[]}    stoppedArr      [s0, s1, s2, s3]
   * @param {{ current: string[] }}  markerDirRef
   * @param {{ current: (number|null)[] }} markerRanksRef
   * @param {{ current: object[] }}  markerSpritesRef
   * @param {{ current: object }}    phyRef
   */
  function updateMarkers(markersGroup, meshes, camera, stoppedArr, markerDirRef, markerRanksRef, markerSpritesRef, phyRef) {
    if (!camera || !markersGroup || meshes.length !== 4) return;

    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const camUp    = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

    // Compute per-mesh NDC bounding boxes (for collision detection)
    const meshNDC = meshes.map(mesh => {
      const ndc  = mesh.position.clone().project(camera);
      const ndcR = mesh.position.clone().addScaledVector(camRight, r).project(camera);
      const ndcU = mesh.position.clone().addScaledVector(camUp,    r).project(camera);
      const hrx  = Math.abs(ndcR.x - ndc.x), hry = Math.abs(ndcU.y - ndc.y);
      return { x0: ndc.x - hrx - 0.01, y0: ndc.y - hry - 0.01, x1: ndc.x + hrx + 0.01, y1: ndc.y + hry + 0.01 };
    });

    const hasCollision = (bbox, lbs, obs) => {
      for (const lb of lbs) if (overlap(bbox, lb) > 1e-6) return true;
      for (const ob of obs) if (overlap(bbox, ob) > 1e-6) return true;
      return false;
    };

    // Choose best direction for each label (collision-avoidance greedy)
    const prevDirs = markerDirRef.current;
    const chosenDirs = [], chosenBBoxes = [];
    meshes.forEach((mesh, idx) => {
      const otherNDC = meshNDC.filter((_, i) => i !== idx);
      const prevDir  = prevDirs[idx];
      const prevInfo = getSpriteInfo(mesh, prevDir, camera);
      if (!hasCollision(prevInfo.bbox, chosenBBoxes, otherNDC)) {
        chosenDirs.push(prevDir); chosenBBoxes.push(prevInfo.bbox); return;
      }
      const freeDirs = DIRS.filter(d => !hasCollision(getSpriteInfo(mesh, d, camera).bbox, chosenBBoxes, otherNDC));
      if (freeDirs.length > 0) {
        const chosen = freeDirs.includes(prevDir) ? prevDir : freeDirs[0];
        chosenDirs.push(chosen); chosenBBoxes.push(getSpriteInfo(mesh, chosen, camera).bbox);
      } else {
        let bestDir = prevDir, bestScore = Infinity;
        for (const d of DIRS) {
          const bbox = getSpriteInfo(mesh, d, camera).bbox;
          const score = chosenBBoxes.reduce((s, cb) => s + overlap(bbox, cb), 0) + otherNDC.reduce((s, ob) => s + overlap(bbox, ob), 0);
          if (score < bestScore) { bestScore = score; bestDir = d; }
        }
        chosenDirs.push(bestDir); chosenBBoxes.push(getSpriteInfo(mesh, bestDir, camera).bbox);
      }
    });
    markerDirRef.current = chosenDirs;

    // Compute ranks
    const RANK_NAMES = ['solid', 'hollow', 'cylinder', 'hollowCyl'];
    const RANKS = RANK_NAMES.map((name, i) => computeRank(name, stoppedArr[i], stoppedArr, phyRef));

    const prevRanks = markerRanksRef.current;
    const dirChanged  = chosenDirs.some((d, i) => d !== (markerSpritesRef.current[i]?.dir));
    const rankChanged = RANKS.some((rk, i) => rk !== prevRanks[i]);
    const needRebuild = dirChanged || rankChanged || markerSpritesRef.current.length !== 4;

    if (needRebuild) {
      markerRanksRef.current = RANKS;
      while (markersGroup.children.length > 0) markersGroup.remove(markersGroup.children[0]);
      meshes.forEach((mesh, idx) => {
        const dir  = chosenDirs[idx];
        const info = getSpriteInfo(mesh, dir, camera);
        const sp   = new THREE.Sprite(new THREE.SpriteMaterial({
          map: makeMarkerTex(idx, RANKS[idx], dir), transparent: true, depthTest: false,
        }));
        sp.scale.set(info.sW, info.sH, 1);
        sp.position.copy(info.center);
        sp.renderOrder = 998;
        markersGroup.add(sp);
        markerSpritesRef.current[idx] = { sp, dir };
      });
    } else {
      // Just reposition existing sprites
      meshes.forEach((mesh, idx) => {
        const entry = markerSpritesRef.current[idx]; if (!entry) return;
        const info  = getSpriteInfo(mesh, entry.dir, camera);
        entry.sp.position.copy(info.center);
        entry.sp.scale.set(info.sW, info.sH, 1);
      });
    }
  }

  return { updateMarkers, makeMarkerTex, computeRank };
})();
