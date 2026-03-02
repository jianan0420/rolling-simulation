import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function MultiSphereSimulation() {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  
  const sphereRef = useRef(null);
  const hollowSphereRef = useRef(null);
  const cylinderRef = useRef(null);
  const hollowCylinderRef = useRef(null);
  
  const rankingLabelRef = useRef(null);
  const trailRef = useRef(null);
  
  const [time, setTime] = useState(0);
  const [slopeAngle, setSlopeAngle] = useState(30);
  const [slopeHeight, setSlopeHeight] = useState(10);
  const [hollowSpherThickness, setHollowSphereThickness] = useState(0.5);
  const [hollowCylinderThickness, setHollowCylinderThickness] = useState(0.5);
  
  const timeStep = 0.02;
  const gap = 2;
  
  const r = 1;
  const m = 1;
  const g = 9.8;
  const I_solid = (2 / 5) * m * r * r;
  
  const theta = (slopeAngle * Math.PI) / 180;
  
  const I_hollowSphere = 0.4 * ((1 - Math.pow(1 - hollowSpherThickness, 5)) / (1 - Math.pow(1 - hollowSpherThickness, 3))) * m * r * r;
  const I_cylinder = 0.5 * m * r * r;
  const I_hollowCylinder = 0.5 * ((1 - Math.pow(1 - hollowCylinderThickness, 4)) / (1 - Math.pow(1 - hollowCylinderThickness, 2))) * m * r * r;

  const calculateY = (t, I) => {
    const coefficient = (m * r * r * g) / (m * r * r + I);
    const sinTheta = Math.sin(theta);
    return coefficient * ((sinTheta * sinTheta * t * t) / 2);
  };

  const calculateK = (t, I) => {
    const y = calculateY(t, I);
    const sinTheta = Math.sin(theta);
    const kDegrees = (y / sinTheta) * (180 / (r * Math.PI));
    return (kDegrees * Math.PI) / 180;
  };

  const calculateMaxTimeForI = (I) => {
    const coefficient = (m * r * r * g) / (m * r * r + I);
    const sinTheta = Math.sin(theta);
    let t_squared = (2 * slopeHeight) / (coefficient * sinTheta * sinTheta);
    let t = Math.sqrt(Math.max(t_squared, 0.01));
    let low = t * 0.99;
    let high = t * 1.05;
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      const y = calculateY(mid, I);
      if (y < slopeHeight) { low = mid; } else { high = mid; }
    }
    return high;
  };

  const maxTime_solid = calculateMaxTimeForI(I_solid);
  const maxTime_hollowSphere = calculateMaxTimeForI(I_hollowSphere);
  const maxTime_cylinder = calculateMaxTimeForI(I_cylinder);
  const maxTime_hollowCylinder = calculateMaxTimeForI(I_hollowCylinder);
  const maxTime = Math.max(maxTime_solid, maxTime_hollowSphere, maxTime_cylinder, maxTime_hollowCylinder);

  const hasReachedHeight = (t, I) => calculateY(t, I) > slopeHeight;

  const getObjectPosition = (t, I, zOffset) => {
    const y = calculateY(t, I);
    const clampedY = Math.min(y, slopeHeight);
    const tanTheta = Math.tan(theta);
    return new THREE.Vector3(clampedY / tanTheta, r - clampedY, zOffset);
  };

  const getPointPosition = (t, I, zOffset) => {
    const y = calculateY(t, I);
    const clampedY = Math.min(y, slopeHeight);
    const k = calculateK(t, I);
    const tanTheta = Math.tan(theta);
    const sinKHalf = Math.sin(k / 2);
    const cosKHalf = Math.cos(k / 2);
    return new THREE.Vector3(
      clampedY / tanTheta - 2 * r * sinKHalf * cosKHalf,
      2 * r * sinKHalf * sinKHalf - clampedY,
      zOffset
    );
  };

  // ─── 靜態排名表（參數變更時重新計算，不依賴動態偵測）───
  const staticRankTableRef = useRef({});

  useEffect(() => {
    const entries = [
      { name: 'solid',     arrivalTime: maxTime_solid },
      { name: 'hollow',    arrivalTime: maxTime_hollowSphere },
      { name: 'cylinder',  arrivalTime: maxTime_cylinder },
      { name: 'hollowCyl', arrivalTime: maxTime_hollowCylinder },
    ];
    entries.sort((a, b) => a.arrivalTime - b.arrivalTime);
    const table = {};
    entries.forEach((obj, idx) => {
      table[obj.name] = { rank: idx + 1, arrivalTime: obj.arrivalTime };
    });
    staticRankTableRef.current = table;
  }, [maxTime_solid, maxTime_hollowSphere, maxTime_cylinder, maxTime_hollowCylinder]);

  // ─── 各物體「是否已到達」的 state，每個獨立管理 ───
  const [solidArrived,     setSolidArrived]     = useState(false);
  const [hollowArrived,    setHollowArrived]    = useState(false);
  const [cylinderArrived,  setCylinderArrived]  = useState(false);
  const [hollowCylArrived, setHollowCylArrived] = useState(false);

  // 容差：slopeHeight 的 0.5%，確保滑桿步長造成的最後一格誤差也能觸發
  const arrivalTolerance = slopeHeight * 0.005;

  // ─── 4 個獨立事件監聽：各自只關心自己的到達條件 ───
  useEffect(() => {
    setSolidArrived(calculateY(time, I_solid) >= slopeHeight - arrivalTolerance);
  }, [time, maxTime_solid]);

  useEffect(() => {
    setHollowArrived(calculateY(time, I_hollowSphere) >= slopeHeight - arrivalTolerance);
  }, [time, maxTime_hollowSphere]);

  useEffect(() => {
    setCylinderArrived(calculateY(time, I_cylinder) >= slopeHeight - arrivalTolerance);
  }, [time, maxTime_cylinder]);

  useEffect(() => {
    setHollowCylArrived(calculateY(time, I_hollowCylinder) >= slopeHeight - arrivalTolerance);
  }, [time, maxTime_hollowCylinder]);

  const getRankIfArrived = (name, arrived) => {
    if (!arrived) return null;
    return staticRankTableRef.current[name]?.rank ?? null;
  };

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1419);

    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
    camera.position.set(0, 12, 25);
    camera.lookAt(0, -5, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const sinTheta = Math.sin(theta);
    const tanTheta = Math.tan(theta);
    const cosTheta = Math.cos(theta);
    const slopeWidthX = slopeHeight / sinTheta;
    // 斜面 z 範圍：±(4r + 2*gap)
    const slopeWidthZ = 2 * (4 * r + 2 * gap);
    
    const slopeGeometry = new THREE.PlaneGeometry(slopeWidthX, slopeWidthZ);
    const slopeMaterial = new THREE.MeshPhongMaterial({
      color: 0x3a6a8a,
      shininess: 20,
      side: THREE.DoubleSide,
      wireframe: false
    });
    const slope = new THREE.Mesh(slopeGeometry, slopeMaterial);
    
    const quatX = new THREE.Quaternion();
    quatX.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    
    const quatZ = new THREE.Quaternion();
    quatZ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -theta);
    
    slope.quaternion.multiplyQuaternions(quatZ, quatX);
    
    const positionX = (slopeWidthX / 2) * cosTheta;
    const positionY = -slopeHeight / 2 - r / cosTheta;
    slope.position.set(positionX, positionY, 0);
    slope.castShadow = true;
    slope.receiveShadow = true;
    scene.add(slope);

    const slopeEdges = new THREE.EdgesGeometry(slopeGeometry);
    const slopeLine = new THREE.LineSegments(
      slopeEdges,
      new THREE.LineBasicMaterial({ color: 0x00ffaa, linewidth: 2 })
    );
    slopeLine.quaternion.multiplyQuaternions(quatZ, quatX);
    slopeLine.position.set(positionX, positionY, 0);
    scene.add(slopeLine);

    const sphereGeometry = new THREE.SphereGeometry(r, 32, 32);
    const sphereMaterial = new THREE.MeshPhongMaterial({
      color: 0xff4444,
      shininess: 100,
      emissive: 0xff2222
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    scene.add(sphere);
    sphereRef.current = sphere;

    const hollowSphereGeometry = new THREE.SphereGeometry(r, 32, 32);
    const hollowSphereMaterial = new THREE.MeshPhongMaterial({
      color: 0xff6666,
      shininess: 80,
      emissive: 0x220000,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const hollowSphere = new THREE.Mesh(hollowSphereGeometry, hollowSphereMaterial);
    hollowSphere.castShadow = true;
    hollowSphere.receiveShadow = true;
    scene.add(hollowSphere);
    hollowSphereRef.current = hollowSphere;

    const cylinderGeometry = new THREE.CylinderGeometry(r, r, 2 * r, 32);
    const cylinderMaterial = new THREE.MeshPhongMaterial({
      color: 0x4444ff,
      shininess: 100
    });
    const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
    cylinder.castShadow = true;
    cylinder.receiveShadow = true;
    scene.add(cylinder);
    cylinderRef.current = cylinder;

    const hollowCylinderGeometry = new THREE.CylinderGeometry(r, r, 2 * r, 32);
    const hollowCylinderMaterial = new THREE.MeshPhongMaterial({
      color: 0x6688ff,
      shininess: 80,
      emissive: 0x001133,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const hollowCylinder = new THREE.Mesh(hollowCylinderGeometry, hollowCylinderMaterial);
    hollowCylinder.castShadow = true;
    hollowCylinder.receiveShadow = true;
    scene.add(hollowCylinder);
    hollowCylinderRef.current = hollowCylinder;

    const trail = new THREE.Group();
    scene.add(trail);
    trailRef.current = trail;

    const rankingLabels = new THREE.Group();
    scene.add(rankingLabels);
    rankingLabelRef.current = rankingLabels;

    const handleResize = () => {
      const newWidth = mountRef.current.clientWidth;
      const newHeight = mountRef.current.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
      }
      renderer.dispose();
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [slopeAngle, slopeHeight, hollowSpherThickness, hollowCylinderThickness]);

  useEffect(() => {
    if (!sphereRef.current) return;

    const trail = trailRef.current;
    const rankingLabels = rankingLabelRef.current;

    // 從靜態排名表 + 各物體獨立 arrived state 取得當前應顯示的排名
    // 每個物體由自己的 useEffect 獨立控制 arrived，不互相競爭
    const rankSolid     = getRankIfArrived('solid',     solidArrived);
    const rankHollow    = getRankIfArrived('hollow',    hollowArrived);
    const rankCylinder  = getRankIfArrived('cylinder',  cylinderArrived);
    const rankHollowCyl = getRankIfArrived('hollowCyl', hollowCylArrived);

    const updateObject = (mesh, I, zOffset, isCylinder = false) => {
      const pos = getObjectPosition(time, I, zOffset);
      mesh.position.copy(pos);
      
      const k = calculateK(time, I);
      
      if (isCylinder) {
        const quatX_cyl = new THREE.Quaternion();
        quatX_cyl.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        const quatZ_cyl = new THREE.Quaternion();
        quatZ_cyl.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -k);
        mesh.quaternion.multiplyQuaternions(quatZ_cyl, quatX_cyl);
      } else {
        mesh.rotation.z = k;
      }
    };

    // 斜面寬 ±(4r+2*gap)，每個物體佔 2r，間隔 gap，兩端各留 0.5*gap
    // z: 實心球 -(3r+1.5gap), 空心球 -(r+0.5gap), 實心圓柱 +(r+0.5gap), 空心圓柱 +(3r+1.5gap)
    const z_sphere         = -(3 * r + 1.5 * gap);
    const z_hollowSphere   = -(1 * r + 0.5 * gap);
    const z_cylinder       =  (1 * r + 0.5 * gap);
    const z_hollowCylinder =  (3 * r + 1.5 * gap);

    updateObject(sphereRef.current, I_solid, z_sphere, false);
    updateObject(hollowSphereRef.current, I_hollowSphere, z_hollowSphere, false);
    updateObject(cylinderRef.current, I_cylinder, z_cylinder, true);
    updateObject(hollowCylinderRef.current, I_hollowCylinder, z_hollowCylinder, true);

    // 清除舊排名標籤
    while (rankingLabels.children.length > 0) {
      rankingLabels.remove(rankingLabels.children[0]);
    }

    const displayRankingLabel = (mesh, rank) => {
      if (rank !== null && rank !== undefined) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.beginPath();
        ctx.arc(128, 128, 120, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(128, 128, 120, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 120px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rank, 128, 128);
        
        const spriteMap = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: spriteMap });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(1.5, 1.5, 1.5);
        sprite.position.copy(mesh.position);
        sprite.position.y += 2;
        rankingLabels.add(sprite);
      }
    };

    displayRankingLabel(sphereRef.current,       rankSolid);
    displayRankingLabel(hollowSphereRef.current,  rankHollow);
    displayRankingLabel(cylinderRef.current,      rankCylinder);
    displayRankingLabel(hollowCylinderRef.current, rankHollowCyl);

    while (trail.children.length > 0) {
      trail.remove(trail.children[0]);
    }

    const drawTrail = (I, zOffset, color) => {
      const fullPoints = [];
      for (let t = 0; t <= maxTime; t += timeStep) {
        const pos = getPointPosition(t, I, zOffset);
        fullPoints.push(pos);
      }
      
      if (fullPoints.length > 1) {
        const geometry = new THREE.BufferGeometry().setFromPoints(fullPoints);
        const line = new THREE.Line(
          geometry,
          new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.3, linewidth: 2 })
        );
        trail.add(line);
      }

      const passedPoints = [];
      for (let t = 0; t <= time; t += timeStep) {
        const pos = getPointPosition(t, I, zOffset);
        passedPoints.push(pos);
      }
      
      if (passedPoints.length > 1) {
        const geometry = new THREE.BufferGeometry().setFromPoints(passedPoints);
        const line = new THREE.Line(
          geometry,
          new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.95, linewidth: 3 })
        );
        trail.add(line);
      }
    };

    drawTrail(I_solid, z_sphere, 0xff6464);
    drawTrail(I_hollowSphere, z_hollowSphere, 0xff8888);
    drawTrail(I_cylinder, z_cylinder, 0x6464ff);
    drawTrail(I_hollowCylinder, z_hollowCylinder, 0x8888ff);

    let fastestObject = sphereRef.current;
    let fastestY = calculateY(time, I_solid);

    const checkFastest = (I, mesh) => {
      const y = calculateY(time, I);
      if (y > fastestY && !hasReachedHeight(time, I)) {
        fastestY = y;
        fastestObject = mesh;
      }
    };

    checkFastest(I_hollowSphere, hollowSphereRef.current);
    checkFastest(I_cylinder, cylinderRef.current);
    checkFastest(I_hollowCylinder, hollowCylinderRef.current);

    if (cameraRef.current && fastestObject) {
      const offset = new THREE.Vector3(0, 7, 20);
      cameraRef.current.position.copy(fastestObject.position).add(offset);
      cameraRef.current.lookAt(fastestObject.position.x, fastestObject.position.y - 2, fastestObject.position.z);
    }
  }, [time, slopeAngle, slopeHeight, hollowSpherThickness, hollowCylinderThickness,
      solidArrived, hollowArrived, cylinderArrived, hollowCylArrived]);

  // 改斜面角度或高度時重置時間（arrived state 由各自 useEffect 自動聯動清除）
  useEffect(() => {
    setTime(0);
  }, [slopeAngle, slopeHeight]);

  // 改壁厚時也重置時間
  useEffect(() => {
    setTime(0);
  }, [hollowSpherThickness, hollowCylinderThickness]);

  const y_solid = calculateY(time, I_solid);
  const k_solid = calculateK(time, I_solid);
  const y_hollow = calculateY(time, I_hollowSphere);
  const k_hollow = calculateK(time, I_hollowSphere);
  const y_cylinder = calculateY(time, I_cylinder);
  const k_cylinder = calculateK(time, I_cylinder);
  const y_hollow_cyl = calculateY(time, I_hollowCylinder);
  const k_hollow_cyl = calculateK(time, I_hollowCylinder);

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0f1419',
      color: '#fff',
      fontFamily: "'JetBrains Mono', 'Courier New', monospace"
    }}>
      <style>{`
        .slider-angle { accent-color: #ff6464; }
        .slider-height { accent-color: #64c864; }
        .slider-hollow-sphere { accent-color: #ff8888; }
        .slider-hollow-cyl { accent-color: #8888ff; }
        .slider-time { accent-color: #00ff88; }

        input[type=range] {
          height: 6px;
          border-radius: 3px;
          cursor: pointer;
          outline: none;
          border: none;
          background: rgba(255,255,255,0.08);
        }
        input[type=range]::-webkit-slider-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid rgba(0,0,0,0.4);
          box-shadow: 0 0 6px currentColor;
        }
        input[type=range]::-webkit-slider-runnable-track {
          border-radius: 3px;
          height: 6px;
        }

        input[type=number] {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 4px;
          color: #fff;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          text-align: center;
        }
        input[type=number]:focus {
          outline: none;
          border-color: rgba(0,255,136,0.5);
        }
      `}</style>
      <div ref={mountRef} style={{ flex: 1, width: '100%', position: 'relative' }} />

      <div style={{
        padding: '20px',
        background: 'linear-gradient(135deg, rgba(15,20,25,0.98) 0%, rgba(30,40,60,0.98) 100%)',
        borderTop: '1px solid rgba(0,255,170,0.2)',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.7)',
        maxHeight: '60vh',
        overflowY: 'auto'
      }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '20px',
            marginBottom: '20px',
            paddingBottom: '20px',
            borderBottom: '1px solid rgba(0,255,136,0.15)'
          }}>
            {/* 斜面角度 */}
            <div>
              <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '8px' }}>θ 斜面角度</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input type="range" min="1" max="89" step="1" value={slopeAngle} className="slider-angle"
                  onChange={(e) => setSlopeAngle(parseFloat(e.target.value))} style={{ flex: 1 }} />
                <input type="number" min="1" max="89" value={slopeAngle}
                  onChange={(e) => setSlopeAngle(parseFloat(e.target.value) || 0)}
                  style={{ width: '50px', padding: '4px' }} />
              </div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ff6464', marginTop: '4px' }}>{slopeAngle.toFixed(1)}°</div>
            </div>

            {/* 斜面高度 */}
            <div>
              <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '8px' }}>斜面高度 (H)</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input type="range" min="1" max="30" step="0.5" value={slopeHeight} className="slider-height"
                  onChange={(e) => setSlopeHeight(parseFloat(e.target.value))} style={{ flex: 1 }} />
                <input type="number" min="1" max="30" step="0.5" value={slopeHeight}
                  onChange={(e) => setSlopeHeight(parseFloat(e.target.value) || 0)}
                  style={{ width: '50px', padding: '4px' }} />
              </div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#64c864', marginTop: '4px' }}>{slopeHeight.toFixed(1)} m</div>
            </div>

            {/* 空心球壁厚 */}
            <div>
              <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '8px' }}>空心球壁厚比例 (x)</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input type="range" min="0.01" max="0.99" step="0.01" value={hollowSpherThickness} className="slider-hollow-sphere"
                  onChange={(e) => setHollowSphereThickness(parseFloat(e.target.value))} style={{ flex: 1 }} />
                <input type="number" min="0.01" max="0.99" step="0.01" value={hollowSpherThickness}
                  onChange={(e) => setHollowSphereThickness(parseFloat(e.target.value) || 0.01)}
                  style={{ width: '50px', padding: '4px' }} />
              </div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#ff6464', marginTop: '4px' }}>{hollowSpherThickness.toFixed(2)}</div>
            </div>

            {/* 空心圓柱壁厚 */}
            <div>
              <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '8px' }}>空心圓柱壁厚比例 (x)</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input type="range" min="0.01" max="0.99" step="0.01" value={hollowCylinderThickness} className="slider-hollow-cyl"
                  onChange={(e) => setHollowCylinderThickness(parseFloat(e.target.value))} style={{ flex: 1 }} />
                <input type="number" min="0.01" max="0.99" step="0.01" value={hollowCylinderThickness}
                  onChange={(e) => setHollowCylinderThickness(parseFloat(e.target.value) || 0.01)}
                  style={{ width: '50px', padding: '4px' }} />
              </div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#4444ff', marginTop: '4px' }}>{hollowCylinderThickness.toFixed(2)}</div>
            </div>

            {/* 時間控制 */}
            <div>
              <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '8px' }}>運動時間 (t)</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input type="range" min="0" max={Math.ceil(maxTime / timeStep) * timeStep} step={timeStep} value={time} className="slider-time"
                  onChange={(e) => setTime(parseFloat(e.target.value))} style={{ flex: 1 }} />
              </div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#00ff88', marginTop: '4px' }}>
                {time.toFixed(2)}s / {(Math.ceil(maxTime / timeStep) * timeStep).toFixed(2)}s
              </div>
            </div>
          </div>

          {/* 四個物體數據 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
            <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: '6px', padding: '12px', fontSize: '11px' }}>
              <div style={{ color: '#ff6464', fontWeight: 'bold', marginBottom: '6px' }}>實心球 (Solid Sphere)</div>
              <div>I = 0.4 m·r² = {I_solid.toFixed(4)}</div>
              <div>y({time.toFixed(2)}) = {y_solid.toFixed(4)} m</div>
              <div>k({time.toFixed(2)}) = {(k_solid * 180 / Math.PI).toFixed(2)}°</div>
              {solidArrived && <div style={{ color: '#ffff00', marginTop: '4px' }}>✓ 到達 @ {maxTime_solid.toFixed(3)}s（第{[maxTime_solid,maxTime_hollowSphere,maxTime_cylinder,maxTime_hollowCylinder].sort((a,b)=>a-b).indexOf(maxTime_solid)+1}名）</div>}
            </div>

            <div style={{ background: 'rgba(255,68,68,0.15)', border: '1px solid rgba(255,68,68,0.4)', borderRadius: '6px', padding: '12px', fontSize: '11px' }}>
              <div style={{ color: '#ff8888', fontWeight: 'bold', marginBottom: '6px' }}>空心球 (Hollow Sphere) - x={hollowSpherThickness.toFixed(2)}</div>
              <div>I = {I_hollowSphere.toFixed(4)}</div>
              <div>y({time.toFixed(2)}) = {y_hollow.toFixed(4)} m</div>
              <div>k({time.toFixed(2)}) = {(k_hollow * 180 / Math.PI).toFixed(2)}°</div>
              {hollowArrived && <div style={{ color: '#ffff00', marginTop: '4px' }}>✓ 到達 @ {maxTime_hollowSphere.toFixed(3)}s（第{[maxTime_solid,maxTime_hollowSphere,maxTime_cylinder,maxTime_hollowCylinder].sort((a,b)=>a-b).indexOf(maxTime_hollowSphere)+1}名）</div>}
            </div>

            <div style={{ background: 'rgba(68,68,255,0.1)', border: '1px solid rgba(68,68,255,0.3)', borderRadius: '6px', padding: '12px', fontSize: '11px' }}>
              <div style={{ color: '#4444ff', fontWeight: 'bold', marginBottom: '6px' }}>實心圓柱 (Solid Cylinder)</div>
              <div>I = 0.5 m·r² = {I_cylinder.toFixed(4)}</div>
              <div>y({time.toFixed(2)}) = {y_cylinder.toFixed(4)} m</div>
              <div>k({time.toFixed(2)}) = {(k_cylinder * 180 / Math.PI).toFixed(2)}°</div>
              {cylinderArrived && <div style={{ color: '#ffff00', marginTop: '4px' }}>✓ 到達 @ {maxTime_cylinder.toFixed(3)}s（第{[maxTime_solid,maxTime_hollowSphere,maxTime_cylinder,maxTime_hollowCylinder].sort((a,b)=>a-b).indexOf(maxTime_cylinder)+1}名）</div>}
            </div>

            <div style={{ background: 'rgba(68,68,255,0.15)', border: '1px solid rgba(68,68,255,0.4)', borderRadius: '6px', padding: '12px', fontSize: '11px' }}>
              <div style={{ color: '#8888ff', fontWeight: 'bold', marginBottom: '6px' }}>空心圓柱 (Hollow Cylinder) - x={hollowCylinderThickness.toFixed(2)}</div>
              <div>I = {I_hollowCylinder.toFixed(4)}</div>
              <div>y({time.toFixed(2)}) = {y_hollow_cyl.toFixed(4)} m</div>
              <div>k({time.toFixed(2)}) = {(k_hollow_cyl * 180 / Math.PI).toFixed(2)}°</div>
              {hollowCylArrived && <div style={{ color: '#ffff00', marginTop: '4px' }}>✓ 到達 @ {maxTime_hollowCylinder.toFixed(3)}s（第{[maxTime_solid,maxTime_hollowSphere,maxTime_cylinder,maxTime_hollowCylinder].sort((a,b)=>a-b).indexOf(maxTime_hollowCylinder)+1}名）</div>}
            </div>
          </div>

          <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid rgba(0,255,136,0.1)', fontSize: '10px', color: '#666', textAlign: 'center' }}>
            🔴 紅色=實心球 | 🔴 淺紅=空心球 | 🔵 藍色=實心圓柱 | 🔵 淺藍=空心圓柱 | maxTime = {maxTime.toFixed(2)}s (最慢物體)
          </div>

          <div style={{
            marginTop: '20px', paddingTop: '20px',
            borderTop: '1px solid rgba(0,255,136,0.15)',
            background: 'rgba(0,255,136,0.05)', borderRadius: '6px', padding: '16px',
            fontSize: '11px', fontFamily: "'Courier New', monospace", lineHeight: '1.8'
          }}>
            <h4 style={{ color: '#00ff88', marginTop: 0, marginBottom: '12px' }}>基本公式（屏幕x、y、z坐標系）:</h4>
            
            <div style={{ color: '#ddd', marginBottom: '10px' }}>
              <strong style={{ color: '#ffff88' }}>基本參數：</strong><br/>
              r = {r} m | m = {m} kg | g = {g} m/s² | θ = {slopeAngle}°<br/>
              I(實心球) = 0.4 m·r² = {I_solid.toFixed(4)} kg·m²<br/>
              I(實心圓柱) = 0.5 m·r² = {I_cylinder.toFixed(4)} kg·m²
            </div>

            <div style={{ color: '#ddd', marginBottom: '10px' }}>
              <strong style={{ color: '#ffff88' }}>公式1：y(t) 沿斜面下降的距離</strong><br/>
              y(t) = [m·r²·g/(m·r²+I)] × (sin²θ·t²)/2<br/>
            </div>

            <div style={{ color: '#ddd', marginBottom: '10px' }}>
              <strong style={{ color: '#ffff88' }}>公式2：k(t) 旋轉角度</strong><br/>
              k_degrees = (y(t) / sinθ) × 180 / (r × π)<br/>
              k_rad = k_degrees × π / 180<br/>
            </div>

            <div style={{ color: '#ddd', marginBottom: '10px' }}>
              <strong style={{ color: '#ffff88' }}>公式3：球心位置 (x_c, y_c, z_c)</strong><br/>
              x_c = y(t) / tan(θ)<br/>
              y_c = r - y(t)<br/>
              z_c = zOffset (各物體的z偏移)
            </div>

            <div style={{ color: '#ddd' }}>
              <strong style={{ color: '#ffff88' }}>公式4：質點位置</strong><br/>
              x_p = y(t)/tan(θ) - 2·r·sin(k/2)·cos(k/2)<br/>
              y_p = 2·r·sin²(k/2) - y(t)<br/>
              z_p = zOffset (各物體的z偏移)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
