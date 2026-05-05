# Rolling Simulation / 滾動模擬

> 語言 / Language: **繁體中文** | [English ↓](#en)

<a id="zh"></a>

互動式 3D 滾動模擬，比較四種不同物體（實心球、空心球、實心圓柱、空心圓柱）沿斜面滾動的速度與落地時間。  
支援**下坡**與**爬坡**兩種模式，可自訂斜面角度、高度/初速、空心比例。

## 線上展示

> 直接以 HTTP 伺服器（或 GitHub Pages）開啟 `index.html` 即可執行。  
> 若以 `file://` 協定開啟，Babel 外部腳本可能因瀏覽器安全限制而無法載入，建議使用本地 HTTP 伺服器：
> ```bash
> npx serve .
> # 或
> python -m http.server 8080
> ```

## 功能

- 4 種物體同時滾動，軌跡以擺線（cycloid）即時描繪
- 自動鏡頭跟隨，標籤碰撞迴避
- 到達終點時顯示排名徽章
- 播放速度可調（×0.25 ～ ×8，支援倒播）
- 鍵盤快捷鍵：`Space` 播放/暫停，`←` / `→` 調整速度

## 檔案架構

```
rolling-simulation/
├── index.html              HTML shell：載入 CDN 依賴與所有模組
├── css/
│   └── style.css           全域 CSS 樣式
├── js/
│   ├── physics.js          純物理計算（無 DOM/React 依賴）
│   ├── scene3d.js          Three.js 場景管理（建立物件、斜面、相機）
│   ├── trail.js            擺線軌跡渲染系統（分塊 TubeGeometry）
│   ├── markers.js          3D 標籤精靈（名稱 + 排名徽章）
│   ├── components.jsx      React UI 子元件（SectionHeader）
│   ├── simulation.jsx      主 React 元件（狀態管理 + 場景串接）
│   └── app.jsx             React 進入點（ReactDOM.createRoot）
├── README.md               本文件
└── DETAIL.md               數學推導（積分、ODE、轉動慣量）
```

## 模組說明

### `js/physics.js` → `window.Physics`

純數學函式，無任何 DOM 或框架依賴。

| 函式 | 說明 |
|------|------|
| `calcInertia(type, x)` | 計算轉動慣量 I |
| `calcYDown(t, I, θ)` | 下坡垂直位移 y(t) |
| `calcYUp(t, I, θ, V)` | 爬坡淨垂直位移 Y(t) |
| `calcStopTime(I, θ, V)` | 爬坡停止時間 t_stop |
| `calcK(t, I, θ, isUphill, V)` | 旋轉角 k(t)（弧度） |
| `calcMaxTimeDown(I, θ, H)` | 二分搜尋：y(T) = H 的時間 T |
| `getPos(...)` | 物體球心世界座標 |
| `getPtPos(...)` | 接觸點座標（擺線軌跡） |

### `js/scene3d.js` → `window.Scene3D`

Three.js 場景生命週期管理。

| 函式 | 說明 |
|------|------|
| `createScene(mountEl)` | 建立 scene / camera / renderer |
| `createObjects(scene, hollowSph, hollowCyl)` | 建立四個滾動物體 mesh |
| `createSlope(scene)` | 建立可更新的斜面群組 |
| `updateSlope(state, θ, isUphill, peakH, H)` | 重建斜面幾何（依最高點自動調整長度） |
| `createAxes(scene)` | 加入 XYZ 座標軸輔助線 |
| `updateObjects(refs, t, phy)` | 每幀更新四個物體的位置與旋轉 |
| `updateCamera(camera, refs, zRef)` | 平滑跟隨相機，保持所有物體在畫面內 |

### `js/trail.js` → `window.TrailSystem`

增量式擺線軌跡渲染，採用分塊 TubeGeometry 避免每幀重建整條管線。

- 前進播放：追加新取樣點，每 48 點凍結為一個 chunk
- 倒播：以二分搜尋快速截斷可見部分，不重算已有點
- 方向切換：丟棄所有 mesh，重新從快取重建

### `js/markers.js` → `window.MarkerSystem`

- 四方向（上/下/左/右）泡泡標籤，動態選擇最少碰撞的方向
- 停止後顯示名次徽章（Canvas 繪製再轉為精靈貼圖）
- 懶重建：僅在方向或排名改變時重建材質

### `js/components.jsx`

`SectionHeader` — 可折疊面板的標題按鈕元件。

### `js/simulation.jsx`

主 React 元件 `MultiSphereSimulation`，負責：
1. 狀態管理（live / committed / draft 三層參數）
2. 呼叫 Scene3D 建立與更新三維場景
3. 呼叫 TrailSystem 更新軌跡
4. 控制面板 UI（時間軸、速度控制、參數、數據、公式）

### `js/app.jsx`

單行：`ReactDOM.createRoot(#root).render(<MultiSphereSimulation />)`

## 依賴（CDN，不需安裝）

| 套件 | 版本 | 用途 |
|------|------|------|
| React | 18.2.0 | UI 框架 |
| ReactDOM | 18.2.0 | DOM 掛載 |
| Three.js | r128 | 3D 渲染 |
| Babel Standalone | 7.23.2 | 瀏覽器端 JSX 轉譯 |

## 物理背景

詳細推導請見 [DETAIL.md](DETAIL.md)。

核心結論：
$$V = \sqrt{\frac{2gH}{1 + \dfrac{I}{mr^2}}}$$

$\dfrac{I}{mr^2}$ 越大 → 轉動慣量佔比越高 → 線速度越慢 → 下坡時間越長。

速度排名（下坡，中空比 $x < 0.68$）：**實心球 > 空心球 > 實心柱 > 空心柱**（$x > 0.68$ 時實心柱與空心球互換）

---

*物理推導、積分與微分方程解法詳見 DETAIL.md*

---

<a id="en"></a>

> 語言 / Language: [繁體中文 ↑](#zh) | **English**

# Rolling Simulation

Interactive 3D rolling simulation comparing four objects (solid sphere, hollow sphere, solid cylinder, hollow cylinder) rolling down an inclined plane.  
Supports **downhill** and **uphill** modes with configurable slope angle, height/speed, and hollow ratio.

## Live Demo

> Serve `index.html` via an HTTP server or GitHub Pages.  
> Opening with `file://` may block Babel external scripts — use a local HTTP server:
> ```bash
> npx serve .
> # or
> python -m http.server 8080
> ```

## Features

- 4 objects rolling simultaneously, trajectories drawn as cycloids in real time
- Auto-following camera with label collision avoidance
- Rank badges displayed on arrival
- Playback speed control (×0.25 – ×8, supports reverse)
- Keyboard shortcuts: `Space` play/pause, `←` / `→` adjust speed

## File Structure

```
rolling-simulation/
├── index.html              HTML shell: loads CDN dependencies and all modules
├── css/
│   └── style.css           Global CSS styles
├── js/
│   ├── physics.js          Pure physics calculations (no DOM/React dependency)
│   ├── scene3d.js          Three.js scene management (objects, slope, camera)
│   ├── trail.js            Cycloid trail rendering (chunked TubeGeometry)
│   ├── markers.js          3D label sprites (names + rank badges)
│   ├── components.jsx      React UI sub-components (SectionHeader)
│   ├── simulation.jsx      Main React component (state management + scene wiring)
│   └── app.jsx             React entry point (ReactDOM.createRoot)
├── README.md               This file
└── DETAIL.md               Mathematical derivations (integrals, ODE, moments of inertia)
```

## Module Reference

### `js/physics.js` → `window.Physics`

Pure math functions, no DOM or framework dependencies.

| Function | Description |
|----------|-------------|
| `calcInertia(type, x)` | Compute moment of inertia $I$ |
| `calcYDown(t, I, θ)` | Downhill vertical displacement $y(t)$ |
| `calcYUp(t, I, θ, V)` | Uphill net vertical displacement $Y(t)$ |
| `calcStopTime(I, θ, V)` | Uphill stop time $t_{\text{stop}}$ |
| `calcK(t, I, θ, isUphill, V)` | Rotation angle $k(t)$ (radians) |
| `calcMaxTimeDown(I, θ, H)` | Binary search: time $T$ such that $y(T) = H$ |
| `getPos(...)` | Object center world coordinates |
| `getPtPos(...)` | Contact point coordinates (cycloid trail) |

### `js/scene3d.js` → `window.Scene3D`

Three.js scene lifecycle management.

| Function | Description |
|----------|-------------|
| `createScene(mountEl)` | Create scene / camera / renderer |
| `createObjects(scene, hollowSph, hollowCyl)` | Build four rolling object meshes |
| `createSlope(scene)` | Create updatable slope group |
| `updateSlope(state, θ, isUphill, peakH, H)` | Rebuild slope geometry (auto-adjusts for peak height) |
| `createAxes(scene)` | Add XYZ axis helpers |
| `updateObjects(refs, t, phy)` | Update positions and rotations each frame |
| `updateCamera(camera, refs, zRef)` | Smooth-follow camera keeping all objects visible |

### `js/trail.js` → `window.TrailSystem`

Incremental cycloid trail rendering using chunked `TubeGeometry` to avoid rebuilding the full tube each frame.

- Forward playback: append new sample points, freeze every 48 points into a chunk
- Reverse playback: binary search to truncate visible portion without recomputing
- Direction change: discard all meshes, rebuild from cache

### `js/markers.js` → `window.MarkerSystem`

- Four-direction (up/down/left/right) bubble labels with dynamic collision-minimizing placement
- Rank badges rendered on `<canvas>` and converted to sprite textures after stop
- Lazy rebuild: materials recreated only when direction or rank changes

### `js/components.jsx`

`SectionHeader` — collapsible panel header button component.

### `js/simulation.jsx`

Main React component `MultiSphereSimulation`:
1. State management (live / committed / draft parameter tiers)
2. Calls Scene3D to create and update the 3D scene
3. Calls TrailSystem to update trails
4. Control panel UI (timeline, speed control, parameters, data, formulas)

### `js/app.jsx`

Single line: `ReactDOM.createRoot(#root).render(<MultiSphereSimulation />)`

## Dependencies (CDN — no install needed)

| Package | Version | Purpose |
|---------|---------|---------|
| React | 18.2.0 | UI framework |
| ReactDOM | 18.2.0 | DOM mounting |
| Three.js | r128 | 3D rendering |
| Babel Standalone | 7.23.2 | In-browser JSX transpilation |

## Physics Background

See [DETAIL.md](DETAIL.md) for full derivations.

Core result:
$$V = \sqrt{\frac{2gH}{1 + \dfrac{I}{mr^2}}}$$

Larger $\dfrac{I}{mr^2}$ → higher fraction of energy in rotation → lower translational speed → longer downhill time.

Speed ranking (downhill, hollow ratio $x < 0.68$): **solid sphere > hollow sphere > solid cylinder > hollow cylinder**  
(for $x > 0.68$ solid cylinder and hollow sphere swap positions)

---

*Full physics derivations, integrals, and ODE solutions: see DETAIL.md*
