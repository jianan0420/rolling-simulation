/**
 * js/scene3d.js
 * Three.js scene setup and per-frame update helpers.
 * Depends on: THREE (global), Physics (global)
 *
 * Exported as window.Scene3D
 */
window.Scene3D = (function () {
  const r = Physics.R, gap = 1;
  const Z_OFFSETS = [-(3*r+1.5*gap), -(r+0.5*gap), r+0.5*gap, 3*r+1.5*gap];

  // ── Texture helpers ───────────────────────────────────────────────────────

  function mkStripes(cA, cB, n) {
    n = n || 8;
    const sz = 512, cv = document.createElement('canvas');
    cv.width = cv.height = sz;
    const ctx = cv.getContext('2d'), sw = sz / n;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 === 0 ? cA : cB;
      ctx.fillRect(i * sw, 0, sw, sz);
    }
    return new THREE.CanvasTexture(cv);
  }

  function lerpHex(a, b, t) {
    const ai = parseInt(a.replace('#', ''), 16), bi = parseInt(b.replace('#', ''), 16);
    const L  = (ca, cb) => Math.round(ca + (cb - ca) * t);
    return '#' + [
      L((ai >> 16) & 0xff, (bi >> 16) & 0xff),
      L((ai >>  8) & 0xff, (bi >>  8) & 0xff),
      L( ai        & 0xff,  bi        & 0xff),
    ].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function mkAxisLabel(txt, col) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = col; ctx.font = 'bold 88px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, 128, 64);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
    sp.scale.set(2.4, 1.2, 1);
    return sp;
  }

  // ── Scene / renderer / camera ──────────────────────────────────────────────

  /**
   * Create scene, camera, and renderer; mount renderer into mountEl.
   * @returns {{ scene, camera, renderer }}
   */
  function createScene(mountEl) {
    const W = mountEl.clientWidth, H = mountEl.clientHeight;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1419);

    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    camera.position.set(0, 20, 8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    mountEl.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dL = new THREE.DirectionalLight(0xffffff, 0.8);
    dL.position.set(10, 10, 5); dL.castShadow = true;
    dL.shadow.mapSize.width = dL.shadow.mapSize.height = 2048;
    scene.add(dL);

    return { scene, camera, renderer };
  }

  // ── Rolling objects ────────────────────────────────────────────────────────

  /**
   * Create all four rolling objects (solid sphere, hollow sphere,
   * solid cylinder, hollow cylinder) and add them to the scene.
   * @returns {{ sphere, hSphG, sCylG, hCylG }}
   */
  function createObjects(scene, hollowSphRatio, hollowCylRatio) {
    const hT = ((hollowSphRatio - 0.01) / 0.98) * 0.85;
    const solidSphereTex  = mkStripes('#ff5533', '#880011');
    const hollowSphereTex = mkStripes(lerpHex('#ff5533', '#ffccbb', hT), lerpHex('#880011', '#cc8877', hT));
    const solidCylTex     = mkStripes('#2244dd', '#001177');
    const hollowCylTex    = mkStripes('#2244dd', '#001177');

    // Solid sphere
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(r, 32, 32),
      new THREE.MeshPhongMaterial({ map: solidSphereTex, shininess: 80 })
    );
    sphere.castShadow = true; scene.add(sphere);

    // Hollow sphere (3 concentric meshes: outer front, outer back, inner back)
    const hSphInR = hollowSphRatio * r;
    const hSphG   = new THREE.Group();
    hSphG.add(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 32),        new THREE.MeshPhongMaterial({ map: hollowSphereTex, shininess: 80, side: THREE.FrontSide })));
    hSphG.add(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 32),        new THREE.MeshPhongMaterial({ color: 0xcc3333, shininess: 40, side: THREE.BackSide })));
    hSphG.add(new THREE.Mesh(new THREE.SphereGeometry(hSphInR, 32, 32), new THREE.MeshPhongMaterial({ color: 0x0a0005, shininess: 0, side: THREE.BackSide })));
    hSphG.castShadow = true; scene.add(hSphG);

    // Solid cylinder (tube + 2 caps)
    const sCylG  = new THREE.Group();
    const capMat = new THREE.MeshPhongMaterial({ color: 0x1133bb, shininess: 60 });
    sCylG.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 2*r, 32, 1, true), new THREE.MeshPhongMaterial({ map: solidCylTex, shininess: 80, side: THREE.FrontSide })));
    const tCap = new THREE.Mesh(new THREE.CircleGeometry(r, 32), capMat); tCap.rotation.x = -Math.PI/2; tCap.position.y =  r; sCylG.add(tCap);
    const bCap = new THREE.Mesh(new THREE.CircleGeometry(r, 32), capMat); bCap.rotation.x =  Math.PI/2; bCap.position.y = -r; sCylG.add(bCap);
    sCylG.castShadow = true; scene.add(sCylG);

    // Hollow cylinder (tube + 2 rings; inner surface transparent)
    const hCylInR = hollowCylRatio * r;
    const hCylG   = new THREE.Group();
    const rMat    = new THREE.MeshPhongMaterial({ color: 0x5577ee, shininess: 60, side: THREE.DoubleSide });
    hCylG.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 2*r, 32, 1, true), new THREE.MeshPhongMaterial({ map: hollowCylTex, shininess: 80, side: THREE.DoubleSide })));
    hCylG.add(new THREE.Mesh(new THREE.CylinderGeometry(hCylInR, hCylInR, 2*r+0.01, 32, 1, true), new THREE.MeshPhongMaterial({ transparent: true, opacity: 0, side: THREE.BackSide })));
    const tR = new THREE.Mesh(new THREE.RingGeometry(hCylInR, r, 32), rMat); tR.rotation.x =  Math.PI/2; tR.position.y =  r; hCylG.add(tR);
    const bR = new THREE.Mesh(new THREE.RingGeometry(hCylInR, r, 32), rMat); bR.rotation.x =  Math.PI/2; bR.position.y = -r; hCylG.add(bR);
    hCylG.castShadow = true; scene.add(hCylG);

    return { sphere, hSphG, sCylG, hCylG };
  }

  // ── Slope ─────────────────────────────────────────────────────────────────

  /**
   * Create an empty slope group attached to the scene.
   * Call updateSlope() to build/replace the geometry.
   * @returns {{ group, mesh: null, line: null }}
   */
  function createSlope(scene) {
    const group = new THREE.Group();
    scene.add(group);
    return { group, mesh: null, line: null };
  }

  /**
   * (Re)build slope geometry inside slopeState.group.
   * @param {object} slopeState  object returned by createSlope()
   * @param {number} theta       slope angle in radians (absolute value)
   * @param {boolean} isUphill
   * @param {number} peakH       highest vertical point reached (for uphill sizing)
   * @param {number} height      slope height H (for downhill sizing)
   */
  function updateSlope(slopeState, theta, isUphill, peakH, height) {
    const { group } = slopeState;
    if (slopeState.mesh) group.remove(slopeState.mesh);
    if (slopeState.line) group.remove(slopeState.line);

    const sinT = Math.sin(theta), cosT = Math.cos(theta);
    const safeSinT = Math.max(Math.abs(sinT), 0.001);
    let sWX = isUphill ? (peakH / safeSinT) * 1.15 : (height / safeSinT);
    if (!isFinite(sWX) || sWX <= 0) sWX = 20;
    const sWZ = 2 * (4 * r + 2 * gap);

    const sGeo = new THREE.PlaneGeometry(sWX, sWZ);
    const mesh  = new THREE.Mesh(sGeo, new THREE.MeshPhongMaterial({ color: 0x3a6a8a, shininess: 20, side: THREE.DoubleSide }));
    const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0),  Math.PI / 2);
    const qZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), isUphill ? theta : -theta);
    mesh.quaternion.multiplyQuaternions(qZ, qX);
    const cx = (sWX / 2) * cosT;
    const cy = isUphill ? (sWX / 2) * sinT : -(sWX / 2) * sinT;
    mesh.position.set(cx, cy, 0); mesh.receiveShadow = true;
    group.add(mesh);

    const line = new THREE.LineSegments(new THREE.EdgesGeometry(sGeo), new THREE.LineBasicMaterial({ color: 0x00ffaa }));
    line.quaternion.multiplyQuaternions(qZ, qX); line.position.copy(mesh.position);
    group.add(line);

    slopeState.mesh = mesh; slopeState.line = line;
  }

  // ── Axes helper ───────────────────────────────────────────────────────────

  function createAxes(scene) {
    const axO = new THREE.Vector3(-6.0, 0, 1.9), axL = 2.5;
    scene.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), axO, axL, 0xff3333, 0.4, 0.25));
    const lX = mkAxisLabel('+X', '#ff8888'); lX.position.set(axO.x + axL + 0.9, axO.y, axO.z); scene.add(lX);
    scene.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), axO, axL, 0x33ff55, 0.4, 0.25));
    const lY = mkAxisLabel('+Y', '#88ffaa'); lY.position.set(axO.x, axO.y + axL + 0.6, axO.z); scene.add(lY);
    scene.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), axO, axL, 0x3388ff, 0.4, 0.25));
    const lZ = mkAxisLabel('+Z', '#88ccff'); lZ.position.set(axO.x, axO.y, axO.z + axL + 0.9); scene.add(lZ);
  }

  // ── Per-frame updates ─────────────────────────────────────────────────────

  /**
   * Move and rotate the four rolling objects to match physics state at time t.
   * Called every animation frame.
   * @param {object} refs  { sphereRef, hollowSphereRef, cylinderRef, hollowCylinderRef }
   * @param {number} t     current simulation time
   * @param {object} phy   snapshot from phyRef.current
   */
  function updateObjects(refs, t, phy) {
    if (!phy || !phy.theta) return;
    const { theta, isUphill, height, initSpeed,
            I_solid, I_hollowSphere, I_cylinder, I_hollowCylinder,
            maxTime_solid, maxTime_hollowSphere, maxTime_cylinder, maxTime_hollowCylinder } = phy;

    const entries = [
      { mesh: refs.sphereRef.current,          I: I_solid,          maxT: maxTime_solid,          z: Z_OFFSETS[0], isCyl: false },
      { mesh: refs.hollowSphereRef.current,    I: I_hollowSphere,   maxT: maxTime_hollowSphere,   z: Z_OFFSETS[1], isCyl: false },
      { mesh: refs.cylinderRef.current,        I: I_cylinder,       maxT: maxTime_cylinder,       z: Z_OFFSETS[2], isCyl: true  },
      { mesh: refs.hollowCylinderRef.current,  I: I_hollowCylinder, maxT: maxTime_hollowCylinder, z: Z_OFFSETS[3], isCyl: true  },
    ];

    entries.forEach(({ mesh, I, maxT, z, isCyl }) => {
      if (!mesh) return;
      mesh.position.copy(Physics.getPos(t, I, maxT, z, theta, isUphill, height, initSpeed));
      const k = Physics.calcK(Math.min(t, maxT), I, theta, isUphill, initSpeed);
      if (isCyl) {
        const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0),  Math.PI / 2);
        const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -k);
        mesh.quaternion.multiplyQuaternions(qz, qx);
      } else {
        mesh.rotation.z = -k;
      }
    });
  }

  /**
   * Smooth-follow camera that keeps all four objects visible.
   * Zooms out quickly, zooms in slowly.
   */
  function updateCamera(camera, refs, targetCamZRef) {
    const meshes = [refs.sphereRef, refs.hollowSphereRef, refs.cylinderRef, refs.hollowCylinderRef]
      .map(ref => ref.current).filter(Boolean);
    if (meshes.length !== 4) return;

    const positions = meshes.map(m => m.position);
    const targetX = positions.reduce((a, b) => a + b.x, 0) / 4;
    const allY = positions.map(p => p.y);
    const maxObjY = Math.max(...allY), minObjY = Math.min(...allY);
    const midY = (maxObjY + minObjY) / 2, rangeY = maxObjY - minObjY;
    const targetY     = midY + 18 + rangeY * 0.5;
    const targetLookY = midY - 10 - rangeY * 0.5;

    const MARGIN = 0.42, limit = 1 - MARGIN;
    const tanHalfFovX = Math.tan(camera.fov * Math.PI / 180 / 2) * camera.aspect;
    let targetZ = 8;
    positions.forEach(p => {
      const dx = Math.abs(p.x - targetX);
      targetZ = Math.max(targetZ, dx / (limit * tanHalfFovX));
    });
    targetZ *= 1.05;

    if (targetZ > targetCamZRef.current) {
      targetCamZRef.current = targetZ;
    } else {
      targetCamZRef.current += (targetZ - targetCamZRef.current) * 0.002;
    }

    camera.position.set(targetX, targetY, targetCamZRef.current);
    camera.lookAt(targetX, targetLookY, 0);
    camera.far = Math.max(1000, camera.position.z * 3);
    camera.updateProjectionMatrix();
  }

  return { Z_OFFSETS, createScene, createObjects, createSlope, updateSlope, createAxes, updateObjects, updateCamera };
})();
