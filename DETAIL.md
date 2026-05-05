# DETAIL.md — 數學推導詳解 / Mathematical Derivations

> 語言 / Language: **繁體中文** | [English ↓](#en)

<a id="zh"></a>

本文件記錄滾動模擬的完整數學推導，包含：
1. 能量守恆推導終端速度
2. ODE 求解下落函數 y(t) 與落地時間 T
3. 各物體轉動慣量的積分推導
4. 速度排名分析

---

## 1. 問題設定

> 誰滾得比較快？

考慮一個質量為 $M$、半徑為 $R$ 的物體，從斜面頂端靜止釋放，斜面傾角 $\theta$、垂直高度 $H$。  
假設物體**純滾動（no-slip）**，即接觸點速度為零。

### 座標與符號

- $g = 9.8$ m/s²，$m = 1$ kg，$r = 1$ m（模擬中固定値）
- $\theta$：斜面傾角
- $I$：物體對旋轉軸的轉動慣量
- $v$：物體質心線速度
- $\omega$：角速度
- $k(t)$：累積旋轉角（弧度）
- $s(t)$：沿斜面的位移
- $y(t)$：垂直方向的位移

---

## 2. Case 1：無摩擦力

無摩擦時物體不旋轉，只有平移動能：

$$mgh = \frac{1}{2}mv^2 \implies v = \sqrt{2gh}$$

加速度：

$$F = ma = mg \implies a = g$$

**結論：無摩擦時所有物體一樣快**，與形狀和質量分布無關。

---

## 3. Case 2：有摩擦力（純滾動）

### 3.1 能量方程式

總機械能守恆（靜摩擦不做功）：

$$mgh = \frac{1}{2}mv^2 + \frac{1}{2}I\omega^2$$

（$mgh$：重力位能；$\frac{1}{2}mv^2$：平移動能；$\frac{1}{2}I\omega^2$：轉動動能）

### 3.2 純滾動不滑動條件

弧長公式 $s = r\varphi$（$\varphi$ 為旋轉角），對時間微分：

$$v = \frac{ds}{dt} = r\frac{d\varphi}{dt} = r\omega \implies \omega = \frac{v}{r}$$

### 3.3 轉動動能的等效推導

將物體視為由質點 $m_i$ 組成，每個質點距旋轉軸距離 $r_i$，角速度 $\omega$ 相同：

$$E_{\text{rot}} = \sum_i \frac{1}{2}m_i v_i^2 = \sum_i \frac{1}{2}m_i r_i^2 \omega^2 = \frac{1}{2}\omega^2 \underbrace{\sum_i m_i r_i^2}_{I}$$

因此 $I = \sum_i m_i r_i^2$（連續體則為 $I = \int r^2\,dm$）

### 3.4 合力矩與牛頓第二定律

對每個質點：$F_i = m_i a_i \implies r_i F_i = m_i r_i^2 \alpha$，  
對整體求和：

$$\tau = \sum_i r_i F_i = \left(\sum_i m_i r_i^2\right)\alpha = I\alpha$$

### 3.5 求終端速度 $V$

代入 $\omega = v/r$：

$$mgh = \frac{1}{2}mv^2 + \frac{1}{2}I\frac{v^2}{r^2} = \frac{1}{2}mv^2\left(1 + \frac{I}{mr^2}\right)$$

$$\boxed{V = \sqrt{\frac{2gH}{1 + \frac{I}{mr^2}}}}$$

**結論：$I/(mr^2)$ 越大，終端速度越小。**

---

## 4. 下落函數 y(t) 的推導

### 4.1 建立 ODE

令 $y(t)$ 為物體的垂直位移（$y(0)=0$，$y(T)=H$）。  
將當前高度 $h = y(t)$ 代入能量守恆式，得瞬時速度：

$$v(t) = \sqrt{\frac{2g \cdot y(t)}{1 + \frac{I}{mr^2}}}$$

垂直分量：

$$\frac{dy}{dt} = v(t)\sin\theta = \sqrt{\frac{2g}{1+\frac{I}{mr^2}}} \cdot \sin\theta \cdot \sqrt{y(t)}$$

令常數 $c = \frac{mr^2 g}{mr^2+I}$，則：

$$\frac{dy}{dt} = \sqrt{2c} \cdot \sin\theta \cdot \sqrt{y(t)}$$

### 4.2 分離變數求解

$$\frac{dy}{\sqrt{y}} = \sqrt{2c}\,\sin\theta\,dt$$

兩邊積分：

$$\int y^{-1/2}\,dy = \int \sqrt{2c}\,\sin\theta\,dt$$

$$2\sqrt{y(t)} + C_1 = \sqrt{2c}\,\sin\theta \cdot t + C_2$$

代入初始條件 $y(0)=0$，得 $C_1 = C_2$，因此：

$$2\sqrt{y(t)} = \sqrt{2c}\,\sin\theta \cdot t$$

$$\sqrt{y(t)} = \frac{\sqrt{2c}\,\sin\theta}{2}\,t$$

$$\boxed{y(t) = \frac{c\sin^2\theta}{2}\,t^2}$$

此即**匀加速運動**（垂直方向有效加速度 $a_y = c\sin^2\theta$）。

### 4.3 求落地時間 T

代入 $y(T) = H$：

$$H = \frac{c\sin^2\theta}{2}\,T^2 \implies T = \sqrt{\frac{2H}{c\sin^2\theta}}$$

展開 $c$：

$$\boxed{T = \sqrt{\frac{2H}{g\sin^2\theta}} \cdot \sqrt{1 + \frac{I}{mr^2}}}$$

**結論：$I/(mr^2)$ 越大，落地時間越長（越慢）。**

---

## 5. 各物體轉動慣量積分推導

以下推導使用柱坐標系，材質密度為 $\rho$，物體半徑 $R$，質量 $M$。  
代號：$x = r_{\text{inner}}/R$（中空比，$0 \le x \lt 1$；實心體 $x=0$）

### 5.1 實心球 $I = \frac{2}{5}MR^2$

$$I = \int r^2\,dm = \iiint r^2 \rho\,dV$$

以 $z$ 為軸向座標（$-R \le z \le R$），在高度 $z$ 處的柱截面半徑為 $\sqrt{R^2-z^2}$，用薄圓環積分：

$$I = \int_{-R}^{R}\int_0^{\sqrt{R^2-z^2}} 2\pi\rho \cdot r^3\,dr\,dz$$

$$= \int_{-R}^{R} 2\pi\rho \cdot \frac{(R^2-z^2)^2}{4}\,dz = \frac{\pi\rho}{2}\int_{-R}^{R}(R^4 - 2R^2z^2 + z^4)\,dz$$

$$= \frac{\pi\rho}{2}\left[R^4 \cdot 2R - \frac{2R^2 \cdot 2R^3}{3} + \frac{2R^5}{5}\right] = \frac{\pi\rho}{2}\cdot 2R^5\left(1 - \frac{2}{3} + \frac{1}{5}\right)$$

$$= \pi\rho R^5 \cdot \frac{8}{15} = \frac{8}{15}\pi\rho R^5$$

其中 $M = \frac{4}{3}\pi R^3 \rho$，故：

$$\boxed{I = \frac{2}{5}MR^2}$$

### 5.2 空心球 $I = \frac{2}{5}MR^2 \cdot \frac{1-x^5}{1-x^3}$

空心球 = 半徑 $R$ 的實心球 $-$ 半徑 $Rx$ 的實心球：

$$I = \frac{8}{15}\pi\rho R^5 - \frac{8}{15}\pi\rho(Rx)^5 = \frac{8}{15}\pi\rho R^5(1-x^5)$$

$$M = \frac{4}{3}\pi R^3\rho(1-x^3)$$

$$\boxed{I = \frac{2}{5}MR^2 \cdot \frac{1-x^5}{1-x^3}}$$

### 5.3 實心圓柱 $I = \frac{1}{2}MR^2$

柱坐標，柱高 $l$：

$$I = \int_0^l \int_0^R 2\pi\rho r^3\,dr\,dz = l \cdot 2\pi\rho \cdot \frac{R^4}{4} = \frac{\pi}{2}l\rho R^4$$

$$M = \pi R^2 l \rho$$

$$\boxed{I = \frac{1}{2}MR^2}$$

### 5.4 空心圓柱 $I = \frac{1}{2}MR^2 \cdot \frac{1-x^4}{1-x^2}$

空心柱 = 外半徑 $R$ 的實心柱 $-$ 內半徑 $Rx$ 的實心柱：

$$I = \frac{\pi}{2}l\rho R^4 - \frac{\pi}{2}l\rho(Rx)^4 = \frac{\pi}{2}l\rho R^4(1-x^4)$$

$$M = \pi R^2 l\rho(1-x^2)$$

$$\boxed{I = \frac{1}{2}MR^2 \cdot \frac{1-x^4}{1-x^2}}$$

---

## 6. $I/mr^2$ 比值總結

| 物體 | $I/(mr^2)$ | 說明 |
|------|-----------|------|
| 實心球 | $2/5 = 0.4$ | 最小 → 最快 |
| 實心圓柱 | $1/2 = 0.5$ | |
| 空心球 ($x$) | $\frac{2}{5}\cdot\frac{1-x^5}{1-x^3}$ | 隨 $x$ 增大而增大 |
| 空心圓柱 ($x$) | $\frac{1}{2}\cdot\frac{1-x^4}{1-x^2}$ | 隨 $x$ 增大而增大 |

當 $x = 0$（無空心）：
- 空心球 = 實心球（$0.4$）
- 空心柱 = 實心柱（$0.5$）

當 $x \to 1$（殼極薄）：
- 空心球 → $2/3 \approx 0.667$
- 空心柱 → $1$

### 速度排名（下坡，相同中空比 $x$）

- $x \lt 0.68$：實心球 $>$ 空心球 $>$ 實心柱 $>$ 空心柱
- $x \gt 0.68$：實心球 $>$ 實心柱 $>$ 空心球 $>$ 空心柱

（交叉點：令 $\frac{2}{5}\cdot\frac{1-x^5}{1-x^3} = \frac{1}{2}$，解得 $x \approx 0.68$）

---

## 7. 爬坡模式

### 7.1 初速 $V$ 爬坡

給定初速 $V$（向上），合力為沿斜面向下的有效力，動力學方程式與下坡相同（方向相反）：

$$Y(t) = V\sin\theta \cdot t - \frac{c\sin^2\theta}{2}t^2$$

其中 $c = \frac{mr^2 g}{mr^2+I}$ 同前。

### 7.2 停止時間

$$\frac{dY}{dt} = V\sin\theta - c\sin^2\theta \cdot t = 0 \implies t_{\text{stop}} = \frac{V\sin\theta}{c\sin^2\theta} = \frac{V(mr^2+I)}{mr^2 g\sin\theta}$$

### 7.3 最高點高度

$$H_{\text{peak}} = Y(t_{\text{stop}}) = \frac{V^2\sin^2\theta}{2c\sin^2\theta} = \frac{V^2}{2c} = \frac{V^2(mr^2+I)}{2mr^2 g}$$

**結論：在相同質心初速 $V$ 下，$I/(mr^2)$ 越大，爬得越高。**  
因為物體初始動能為 $\dfrac{1}{2}mv^2\!\left(1+\dfrac{I}{mr^2}\right)$，$I$ 越大則儲存的總動能越多，可轉換為更多重力位能。  
**爬坡排名與下坡相反：空心柱爬得最高，實心球最低。**

---

## 8. 接觸點軌跡（擺線 Cycloid）

### 8.1 定義

物體在斜面上純滾動時，物體表面某固定點（初始時刻與斜面接觸的那個點）在空間中的運動軌跡稱為**擺線**（cycloid）。

### 8.2 球心座標

下坡情形（以斜面底端為原點）：

$$x_c = s\cos\theta + r\sin\theta, \quad y_c = -s\sin\theta + r\cos\theta$$

其中 $s = y(t)/\sin\theta$ 為沿斜面位移，法線方向為 $(\sin\theta, \cos\theta)$。

爬坡情形：

$$x_c = s\cos\theta - r\sin\theta, \quad y_c = s\sin\theta + r\cos\theta$$

法線方向為 $(-\sin\theta, \cos\theta)$。

### 8.3 接觸點座標

旋轉角 $k(t) = y(t)/(r\sin\theta)$（純滾動條件）。  
以球心為中心，接觸點在旋轉 $k$ 角後的位置：

下坡：

$$x_p = x_c - r\sin(\theta + k)$$
$$y_p = y_c - r\cos(\theta + k)$$

爬坡：

$$x_p = x_c + r\sin(\theta - k)$$
$$y_p = y_c - r\cos(\theta - k)$$

性質：$\lvert P - C \rvert = r$ 恆成立；$k = 2n\pi$ 時接觸點恰好落回斜面。

---

## 9. 數值計算說明

模擬中使用 `calcMaxTimeDown` 以**二分搜尋**求解 $y(T) = H$，原因是 $T$ 的解析式
$$T = \sqrt{\frac{2H}{c\sin^2\theta}}$$
雖然存在，但 $c$ 含有 $I$ 的複雜表達式，直接計算即可；二分搜尋作為通用後備，精度達 20 次迭代（誤差 $\lt 10^{-6}$ s）。

---

<a id="en"></a>

> 語言 / Language: [繁體中文 ↑](#zh) | **English**

# DETAIL — Mathematical Derivations

This document presents the complete mathematical derivations for the rolling simulation, covering:
1. Terminal velocity via energy conservation
2. ODE solution for vertical displacement $y(t)$ and fall time $T$
3. Moment of inertia integrals for each shape
4. Speed ranking analysis

---

## 1. Problem Setup

> Which object rolls faster?

Consider an object of mass $M$ and radius $R$, released from rest at the top of an inclined plane with inclination angle $\theta$ and vertical height $H$.  
Assume **pure rolling (no-slip)**: the velocity at the contact point is zero.

### Coordinates and Symbols

- $g = 9.8$ m/s², $m = 1$ kg, $r = 1$ m (fixed values in simulation)
- $\theta$: inclination angle
- $I$: moment of inertia about the rotation axis
- $v$: translational velocity of center of mass
- $\omega$: angular velocity
- $k(t)$: cumulative rotation angle (radians)
- $s(t)$: displacement along the slope
- $y(t)$: vertical displacement

---

## 2. Case 1: No Friction

Without friction the object does not rotate; only translational kinetic energy:

$$mgh = \frac{1}{2}mv^2 \implies v = \sqrt{2gh}$$

Acceleration:

$$F = ma = mg \implies a = g$$

**Conclusion: Without friction all objects move at the same speed**, regardless of shape or mass distribution.

---

## 3. Case 2: With Friction (Pure Rolling)

### 3.1 Energy Equation

Conservation of mechanical energy (static friction does no work):

$$\underbrace{mgh}_{\text{gravitational PE}} = \underbrace{\frac{1}{2}mv^2}_{\text{translational KE}} + \underbrace{\frac{1}{2}I\omega^2}_{\text{rotational KE}}$$

### 3.2 No-Slip Condition

Arc length $s = r\phi$, differentiated with respect to time:

$$v = \frac{ds}{dt} = r\frac{d\phi}{dt} = r\omega \implies \omega = \frac{v}{r}$$

### 3.3 Equivalent Derivation of Rotational KE

Treating the body as point masses $m_i$ at distances $r_i$ from the rotation axis, all sharing angular velocity $\omega$:

$$E_{\text{rot}} = \sum_i \frac{1}{2}m_i v_i^2 = \sum_i \frac{1}{2}m_i r_i^2 \omega^2 = \frac{1}{2}\omega^2 \underbrace{\sum_i m_i r_i^2}_{I}$$

Therefore $I = \sum_i m_i r_i^2$ (for a continuous body: $I = \int r^2\,dm$).

### 3.4 Net Torque and Newton's Second Law

For each element: $F_i = m_i a_i \implies r_i F_i = m_i r_i^2 \alpha$; summing over all elements:

$$\tau = \sum_i r_i F_i = \left(\sum_i m_i r_i^2\right)\alpha = I\alpha$$

### 3.5 Terminal Velocity $V$

Substituting $\omega = v/r$:

$$mgh = \frac{1}{2}mv^2 + \frac{1}{2}I\frac{v^2}{r^2} = \frac{1}{2}mv^2\left(1 + \frac{I}{mr^2}\right)$$

$$\boxed{V = \sqrt{\frac{2gH}{1 + \frac{I}{mr^2}}}}$$

**Conclusion: Larger $I/(mr^2)$ → smaller terminal velocity.**

---

## 4. Vertical Displacement y(t)

### 4.1 Setting Up the ODE

Let $y(t)$ be vertical displacement ($y(0)=0$, $y(T)=H$).  
At any instant the speed equals the terminal-velocity formula evaluated at height $y(t)$:

$$v(t) = \sqrt{\frac{2g \cdot y(t)}{1 + \frac{I}{mr^2}}}$$

Vertical component:

$$\frac{dy}{dt} = v(t)\sin\theta = \sqrt{\frac{2g}{1+\frac{I}{mr^2}}} \cdot \sin\theta \cdot \sqrt{y(t)}$$

Define constant $c = \frac{mr^2 g}{mr^2+I}$, then:

$$\frac{dy}{dt} = \sqrt{2c} \cdot \sin\theta \cdot \sqrt{y(t)}$$

### 4.2 Separation of Variables

$$\frac{dy}{\sqrt{y}} = \sqrt{2c}\,\sin\theta\,dt$$

Integrating both sides:

$$2\sqrt{y(t)} = \sqrt{2c}\,\sin\theta \cdot t \qquad (y(0)=0 \text{ sets the constant to zero})$$

$$\boxed{y(t) = \frac{c\sin^2\theta}{2}\,t^2}$$

This is **uniformly accelerated motion** with vertical effective acceleration $a_y = c\sin^2\theta$.

### 4.3 Fall Time T

Setting $y(T) = H$:

$$\boxed{T = \sqrt{\frac{2H}{g\sin^2\theta}} \cdot \sqrt{1 + \frac{I}{mr^2}}}$$

**Conclusion: Larger $I/(mr^2)$ → longer fall time (slower).**

---

## 5. Moment of Inertia — Integral Derivations

Notation: $x = r_{\text{inner}}/R$ (hollow ratio, $0 \le x \lt 1$; solid body: $x=0$).

### 5.1 Solid Sphere $I = \frac{2}{5}MR^2$

Integrate using cylindrical slices, with $z$ as the axial coordinate ($-R \le z \le R$) and $r$ the radial distance from the axis ($0 \le r \le \sqrt{R^2-z^2}$):

$$I = \int_{-R}^{R}\int_0^{\sqrt{R^2-z^2}} 2\pi\rho_m \cdot r^3\,dr\,dz$$

$$= \int_{-R}^{R} 2\pi\rho_m \cdot \frac{(R^2-z^2)^2}{4}\,dz = \frac{\pi\rho_m}{2}\int_{-R}^{R}(R^4 - 2R^2z^2 + z^4)\,dz$$

$$= \frac{\pi\rho_m}{2} \cdot 2R^5\left(1 - \frac{2}{3} + \frac{1}{5}\right) = \frac{8}{15}\pi\rho_m R^5$$

With $M = \frac{4}{3}\pi R^3 \rho_m$:

$$\boxed{I_{\text{solid sphere}} = \frac{2}{5}MR^2}$$

### 5.2 Hollow Sphere $I = \frac{2}{5}MR^2 \cdot \frac{1-x^5}{1-x^3}$

Hollow sphere = solid sphere of radius $R$ $-$ solid sphere of radius $Rx$:

$$I = \frac{8}{15}\pi\rho_m R^5(1-x^5), \quad M = \frac{4}{3}\pi R^3\rho_m(1-x^3)$$

$$\boxed{I_{\text{hollow sphere}} = \frac{2}{5}MR^2 \cdot \frac{1-x^5}{1-x^3}}$$

### 5.3 Solid Cylinder $I = \frac{1}{2}MR^2$

Cylindrical coordinates, height $l$:

$$I = \int_0^l \int_0^R 2\pi\rho_m r^3\,dr\,dz = \frac{\pi}{2}l\rho_m R^4, \quad M = \pi R^2 l \rho_m$$

$$\boxed{I_{\text{solid cylinder}} = \frac{1}{2}MR^2}$$

### 5.4 Hollow Cylinder $I = \frac{1}{2}MR^2 \cdot \frac{1-x^4}{1-x^2}$

Hollow cylinder = outer solid cylinder (radius $R$) $-$ inner solid cylinder (radius $Rx$):

$$I = \frac{\pi}{2}l\rho_m R^4(1-x^4), \quad M = \pi R^2 l\rho_m(1-x^2)$$

$$\boxed{I_{\text{hollow cylinder}} = \frac{1}{2}MR^2 \cdot \frac{1-x^4}{1-x^2}}$$

---

## 6. Summary of $I/mr^2$ Ratios

| Object | $I/(mr^2)$ | Notes |
|--------|-----------|-------|
| Solid sphere | $2/5 = 0.4$ | Smallest → fastest |
| Solid cylinder | $1/2 = 0.5$ | |
| Hollow sphere ($x$) | $\frac{2}{5}\cdot\frac{1-x^5}{1-x^3}$ | Increases with $x$ |
| Hollow cylinder ($x$) | $\frac{1}{2}\cdot\frac{1-x^4}{1-x^2}$ | Increases with $x$ |

At $x = 0$ (fully solid): hollow sphere = solid sphere ($0.4$); hollow cylinder = solid cylinder ($0.5$).  
As $x \to 1$ (thin shell): hollow sphere → $2/3 \approx 0.667$; hollow cylinder → $1$.

### Speed Ranking (downhill, same hollow ratio $x$)

- $x \lt 0.68$: solid sphere $>$ hollow sphere $>$ solid cylinder $>$ hollow cylinder
- $x \gt 0.68$: solid sphere $>$ solid cylinder $>$ hollow sphere $>$ hollow cylinder

(Crossover: solving $\frac{2}{5}\cdot\frac{1-x^5}{1-x^3} = \frac{1}{2}$ gives $x \approx 0.68$)

---

## 7. Uphill Mode

### 7.1 Uphill with Initial Velocity $V$

Given initial translational velocity $V$ directed up the slope, the deceleration mirrors the downhill formula:

$$Y(t) = V\sin\theta \cdot t - \frac{c\sin^2\theta}{2}t^2$$

where $c = \frac{mr^2 g}{mr^2+I}$ as before.

### 7.2 Time to Stop

$$t_{\text{stop}} = \frac{V\sin\theta}{c\sin^2\theta} = \frac{V(mr^2+I)}{mr^2 g\sin\theta}$$

### 7.3 Peak Height

$$H_{\text{peak}} = \frac{V^2}{2c} = \frac{V^2}{2g}\left(1+\frac{I}{mr^2}\right)$$

For the same initial translational velocity $V$: larger $I/mr^2$ → **higher** peak, because total initial KE $= \frac{1}{2}mv^2(1+I/mr^2)$ is larger.  
**Uphill speed ranking is the reverse of downhill** (hollow cylinder reaches highest, solid sphere lowest).

---

## 8. Contact Point Trajectory (Cycloid)

As the body rolls without slipping, a point fixed on the body's surface (initially the contact point with the slope) traces a **cycloid** in space.

### 8.1 Center-of-Mass Position

Downhill (origin at slope bottom):

$$x_c = s\cos\theta + r\sin\theta, \quad y_c = -s\sin\theta + r\cos\theta$$

where $s = y(t)/\sin\theta$; the slope normal direction is $(\sin\theta, \cos\theta)$.

Uphill:

$$x_c = s\cos\theta - r\sin\theta, \quad y_c = s\sin\theta + r\cos\theta$$

### 8.2 Contact Point Coordinates

Rotation angle $k(t) = y(t)/(r\sin\theta)$ (pure-rolling condition).  
Position of contact point after rotation $k$ about the center:

Downhill:

$$x_p = x_c - r\sin(\theta + k)$$
$$y_p = y_c - r\cos(\theta + k)$$

Uphill:

$$x_p = x_c + r\sin(\theta - k)$$
$$y_p = y_c - r\cos(\theta - k)$$

Property: $\lvert P - C \rvert = r$ always; at $k = 2n\pi$ the contact point returns to the slope surface.

---

## 9. Numerical Notes

`calcMaxTimeDown` uses **binary search** to solve $y(T) = H$. The closed-form
$$T = \sqrt{\frac{2H}{c\sin^2\theta}}$$
is also valid; binary search serves as a general-purpose fallback with 20-iteration precision (error $\lt 10^{-6}$ s).
