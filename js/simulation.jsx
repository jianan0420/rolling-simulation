/**
 * js/simulation.jsx  (loaded by Babel standalone)
 * Main React component — wires together Physics, Scene3D, TrailSystem,
 * MarkerSystem, and the control-panel UI.
 *
 * Depends on (window globals): React, THREE, Physics, Scene3D, TrailSystem,
 *                               MarkerSystem, SectionHeader
 * Exports: window.MultiSphereSimulation
 */
const { useState, useEffect, useRef } = React;

window.MultiSphereSimulation = function MultiSphereSimulation() {
  // ── Three.js object refs ──────────────────────────────────────────────────
  const mountRef          = useRef(null);
  const rendererRef       = useRef(null);
  const cameraRef         = useRef(null);
  const sphereRef         = useRef(null);
  const hollowSphereRef   = useRef(null);
  const cylinderRef       = useRef(null);
  const hollowCylinderRef = useRef(null);
  const rankingLabelRef   = useRef(null);
  const trailRef          = useRef(null);
  const markersRef        = useRef(null);
  const slopeStateRef     = useRef(null);   // { group, mesh, line }

  // ── Trail & marker state refs ─────────────────────────────────────────────
  const trailCacheRef      = useRef(TrailSystem.createCacheMap());
  const markerDirRef       = useRef(['up', 'left', 'right', 'down']);
  const markerSpritesRef   = useRef([]);
  const markerRanksRef     = useRef([null, null, null, null]);
  const targetCamZRef      = useRef(8);
  const stoppedRef         = useRef([false, false, false, false]);

  // ── Scroll ref (detail panel) ─────────────────────────────────────────────
  const scrollRef = useRef(null);

  // ── Live physics parameters (visual, no scene rebuild) ───────────────────
  const [liveAngle,      setLiveAngle]      = useState(30);
  const [liveHeight,     setLiveHeight]     = useState(10);
  const [liveInitSpeed,  setLiveInitSpeed]  = useState(10);
  const [liveHollowSph,  setLiveHollowSph]  = useState(0.88);
  const [liveHollowCyl,  setLiveHollowCyl]  = useState(0.88);

  // ── Committed parameters (trigger scene rebuild + reset) ─────────────────
  const [committedAngle,    setCommittedAngle]    = useState(30);
  const [committedHeight,   setCommittedHeight]   = useState(10);
  const [committedInitSpd,  setCommittedInitSpd]  = useState(10);
  const [committedHollowSph,setCommittedHollowSph]= useState(0.88);
  const [committedHollowCyl,setCommittedHollowCyl]= useState(0.88);

  // ── Draft parameters (inside the open params panel) ───────────────────────
  const [draftAngle,    setDraftAngle]    = useState(30);
  const [draftHeight,   setDraftHeight]   = useState(10);
  const [draftInitSpd,  setDraftInitSpd]  = useState(10);
  const [draftHollowSph,setDraftHollowSph]= useState(0.88);
  const [draftHollowCyl,setDraftHollowCyl]= useState(0.88);
  const [isAdjusting,   setIsAdjusting]   = useState(false);
  const paramSnapshotRef  = useRef(null);
  const liveUpdateRafRef  = useRef(null);
  const commitRef         = useRef({ angle:30, height:10, initSpd:10, hollowSph:0.88, hollowCyl:0.88 });

  // ── Playback state ────────────────────────────────────────────────────────
  const [time,         setTime]         = useState(0);
  const [playing,      setPlaying]      = useState(false);
  const [displaySpeed, setDisplaySpeed] = useState(1);
  const timeRef     = useRef(0);
  const playingRef  = useRef(false);
  const speedRef    = useRef(1);
  const speedIdxRef = useRef(8);
  const rafRef      = useRef(null);
  const lastTsRef   = useRef(null);
  const sliderMaxRef= useRef(1);
  const phyRef      = useRef({});

  const SPEEDS = [-8, -4, -2, -1, -0.5, -0.25, 0.25, 0.5, 1, 2, 4, 8];

  // ── Panel UI state ────────────────────────────────────────────────────────
  const [secPanel,   setSecPanel]   = useState(false);
  const [secParams,  setSecParams]  = useState(false);
  const [secData,    setSecData]    = useState(false);
  const [secFormula, setSecFormula] = useState(false);
  const secParamsRef = useRef(false);
  useEffect(() => { secParamsRef.current = secParams; }, [secParams]);

  // ── Derived physics values (recalculated every render) ───────────────────
  const isUphill = liveAngle < 0;
  const theta    = Math.abs(liveAngle) * Math.PI / 180;

  const timeStep = 0.02;
  const { R: r, G: g } = Physics;

  const I_solid          = Physics.calcInertia('solid_sphere',  liveHollowSph);
  const I_hollowSphere   = Physics.calcInertia('hollow_sphere', liveHollowSph);
  const I_cylinder       = Physics.calcInertia('solid_cyl',     liveHollowCyl);
  const I_hollowCylinder = Physics.calcInertia('hollow_cyl',    liveHollowCyl);

  const maxTime_solid          = isUphill ? Physics.calcStopTime(I_solid,          theta, liveInitSpeed) : Physics.calcMaxTimeDown(I_solid,          theta, liveHeight);
  const maxTime_hollowSphere   = isUphill ? Physics.calcStopTime(I_hollowSphere,   theta, liveInitSpeed) : Physics.calcMaxTimeDown(I_hollowSphere,   theta, liveHeight);
  const maxTime_cylinder       = isUphill ? Physics.calcStopTime(I_cylinder,       theta, liveInitSpeed) : Physics.calcMaxTimeDown(I_cylinder,       theta, liveHeight);
  const maxTime_hollowCylinder = isUphill ? Physics.calcStopTime(I_hollowCylinder, theta, liveInitSpeed) : Physics.calcMaxTimeDown(I_hollowCylinder, theta, liveHeight);
  const maxTime   = Math.max(maxTime_solid, maxTime_hollowSphere, maxTime_cylinder, maxTime_hollowCylinder);
  const sliderMax = Math.ceil(maxTime / timeStep) * timeStep;

  useEffect(() => { sliderMaxRef.current = sliderMax; }, [sliderMax]);
  useEffect(() => { playingRef.current   = playing;   }, [playing]);
  useEffect(() => { timeRef.current      = time;      }, [time]);

  // Keep phyRef fresh so the Three.js animation loop always reads latest values
  phyRef.current = {
    isUphill, theta, height: liveHeight, initSpeed: liveInitSpeed,
    I_solid, I_hollowSphere, I_cylinder, I_hollowCylinder,
    maxTime_solid, maxTime_hollowSphere, maxTime_cylinder, maxTime_hollowCylinder,
  };

  // ── Stop detection ────────────────────────────────────────────────────────
  const tol = 0.01;
  const [solidStopped,     setSolidStopped]     = useState(false);
  const [hollowStopped,    setHollowStopped]    = useState(false);
  const [cylinderStopped,  setCylinderStopped]  = useState(false);
  const [hollowCylStopped, setHollowCylStopped] = useState(false);
  useEffect(() => { setSolidStopped(    isUphill ? time >= maxTime_solid          - tol : Physics.calcYDown(time, I_solid,          theta) >= liveHeight * 0.995); }, [time, maxTime_solid,          isUphill]);
  useEffect(() => { setHollowStopped(   isUphill ? time >= maxTime_hollowSphere   - tol : Physics.calcYDown(time, I_hollowSphere,   theta) >= liveHeight * 0.995); }, [time, maxTime_hollowSphere,   isUphill]);
  useEffect(() => { setCylinderStopped( isUphill ? time >= maxTime_cylinder       - tol : Physics.calcYDown(time, I_cylinder,       theta) >= liveHeight * 0.995); }, [time, maxTime_cylinder,       isUphill]);
  useEffect(() => { setHollowCylStopped(isUphill ? time >= maxTime_hollowCylinder - tol : Physics.calcYDown(time, I_hollowCylinder, theta) >= liveHeight * 0.995); }, [time, maxTime_hollowCylinder, isUphill]);
  const allStopped = solidStopped && hollowStopped && cylinderStopped && hollowCylStopped;

  // ── Rank helper (for data panel) ──────────────────────────────────────────
  const getRealTimeRank = (objName, stopped) => {
    if (!stopped) return null;
    const objs = [];
    if (solidStopped)     objs.push({ name: 'solid',     val: isUphill ? Physics.calcStopTime(I_solid,          theta, liveInitSpeed) : maxTime_solid         });
    if (hollowStopped)    objs.push({ name: 'hollow',    val: isUphill ? Physics.calcStopTime(I_hollowSphere,   theta, liveInitSpeed) : maxTime_hollowSphere  });
    if (cylinderStopped)  objs.push({ name: 'cylinder',  val: isUphill ? Physics.calcStopTime(I_cylinder,       theta, liveInitSpeed) : maxTime_cylinder      });
    if (hollowCylStopped) objs.push({ name: 'hollowCyl', val: isUphill ? Physics.calcStopTime(I_hollowCylinder, theta, liveInitSpeed) : maxTime_hollowCylinder});
    objs.sort((a, b) => isUphill ? b.val - a.val : a.val - b.val);
    const idx = objs.findIndex(o => o.name === objName);
    return idx !== -1 ? idx + 1 : null;
  };

  // ── Playback animation loop ───────────────────────────────────────────────
  const handleSetSpeed = (s) => {
    const idx = SPEEDS.indexOf(s);
    speedIdxRef.current = idx; speedRef.current = s; setDisplaySpeed(s);
    const atEnd   = timeRef.current >= sliderMaxRef.current - 0.001;
    const atStart = timeRef.current <= 0.001;
    if ((atEnd && s < 0) || (atStart && s > 0)) setPlaying(true);
  };

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    lastTsRef.current = null;
    if (!playing) return;
    const loop = (ts) => {
      if (lastTsRef.current === null) { lastTsRef.current = ts; rafRef.current = requestAnimationFrame(loop); return; }
      const dt  = (ts - lastTsRef.current) / 1000; lastTsRef.current = ts;
      const spd = speedRef.current;
      const next = Math.max(0, Math.min(sliderMaxRef.current, timeRef.current + dt * spd));
      timeRef.current = next; setTime(next);
      if ((next <= 0 && spd < 0) || (next >= sliderMaxRef.current && spd > 0)) { setPlaying(false); return; }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (secParamsRef.current) return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault(); setPlaying(p => { playingRef.current = !p; return !p; });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault(); const cur = speedIdxRef.current; if (cur < SPEEDS.length - 1) handleSetSpeed(SPEEDS[cur + 1]);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault(); const cur = speedIdxRef.current; if (cur > 0) handleSetSpeed(SPEEDS[cur - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Three.js scene setup ──────────────────────────────────────────────────
  // Rebuilds the entire scene whenever any live parameter changes.
  useEffect(() => {
    if (!mountRef.current) return;

    const { scene, camera, renderer } = Scene3D.createScene(mountRef.current);
    cameraRef.current = camera; rendererRef.current = renderer;

    const objs = Scene3D.createObjects(scene, liveHollowSph, liveHollowCyl);
    sphereRef.current         = objs.sphere;
    hollowSphereRef.current   = objs.hSphG;
    cylinderRef.current       = objs.sCylG;
    hollowCylinderRef.current = objs.hCylG;

    const slopeState = Scene3D.createSlope(scene);
    slopeStateRef.current = slopeState;
    Scene3D.createAxes(scene);

    // Size the slope: for uphill, find the highest peak among all objects
    const peakH = isUphill ? Math.max(
      Physics.calcYUp(Physics.calcStopTime(I_solid,          theta, liveInitSpeed), I_solid,          theta, liveInitSpeed),
      Physics.calcYUp(Physics.calcStopTime(I_hollowSphere,   theta, liveInitSpeed), I_hollowSphere,   theta, liveInitSpeed),
      Physics.calcYUp(Physics.calcStopTime(I_cylinder,       theta, liveInitSpeed), I_cylinder,       theta, liveInitSpeed),
      Physics.calcYUp(Physics.calcStopTime(I_hollowCylinder, theta, liveInitSpeed), I_hollowCylinder, theta, liveInitSpeed),
    ) : 0;
    Scene3D.updateSlope(slopeState, theta, isUphill, peakH, liveHeight);

    const trail   = new THREE.Group(); scene.add(trail);   trailRef.current        = trail;
    const rl      = new THREE.Group(); scene.add(rl);      rankingLabelRef.current = rl;
    const markers = new THREE.Group(); scene.add(markers); markersRef.current      = markers;

    // Resize handler
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth, h = mountRef.current.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    const ro = new ResizeObserver(handleResize);
    ro.observe(mountRef.current);

    // Animation loop
    const refs = { sphereRef, hollowSphereRef, cylinderRef, hollowCylinderRef };
    const animate = () => {
      requestAnimationFrame(animate);
      Scene3D.updateObjects(refs, timeRef.current, phyRef.current);
      Scene3D.updateCamera(camera, refs, targetCamZRef);
      MarkerSystem.updateMarkers(
        markersRef.current,
        [sphereRef.current, hollowSphereRef.current, cylinderRef.current, hollowCylinderRef.current].filter(Boolean),
        camera, stoppedRef.current,
        markerDirRef, markerRanksRef, markerSpritesRef, phyRef
      );
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      ro.disconnect();
      while (scene.children.length > 0) scene.remove(scene.children[0]);
      renderer.dispose();
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current)
        mountRef.current.removeChild(renderer.domElement);
      trailCacheRef.current   = TrailSystem.createCacheMap();
      markerSpritesRef.current = [];
      markerRanksRef.current   = [null, null, null, null];
    };
  }, [liveAngle, liveHeight, liveInitSpeed, liveHollowSph, liveHollowCyl]);

  // ── Trail update (runs whenever time or physics changes) ─────────────────
  useEffect(() => {
    if (!sphereRef.current) return;
    stoppedRef.current = [solidStopped, hollowStopped, cylinderStopped, hollowCylStopped];

    const trail = trailRef.current;
    if (!trail) return;
    const cache = trailCacheRef.current;
    const phy   = { theta, isUphill, height: liveHeight, initSpeed: liveInitSpeed };
    const zs    = Scene3D.Z_OFFSETS;

    TrailSystem.updateTrail('solid',     cache, trail, I_solid,          maxTime_solid,          zs[0], 0xff4444, time, phy);
    TrailSystem.updateTrail('hollow',    cache, trail, I_hollowSphere,   maxTime_hollowSphere,   zs[1], 0xff9999, time, phy);
    TrailSystem.updateTrail('cylinder',  cache, trail, I_cylinder,       maxTime_cylinder,       zs[2], 0x4477ff, time, phy);
    TrailSystem.updateTrail('hollowCyl', cache, trail, I_hollowCylinder, maxTime_hollowCylinder, zs[3], 0xaabbff, time, phy);
  }, [time, liveAngle, liveHeight, liveInitSpeed, liveHollowSph, liveHollowCyl, solidStopped, hollowStopped, cylinderStopped, hollowCylStopped, allStopped]);

  // ── Trail / camera reset ──────────────────────────────────────────────────
  const clearTrail = () => {
    markerDirRef.current     = ['up', 'left', 'right', 'down'];
    markerSpritesRef.current = [];
    targetCamZRef.current    = 8;
    markerRanksRef.current   = [null, null, null, null];
    if (trailRef.current) TrailSystem.clearTrailGroup(trailRef.current, trailCacheRef.current);
  };

  useEffect(() => {
    setPlaying(false); setTime(0); setDisplaySpeed(1);
    speedRef.current = 1; speedIdxRef.current = 8; clearTrail();
  }, [committedAngle, committedHeight, committedInitSpd]);

  useEffect(() => {
    setPlaying(false); setTime(0); setDisplaySpeed(1);
    speedRef.current = 1; speedIdxRef.current = 8; clearTrail();
  }, [committedHollowSph, committedHollowCyl]);

  // ── Live-update helpers ───────────────────────────────────────────────────
  const scheduleLiveUpdate = (angle, height, initSpd, hollowSph, hollowCyl) => {
    if (liveUpdateRafRef.current) cancelAnimationFrame(liveUpdateRafRef.current);
    liveUpdateRafRef.current = requestAnimationFrame(() => {
      setLiveAngle(angle); setLiveHeight(height); setLiveInitSpeed(initSpd);
      setLiveHollowSph(hollowSph); setLiveHollowCyl(hollowCyl);
    });
  };

  const commitParam = (angle, height, initSpd, hollowSph, hollowCyl) => {
    const ang = angle === 0 ? (angle > 0 ? 1 : -1) : angle;
    setCommittedAngle(ang); setCommittedHeight(height);
    setCommittedInitSpd(initSpd); setCommittedHollowSph(hollowSph); setCommittedHollowCyl(hollowCyl);
  };

  const doCommitAndClose = () => {
    const snap    = paramSnapshotRef.current;
    const changed = !snap || snap.angle !== draftAngle || snap.height !== draftHeight ||
      snap.initSpd !== draftInitSpd || snap.hollowSph !== draftHollowSph || snap.hollowCyl !== draftHollowCyl;
    const ang = draftAngle === 0 ? (draftAngle > 0 ? 1 : -1) : draftAngle;
    setLiveAngle(ang); setLiveHeight(draftHeight); setLiveInitSpeed(draftInitSpd);
    setLiveHollowSph(draftHollowSph); setLiveHollowCyl(draftHollowCyl);
    if (changed) commitParam(ang, draftHeight, draftInitSpd, draftHollowSph, draftHollowCyl);
    setIsAdjusting(false); paramSnapshotRef.current = null;
  };

  // ── Pointer-drag guard (tap without drag triggers action) ─────────────────
  const pd = (fn) => (e) => {
    const startX = e.clientX ?? 0, startY = e.clientY ?? 0;
    let moved = false;
    const onMove = (me) => { if (Math.abs(me.clientX - startX) > 8 || Math.abs(me.clientY - startY) > 8) moved = true; };
    const onUp   = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); if (!moved) fn(); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
  };

  // ── Convenience display values ────────────────────────────────────────────
  const draftIsUphill = draftAngle < 0;
  const getDisplayY   = (I, maxT) => isUphill ? Physics.calcYUp(Math.min(time, maxT), I, theta, liveInitSpeed) : Math.min(Physics.calcYDown(time, I, theta), liveHeight);
  const getDisplayK   = (I, maxT) => Physics.calcK(Math.min(time, maxT), I, theta, isUphill, liveInitSpeed);
  const getPeakY      = (I)       => Physics.calcYUp(Physics.calcStopTime(I, theta, liveInitSpeed), I, theta, liveInitSpeed);

  const y_solid      = getDisplayY(I_solid,          maxTime_solid);
  const k_solid      = getDisplayK(I_solid,          maxTime_solid);
  const y_hollow     = getDisplayY(I_hollowSphere,   maxTime_hollowSphere);
  const k_hollow     = getDisplayK(I_hollowSphere,   maxTime_hollowSphere);
  const y_cylinder   = getDisplayY(I_cylinder,       maxTime_cylinder);
  const k_cylinder   = getDisplayK(I_cylinder,       maxTime_cylinder);
  const y_hollow_cyl = getDisplayY(I_hollowCylinder, maxTime_hollowCylinder);
  const k_hollow_cyl = getDisplayK(I_hollowCylinder, maxTime_hollowCylinder);

  const speedIdx   = SPEEDS.indexOf(displaySpeed);
  const isNegSpd   = displaySpeed < 0;
  const speedLabel = isNegSpd ? `◀ ${Math.abs(displaySpeed)}x` : `${displaySpeed}x ▶`;

  const kbdStyle = {
    display: 'inline-block', fontSize: '10px', color: '#aaa',
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: '4px', padding: '1px 5px', letterSpacing: '0.5px', fontFamily: 'monospace',
  };

  // ── Param row definitions ─────────────────────────────────────────────────
  const paramRows = [
    {
      label: draftIsUphill ? 'θ 斜面角度 (爬坡)' : 'θ 斜面角度 (下坡)',
      cls: 'sa', min: 1, max: 89, step: 1, val: Math.abs(draftAngle), unit: '°', color: '#ff6464', toFixed: 0,
      set: (v) => { const vv = draftIsUphill ? -Math.abs(v) : Math.abs(v); setDraftAngle(vv); commitRef.current.angle = vv; scheduleLiveUpdate(vv, commitRef.current.height, commitRef.current.initSpd, commitRef.current.hollowSph, commitRef.current.hollowCyl); },
      onRelease: () => commitParam(commitRef.current.angle, commitRef.current.height, commitRef.current.initSpd, commitRef.current.hollowSph, commitRef.current.hollowCyl),
      toggleDir: () => { const vv = -draftAngle; setDraftAngle(vv); setLiveAngle(vv); commitRef.current.angle = vv; commitParam(vv, commitRef.current.height, commitRef.current.initSpd, commitRef.current.hollowSph, commitRef.current.hollowCyl); },
    },
    draftIsUphill
      ? { label: '初速 V', cls: 'sh', min: 0.1, max: 30, step: 0.1, val: draftInitSpd, unit: ' m/s', color: '#ffaa44', toFixed: 1,
          set: (v) => { setDraftInitSpd(v); commitRef.current.initSpd = v; scheduleLiveUpdate(commitRef.current.angle, commitRef.current.height, v, commitRef.current.hollowSph, commitRef.current.hollowCyl); },
          onRelease: () => commitParam(commitRef.current.angle, commitRef.current.height, commitRef.current.initSpd, commitRef.current.hollowSph, commitRef.current.hollowCyl) }
      : { label: '斜面高度 H', cls: 'sh', min: 1, max: 30, step: 0.1, val: draftHeight, unit: ' m', color: '#64c864', toFixed: 1,
          set: (v) => { setDraftHeight(v); commitRef.current.height = v; scheduleLiveUpdate(commitRef.current.angle, v, commitRef.current.initSpd, commitRef.current.hollowSph, commitRef.current.hollowCyl); },
          onRelease: () => commitParam(commitRef.current.angle, commitRef.current.height, commitRef.current.initSpd, commitRef.current.hollowSph, commitRef.current.hollowCyl) },
    { label: '空心球中空比 x', cls: 'ss', min: 0.01, max: 0.99, step: 0.01, val: draftHollowSph, unit: '', color: '#ff8888', toFixed: 2,
      set: (v) => { setDraftHollowSph(v); commitRef.current.hollowSph = v; scheduleLiveUpdate(commitRef.current.angle, commitRef.current.height, commitRef.current.initSpd, v, commitRef.current.hollowCyl); },
      onRelease: () => commitParam(commitRef.current.angle, commitRef.current.height, commitRef.current.initSpd, commitRef.current.hollowSph, commitRef.current.hollowCyl) },
    { label: '空心柱中空比 x', cls: 'sc', min: 0.01, max: 0.99, step: 0.01, val: draftHollowCyl, unit: '', color: '#8888ff', toFixed: 2,
      set: (v) => { setDraftHollowCyl(v); commitRef.current.hollowCyl = v; scheduleLiveUpdate(commitRef.current.angle, commitRef.current.height, commitRef.current.initSpd, commitRef.current.hollowSph, v); },
      onRelease: () => commitParam(commitRef.current.angle, commitRef.current.height, commitRef.current.initSpd, commitRef.current.hollowSph, commitRef.current.hollowCyl) },
  ];

  const distLabel = isUphill ? '上升距離' : '下降距離';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ width:'100%', height:'100dvh', minWidth:'320px', display:'flex', flexDirection:'column', backgroundColor:'#0f1419', color:'#fff', fontFamily:"'JetBrains Mono','Courier New',monospace", userSelect:'none', touchAction:'pan-y' }}>

      {/* Mode banner */}
      {isUphill ? (
        <div style={{ background:'linear-gradient(90deg,rgba(255,160,80,0.18),rgba(255,200,80,0.12))', borderBottom:'1px solid rgba(255,160,80,0.35)', padding:'4px 16px', textAlign:'center', fontSize:'11px', fontWeight:'bold', color:'#ffaa44', letterSpacing:'1.5px', flexShrink:0 }}>
          ▲ 爬坡模式 ▲ &nbsp;|&nbsp; V = {liveInitSpeed} m/s &nbsp;|&nbsp; θ = {Math.abs(liveAngle)}°
        </div>
      ) : (
        <div style={{ background:'linear-gradient(90deg,rgba(80,200,120,0.18),rgba(80,255,150,0.12))', borderBottom:'1px solid rgba(80,200,120,0.35)', padding:'4px 16px', textAlign:'center', fontSize:'11px', fontWeight:'bold', color:'#66dd99', letterSpacing:'1.5px', flexShrink:0 }}>
          ▼ 下坡模式 ▼ &nbsp;|&nbsp; H = {liveHeight} m &nbsp;|&nbsp; θ = {Math.abs(liveAngle)}°
        </div>
      )}

      {/* Three.js canvas */}
      <div ref={mountRef} style={{ flex:1, width:'100%', position:'relative', minHeight:0 }} />

      {/* Bottom control panel */}
      <div style={{ background:'linear-gradient(180deg,rgba(10,14,20,0.98) 0%,rgba(16,24,40,0.99) 100%)', borderTop:'1px solid rgba(0,255,170,0.2)', boxShadow:'0 -6px 30px rgba(0,0,0,0.5)', flexShrink:0, paddingBottom:'env(safe-area-inset-bottom)' }}>

        <div style={{ padding:'14px 16px 8px' }}>

          {/* Adjusting notice */}
          {isAdjusting && (
            <div style={{ background:'rgba(255,200,80,0.1)', border:'1px solid rgba(255,200,80,0.3)', borderRadius:'8px', padding:'9px 14px', textAlign:'center', fontSize:'11px', color:'#ffcc44', marginBottom:'10px', letterSpacing:'0.5px', lineHeight:'1.6' }}>
              🔧 調整參數中 — 視覺即刻更新<br/><span style={{ fontSize:'10px', color:'#aaa' }}>關閉「參數控制」面板後才更新耗時計算</span>
            </div>
          )}

          {/* Timeline slider */}
          <div style={{ display: isAdjusting ? 'none' : undefined, marginBottom:'10px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
              <span className="cl" style={{ margin:0 }}>運動時間 t</span>
              <span style={{ fontSize:'18px', fontWeight:'bold', color:'#00ff88' }}>
                {time.toFixed(2)}s <span style={{ fontSize:'11px', color:'#555' }}>/ {sliderMax.toFixed(2)}s</span>
              </span>
            </div>
            <input type="range" min="0" max={sliderMax} step={timeStep} value={time} className="st"
              onChange={e => { setPlaying(false); setTime(parseFloat(e.target.value)); }}
              onMouseUp={e => e.target?.blur()} onTouchEnd={e => e.target?.blur()}
              style={{ width:'100%' }} />
          </div>

          {/* Speed chips + playback buttons */}
          <div style={{ display: isAdjusting ? 'none' : undefined, marginBottom:'12px' }}>
            <div style={{ justifyContent:'center', gap:'4px', marginBottom:'8px', flexWrap:'wrap', display:'flex' }}>
              {SPEEDS.map(s => (
                <div key={s} className="spd-chip" onPointerDown={pd(() => handleSetSpeed(s))}
                  style={{ fontWeight: s === displaySpeed ? 'bold' : 'normal', color: s === displaySpeed ? (s < 0 ? '#ffaa44' : '#88aaff') : '#555', background: s === displaySpeed ? (s < 0 ? 'rgba(255,160,80,0.18)' : 'rgba(100,150,255,0.15)') : 'transparent', border:`1px solid ${s === displaySpeed ? (s < 0 ? 'rgba(255,160,80,0.4)' : 'rgba(100,150,255,0.4)') : 'rgba(255,255,255,0.1)'}` }}>
                  {s < 0 ? `◀${Math.abs(s)}` : `${s}▶`}
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr 1fr', gap:'8px', alignItems:'start' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                <div style={{ fontSize:'10px', color:'#888', textAlign:'center', height:'16px' }}><span style={kbdStyle}>←</span></div>
                <button className="pb" style={{ width:'100%', height:'44px', fontSize:'22px', borderColor:'rgba(255,200,80,0.35)', color: speedIdx <= 0 ? 'rgba(255,200,80,0.25)' : '#ffcc44', background:'rgba(255,200,80,0.07)', opacity: speedIdx <= 0 ? 0.4 : 1 }}
                  onPointerDown={pd(() => { if (speedIdx > 0) handleSetSpeed(SPEEDS[speedIdx - 1]); })}>&#x23EA;</button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                <div style={{ fontSize:'10px', color:'#888', textAlign:'center', height:'16px' }}><span style={kbdStyle}>Space</span></div>
                <button className="pb" style={{ width:'100%', height:'44px', fontSize:'15px', borderColor:'rgba(0,255,136,0.4)', color:'#00ff88', background: playing ? 'rgba(0,255,136,0.18)' : 'rgba(0,255,136,0.07)' }}
                  onPointerDown={pd(() => setPlaying(p => !p))}>
                  {playing ? '⏸ 暫停' : '▶ 播放'}
                </button>
                <div style={{ fontSize:'13px', fontWeight:'bold', color: isNegSpd ? '#ffaa44' : '#88aaff', letterSpacing:'1px' }}>{speedLabel}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                <div style={{ fontSize:'10px', color:'#888', textAlign:'center', height:'16px' }}><span style={kbdStyle}>→</span></div>
                <button className="pb" style={{ width:'100%', height:'44px', fontSize:'22px', borderColor:'rgba(255,200,80,0.35)', color: speedIdx >= SPEEDS.length - 1 ? 'rgba(255,200,80,0.25)' : '#ffcc44', background:'rgba(255,200,80,0.07)', opacity: speedIdx >= SPEEDS.length - 1 ? 0.4 : 1 }}
                  onPointerDown={pd(() => { if (speedIdx < SPEEDS.length - 1) handleSetSpeed(SPEEDS[speedIdx + 1]); })}>&#x23E9;</button>
              </div>
            </div>
          </div>

          {/* Detail panel toggle */}
          <div onPointerDown={pd(() => setSecPanel(p => {
            if (p) { if (secParams) doCommitAndClose(); setSecParams(false); setSecData(false); setSecFormula(false); }
            else { if (scrollRef.current) scrollRef.current.scrollTop = 0; }
            return !p;
          }))} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 14px', borderRadius:'9px', cursor:'pointer', background: secPanel ? 'linear-gradient(90deg,rgba(0,255,136,0.10) 0%,rgba(100,150,255,0.08) 100%)' : 'rgba(255,255,255,0.04)', border:`1px solid ${secPanel ? 'rgba(0,255,136,0.35)' : 'rgba(255,255,255,0.1)'}`, transition:'all 0.25s ease', userSelect:'none', WebkitTapHighlightColor:'transparent', touchAction:'manipulation' }}>
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', textAlign:'center' }}>
              <span style={{ fontSize:'12px', fontWeight:'bold', letterSpacing:'1.2px', textTransform:'uppercase', color: secPanel ? '#e0e0e0' : '#777', transition:'color 0.25s ease' }}>詳細面板</span>
              <span style={{ fontSize:'10px', color: secPanel ? 'rgba(0,255,136,0.7)' : '#444', transition:'color 0.25s ease' }}>參數 · 數據 · 公式</span>
            </div>
            <span style={{ fontSize:'16px', color: secPanel ? '#00ff88' : '#555', transform: secPanel ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.28s ease, color 0.25s ease', lineHeight:1, flexShrink:0 }}>▾</span>
          </div>
        </div>

        {/* Expandable detail panel */}
        <div style={{ overflow:'hidden', maxHeight: secPanel ? 'calc(50vh - 80px)' : '0', transition:'max-height 0.35s cubic-bezier(0.4,0,0.2,1)' }}>
          <div ref={scrollRef} style={{ maxHeight:'calc(50vh - 130px)', overflowY:'auto', overflowX:'hidden', WebkitOverflowScrolling:'touch', padding:'4px 16px 20px' }}>

            {/* ── Parameters section ── */}
            <div style={{ marginBottom:'10px' }}>
              <SectionHeader title="參數控制" open={secParams} accent="#00ff88"
                count={draftIsUphill ? "θ 斜面角度 · 初速 V\n空心球中空比 · 空心柱中空比" : "θ 斜面角度 · 斜面高度 H\n空心球中空比 · 空心柱中空比"}
                onToggle={() => {
                  if (secParams) { doCommitAndClose(); }
                  else {
                    paramSnapshotRef.current = { angle:liveAngle, height:liveHeight, initSpd:liveInitSpeed, hollowSph:liveHollowSph, hollowCyl:liveHollowCyl };
                    commitRef.current = { angle:liveAngle, height:liveHeight, initSpd:liveInitSpeed, hollowSph:liveHollowSph, hollowCyl:liveHollowCyl };
                    setDraftAngle(liveAngle); setDraftHeight(liveHeight); setDraftInitSpd(liveInitSpeed);
                    setDraftHollowSph(liveHollowSph); setDraftHollowCyl(liveHollowCyl);
                    setIsAdjusting(true); setPlaying(false);
                  }
                  setSecParams(p => !p);
                }} />
              <div className={`collapsible-body ${secParams ? 'open' : 'closed'}`} style={{ maxHeight: secParams ? '400px' : '0' }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'14px', paddingBottom:'4px' }}>
                  {paramRows.map(({ label, cls, min, max, step, val, set, onRelease, unit, color, toFixed, toggleDir }) => (
                    <div key={label}>
                      <div className="cl" style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                        <span>{label}</span>
                        {toggleDir && (
                          <button onPointerDown={pd(toggleDir)}
                            style={{ fontSize:'11px', padding:'3px 10px', borderRadius:'6px', border:'1px solid rgba(255,150,100,0.7)', background:'rgba(255,100,60,0.25)', color:'#ffaa77', cursor:'pointer', lineHeight:'1.6', flexShrink:0, fontWeight:'bold' }}>
                            {draftIsUphill ? '↓ 改下坡' : '↑ 改爬坡'}
                          </button>
                        )}
                      </div>
                      <div className="cr">
                        <input type="range" min={min} max={max} step={step} value={val} className={cls}
                          onChange={e => set(parseFloat(e.target.value))}
                          onMouseUp={() => onRelease && onRelease()}
                          onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopPropagation(); }}
                          onKeyUp={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { onRelease && onRelease(); } }}
                          onTouchEnd={e => { e.target?.blur(); onRelease && onRelease(); }}
                          style={{ flex:1 }} />
                        <input type="number" min={min} max={max} step={step} value={val}
                          onChange={e => set(parseFloat(e.target.value) || min)}
                          onBlur={() => onRelease && onRelease()}
                          style={{ width:'52px' }} />
                      </div>
                      <div className="cv" style={{ color }}>{typeof val === 'number' ? val.toFixed(toFixed) : val}{unit}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ height:'1px', background:'rgba(0,255,136,0.08)', marginBottom:'10px' }} />

            {/* ── Data section ── */}
            <div style={{ marginBottom:'10px' }}>
              <SectionHeader title="物體數據" open={secData} onToggle={() => setSecData(p => !p)} accent="#88aaff"
                count={`實心球 · 空心球 · 實心圓柱 · 空心圓柱\nt = ${time.toFixed(2)}s`} />
              <div className={`collapsible-body ${secData ? 'open' : 'closed'}`} style={{ maxHeight: secData ? '700px' : '0' }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'10px', paddingBottom:'4px' }}>
                  {[
                    { label:'實心球',   sub:'',                                       color:'#ff6464', bg:'rgba(255,68,68,0.1)',   border:'rgba(255,68,68,0.3)',   I:I_solid,         y:y_solid,      k:k_solid,      stopped:solidStopped,    maxT:maxTime_solid,         peakY:getPeakY(I_solid),         rankKey:'solid' },
                    { label:'空心球',   sub:` 中空比=${liveHollowSph.toFixed(2)}`,   color:'#ff8888', bg:'rgba(255,100,68,0.08)', border:'rgba(255,100,100,0.3)', I:I_hollowSphere,  y:y_hollow,     k:k_hollow,     stopped:hollowStopped,   maxT:maxTime_hollowSphere,  peakY:getPeakY(I_hollowSphere),  rankKey:'hollow' },
                    { label:'實心圓柱', sub:'',                                       color:'#6464ff', bg:'rgba(68,68,255,0.1)',   border:'rgba(68,68,255,0.3)',   I:I_cylinder,      y:y_cylinder,   k:k_cylinder,   stopped:cylinderStopped, maxT:maxTime_cylinder,      peakY:getPeakY(I_cylinder),      rankKey:'cylinder' },
                    { label:'空心圓柱', sub:` 中空比=${liveHollowCyl.toFixed(2)}`,   color:'#8888ff', bg:'rgba(68,68,255,0.08)',  border:'rgba(100,100,255,0.3)', I:I_hollowCylinder,y:y_hollow_cyl, k:k_hollow_cyl, stopped:hollowCylStopped,maxT:maxTime_hollowCylinder,peakY:getPeakY(I_hollowCylinder),rankKey:'hollowCyl' },
                  ].map(({ label, sub, color, bg, border, I, y, k, stopped, maxT, peakY, rankKey }) => (
                    <div key={label} className="card" style={{ background: bg, border: `1px solid ${border}` }}>
                      <div style={{ color, fontWeight:'bold', marginBottom:'4px' }}>{label}{sub}</div>
                      <div style={{ color:'#ccc' }}>轉動慣量 = {I.toFixed(3)}</div>
                      <div style={{ color:'#ccc' }}>{distLabel} = {y.toFixed(3)} m</div>
                      <div style={{ color:'#ccc' }}>旋轉角度 = {(k * 180 / Math.PI).toFixed(1)}°</div>
                      {isUphill && stopped && <div style={{ color:'#aaffcc', marginTop:'4px', fontSize:'11px' }}>最高點 = {peakY.toFixed(3)} m</div>}
                      {stopped && <div style={{ color:'#ffff44', marginTop:'2px', fontSize:'11px' }}>
                        {isUphill ? `✓ 停止時間 ${Physics.calcStopTime(I, theta, liveInitSpeed).toFixed(2)}s — 第${getRealTimeRank(rankKey, true)}名`
                                  : `✓ ${maxT.toFixed(2)}s — 第${getRealTimeRank(rankKey, true)}名`}
                      </div>}
                      {stopped && !allStopped && <div style={{ color:'#888', marginTop:'4px', fontSize:'11px' }}>⏳ 等待其他...</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ height:'1px', background:'rgba(0,255,136,0.08)', marginBottom:'10px' }} />

            {/* ── Formula section ── */}
            <div style={{ marginBottom:'4px' }}>
              <SectionHeader title="基本公式" open={secFormula} onToggle={() => setSecFormula(p => !p)}
                count={isUphill ? "▲爬坡 | 轉動慣量 · y(t) · Y(t) · k(t)\ns(t) · 球心位置 · 擺線軌跡" : "▼下坡 | 轉動慣量 · y(t) · k(t)\ns(t) · 球心位置 · 擺線軌跡"} accent="#ffcc44" />
              <div className={`collapsible-body ${secFormula ? 'open' : 'closed'}`} style={{ maxHeight: secFormula ? '1100px' : '0' }}>
                <div style={{ background:'rgba(0,255,136,0.04)', border:'1px solid rgba(0,255,136,0.12)', borderRadius:'10px', padding:'14px', fontSize:'11px', fontFamily:"'Courier New',monospace", lineHeight:'2.0', color:'#ccc' }}>
                  <div style={{ marginBottom:'10px', padding:'5px 10px', borderRadius:'6px', background: isUphill ? 'rgba(255,160,80,0.12)' : 'rgba(0,255,136,0.08)', border:`1px solid ${isUphill ? 'rgba(255,160,80,0.35)' : 'rgba(0,255,136,0.25)'}`, color: isUphill ? '#ffaa44' : '#00ff88', fontWeight:'bold', letterSpacing:'1px', textAlign:'center' }}>
                    {isUphill ? '▲ 爬坡模式' : '▼ 下坡模式'}
                  </div>
                  <div style={{ color:'#ffff88', marginBottom:'8px' }}>r={r} m | m=1 kg | g={g} m/s² | θ={Math.abs(liveAngle)}°{isUphill ? ` | V=${liveInitSpeed} m/s` : ` | H=${liveHeight} m`}</div>
                  <div style={{ marginBottom:'10px' }}>
                    <span className="fk">轉動慣量：</span><br/>
                    I(實心球) = 2/5·mr² = <span className="fv">{I_solid.toFixed(4)}</span><br/>
                    I(空心球) = 2/5·mr²·(1−x⁵)/(1−x³) = <span className="fv">{I_hollowSphere.toFixed(4)}</span><br/>
                    I(實心柱) = 1/2·mr² = <span className="fv">{I_cylinder.toFixed(4)}</span><br/>
                    I(空心柱) = 1/2·mr²·(1−x⁴)/(1−x²) = <span className="fv">{I_hollowCylinder.toFixed(4)}</span>
                  </div>
                  <div style={{ marginBottom:'10px' }}>
                    <span className="fk">滾動距離垂直分量 y(t)：</span><br/>
                    y(t) = [mr²g / (mr²+I)] · sin²θ · t² / 2
                  </div>
                  {isUphill ? (
                    <div style={{ marginBottom:'10px' }}>
                      <span className="fk">上升垂直距離 Y(t)【爬坡】：</span><br/>
                      Y(t) = V·t·sinθ − y(t)<br/>
                      停止時間 t_stop = V·(mr²+I) / (mr²·g·sinθ)
                    </div>
                  ) : (
                    <div style={{ marginBottom:'10px' }}>
                      <span className="fk">下降垂直距離【下坡】：</span><br/>
                      y(t) 即為下降垂直距離，上限為 H = {liveHeight} m
                    </div>
                  )}
                  <div style={{ marginBottom:'10px' }}>
                    <span className="fk">旋轉角弧度 k(t)：</span><br/>
                    {isUphill ? <>k(t) = Y(t) / (r · sinθ)</> : <>k(t) = y(t) / (r · sinθ)</>}
                  </div>
                  <div style={{ marginBottom:'10px' }}>
                    <span className="fk">沿斜面距離 s(t)：</span><br/>
                    {isUphill ? <>s(t) = Y(t) / sinθ</> : <>s(t) = y(t) / sinθ</>}
                  </div>
                  <div style={{ marginBottom:'10px' }}>
                    <span className="fk">球/柱心位置：</span><br/>
                    {isUphill ? (<>x_c = s·cosθ − r·sinθ<br/>y_c = s·sinθ + r·cosθ<br/><span style={{ color:'#888', fontSize:'10px' }}>法線方向 = (−sinθ, cosθ)</span></>) : (<>x_c = s·cosθ + r·sinθ<br/>y_c = −s·sinθ + r·cosθ<br/><span style={{ color:'#888', fontSize:'10px' }}>法線方向 = (sinθ, cosθ)</span></>)}
                  </div>
                  <div style={{ borderTop:'1px solid rgba(0,255,136,0.15)', paddingTop:'10px' }}>
                    <span className="fk">軌跡點座標（擺線 cycloid）</span><br/>
                    {isUphill ? (<>x_p = s·cosθ − r·sinθ·(1−cos k) − r·cosθ·sin k<br/>y_p = s·sinθ + r·cosθ·(1−cos k) − r·sinθ·sin k</>) : (<>x_p = x_c − r·sinθ·cos k − r·cosθ·sin k<br/>y_p = y_c − r·cosθ·cos k + r·sinθ·sin k</>)}
                    <br/><span style={{ color:'#888', fontSize:'10px' }}>|接觸點 − 球心| = r 恆成立；k=2nπ 時接觸點落回斜面</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
