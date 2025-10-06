'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// ✨ 더 잘 보이는 파티클 (픽셀 크기 고정 + 가산합성 + 깊이쓰기 끔)
function spawnParticles(scene: THREE.Scene, at: THREE.Vector3, color = 0xffdd66): void {
  const count = 100;

  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3 + 0] = at.x;
    positions[i3 + 1] = at.y + 0.6; // 시작 높이 살짝 위로
    positions[i3 + 2] = at.z;

    // 반구 방향 랜덤 속도
    velocities[i3 + 0] = (Math.random() - 0.5) * 2.2;
    velocities[i3 + 1] = Math.random() * 2.4 + 0.8;
    velocities[i3 + 2] = (Math.random() - 0.5) * 2.2;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color,
    size: 14,                 // ✅ 픽셀 크기 (크게)
    sizeAttenuation: false,   // ✅ 거리와 무관하게 픽셀 고정
    transparent: true,
    opacity: 1,
    depthWrite: false,        // ✅ 뒤에 묻히지 않게
    blending: THREE.AdditiveBlending, // ✅ 가산합성(빛나는 느낌)
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; // 화면 밖 판정 오차 방지
  scene.add(points);

  const start = performance.now();
  function tick() {
    const t = (performance.now() - start) / 1000; // 0~1+
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3 + 0] += velocities[i3 + 0] * 0.03;
      positions[i3 + 1] += velocities[i3 + 1] * 0.03 - 0.05; // 중력
      positions[i3 + 2] += velocities[i3 + 2] * 0.03;
    }
    pos.needsUpdate = true;

    // 0.9초 동안 서서히 사라지게
    const life = 0.9;
    const fade = Math.max(0, 1 - t / life);
    mat.opacity = fade;

    if (t < life) {
      requestAnimationFrame(tick);
    } else {
      scene.remove(points);
      geo.dispose();
      mat.dispose();
    }
  }
  requestAnimationFrame(tick);
}


type GameState = 'start' | 'playing' | 'levelComplete' | 'gameOver';
type KeysMap = Record<string, boolean>;

export default function ShoeHunt3D() {
  const [gameState, setGameState] = useState<GameState>('start');
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [foundShoes, setFoundShoes] = useState(0);
  const [totalShoes, setTotalShoes] = useState(1);
  const [timeLeft, setTimeLeft] = useState(30);

  const gameStateRef = useRef<GameState>('start');
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const shoesRef = useRef<THREE.Group[]>([]);
  const particlePosRef = useRef(new THREE.Vector3()); // 파티클 월드 좌표 임시 저장
  const playerRef = useRef({ x: 0, z: 3, rotationY: 0 });
  const keysRef = useRef<KeysMap>({});
  const animationIdRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // 전역 키(e.code)
  useEffect(() => {
    const movement = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight']);
    const onKeyDown = (e: KeyboardEvent) => {
      if (movement.has(e.code) || e.code === 'Space' || e.code === 'Enter') e.preventDefault();
      keysRef.current[e.code] = true;

      if ((gameStateRef.current === 'start' || gameStateRef.current === 'gameOver' || gameStateRef.current === 'levelComplete')
        && (e.code === 'Enter' || e.code === 'Space')) startGame();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (movement.has(e.code) || e.code === 'Space' || e.code === 'Enter') e.preventDefault();
      keysRef.current[e.code] = false;
    };
    const opts: AddEventListenerOptions = { capture: true };
    document.addEventListener('keydown', onKeyDown, opts);
    document.addEventListener('keyup', onKeyUp, opts);
    return () => {
      document.removeEventListener('keydown', onKeyDown, opts);
      document.removeEventListener('keyup', onKeyUp, opts);
    };
  }, []);

  // 타이머
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setTimeLeft(prev => (prev <= 1 ? (setGameState('gameOver'), 0) : prev - 1));
    }, 1000);
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [gameState]);

  const initThree = useCallback((shoesCount: number) => {
    const mount = mountRef.current;
    if (!mount) return;

    // ✅ 레벨 전환/재설정 전에 기존 포인터락 깔끔히 해제
    try {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    } catch { /* no-op */ }

    // 기존 정리
    if (rendererRef.current) {
      try {
        if (mount.contains(rendererRef.current.domElement)) {
          mount.removeChild(rendererRef.current.domElement);
        }
      } catch { /* no-op */ }
      rendererRef.current.dispose();
      rendererRef.current = null;
    }
    sceneRef.current = null; cameraRef.current = null;
    shoesRef.current = [];
    playerRef.current = { x: 0, z: 3, rotationY: 0 };

    // 씬/카메라
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 10, 50);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 1.6, 3);
    camera.lookAt(0, 1.6, -3);
    cameraRef.current = camera;

    // 렌더러 (컬러스페이스 설정 제거)
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2));
    const { clientWidth, clientHeight } = mount;
    renderer.setSize(clientWidth, clientHeight);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('tabindex', '0');
    (renderer.domElement as HTMLCanvasElement).focus({ preventScroll: true });
    rendererRef.current = renderer;

    // 조명
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(10, 20, 10); scene.add(dir);

    // 바닥/벽
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0x90ee90, roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.7 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(30, 5, 0.5), wallMat); back.position.set(0, 2.5, -15); scene.add(back);
    const front = new THREE.Mesh(new THREE.BoxGeometry(30, 5, 0.5), wallMat); front.position.set(0, 2.5, 15); scene.add(front);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 30), wallMat); left.position.set(-15, 2.5, 0); scene.add(left);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 30), wallMat); right.position.set(15, 2.5, 0); scene.add(right);

    // 디버그 큐브 (보이면 렌더 OK)
    const debugCube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xff55ff, roughness: 0.5, metalness: 0.1 })
    );
    debugCube.position.set(0, 1.6, -3);
    scene.add(debugCube);

    // 신발
    const shoes: THREE.Group[] = [];
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
    for (let i = 0; i < shoesCount; i++) {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: colors[i % colors.length] });
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.5), mat); sole.castShadow = true; g.add(sole);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.3), mat); upper.position.set(0, 0.125, -0.05); upper.castShadow = true; g.add(upper);
      g.position.set((Math.random() - 0.5) * 20, 0.1, (Math.random() - 0.5) * 20);
      g.rotation.y = Math.random() * Math.PI * 2;
      (g.userData as { isShoe: boolean; found: boolean; originalColor: number }) = {
        isShoe: true, found: false, originalColor: colors[i % colors.length],
      };
      scene.add(g); shoes.push(g);
    }
    shoesRef.current = shoes;

    // ---- 이벤트들 ----
    // 1) 신발 클릭
    const onWindowClick = (event: MouseEvent) => {
      if (gameStateRef.current !== 'playing') return;
      const cam = cameraRef.current, sc = sceneRef.current;
      if (!cam || !sc) return;

      const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );
      raycasterRef.current.setFromCamera(mouse, cam);
      const hits: THREE.Intersection<THREE.Object3D>[] =
        raycasterRef.current.intersectObjects(sc.children, true);

      for (const hit of hits) {
        let obj: THREE.Object3D = hit.object;
        while (obj.parent && obj.parent.type !== 'Scene') obj = obj.parent as THREE.Object3D;

        const ud = obj.userData as { isShoe?: boolean; found?: boolean };
        if (ud?.isShoe && !ud?.found) {
          ud.found = true;

          obj.children.forEach((child) => {
            if (child instanceof THREE.Mesh) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((mm) => {
                if (mm instanceof THREE.MeshStandardMaterial) {
                  mm.color.setHex(0x00ff00);
                  mm.emissive = new THREE.Color(0x00ff00);
                  mm.emissiveIntensity = 0.5;
                }
              });
            }
          });

          setFoundShoes((p) => p + 1);

          // 🔽🔽🔽 여기 아래에 3줄을 추가하세요 🔽🔽🔽
          obj.getWorldPosition(particlePosRef.current);
          if (sceneRef.current) {
            spawnParticles(sceneRef.current, particlePosRef.current, 0xffdd66);
          }
          
          break;
        }
      }
    };

    // 2) 마우스 회전 (포인터락 필요)
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === renderer.domElement) {
        playerRef.current.rotationY -= e.movementX * 0.002;
      }
    };

    // 3) 리사이즈
    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    // 4) 캔버스 클릭 → 안전한 포인터락 요청
    const onCanvasClick = () => {
      if (gameStateRef.current !== 'playing') return;
      if (document.pointerLockElement !== renderer.domElement) {
        try {
          renderer.domElement.requestPointerLock();
        } catch {
          // 일부 환경에서 SecurityError가 날 수 있으므로 무시
        }
      }
    };

    // 5) 포인터락 이벤트(디버깅/안정성)
    const onPointerLockChange = () => {
      // 필요하면 상태 반영/로그 추가 가능
      // console.log('pointer lock:', document.pointerLockElement === renderer.domElement);
    };
    const onPointerLockError = () => {
      // console.warn('pointer lock error');
    };

    window.addEventListener('click', onWindowClick);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onResize);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('pointerlockerror', onPointerLockError);
    renderer.domElement.addEventListener('click', onCanvasClick);

    // 루프
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      if (gameStateRef.current === 'playing') {
        const speed = 0.1; const rot = playerRef.current.rotationY;
        if (keysRef.current['KeyW'] || keysRef.current['ArrowUp'])  { playerRef.current.x -= Math.sin(rot) * speed; playerRef.current.z -= Math.cos(rot) * speed; }
        if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']){ playerRef.current.x += Math.sin(rot) * speed; playerRef.current.z += Math.cos(rot) * speed; }
        if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']){ playerRef.current.x -= Math.cos(rot) * speed; playerRef.current.z += Math.sin(rot) * speed; }
        if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']){ playerRef.current.x += Math.cos(rot) * speed; playerRef.current.z -= Math.sin(rot) * speed; }
        playerRef.current.x = Math.max(-14, Math.min(14, playerRef.current.x));
        playerRef.current.z = Math.max(-14, Math.min(14, playerRef.current.z));
      }

      const cam = cameraRef.current!;
      cam.position.x = playerRef.current.x;
      cam.position.z = playerRef.current.z;
      cam.rotation.y = playerRef.current.rotationY;

      renderer.render(scene, camera);
    };
    renderer.render(scene, camera);
    animate();

    // cleanup
    return () => {
      window.removeEventListener('click', onWindowClick);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('pointerlockerror', onPointerLockError);
      renderer.domElement.removeEventListener('click', onCanvasClick);

      if (animationIdRef.current) { cancelAnimationFrame(animationIdRef.current); animationIdRef.current = null; }

      // ✅ 이 캔버스가 잠금 중이면 먼저 해제
      try {
        if (document.pointerLockElement === renderer.domElement) {
          document.exitPointerLock();
        }
      } catch { /* no-op */ }

      try {
        if (renderer.domElement && mount.contains(renderer.domElement)) {
          mount.removeChild(renderer.domElement);
        }
      } catch { /* no-op */ }
      renderer.dispose();
    };
  }, []);

  const startGame = useCallback(() => {
    const shoesCount = level;
    setTotalShoes(shoesCount);
    setFoundShoes(0);
    setTimeLeft(Math.max(20, 40 - level * 3));
    setGameState('playing');
    setTimeout(() => initThree(shoesCount), 50);
  }, [initThree, level]);

  // 레벨 완료 → 다음 레벨 진입
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (foundShoes >= totalShoes && totalShoes > 0) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setScore((p) => p + level * 100 + timeLeft * 10);
      setGameState('levelComplete');

      const to = setTimeout(() => {
        const next = level + 1;
        setLevel(next);
        const nShoes = next;
        setTotalShoes(nShoes);
        setFoundShoes(0);
        setTimeLeft(Math.max(20, 40 - next * 3));
        setGameState('playing');
        setTimeout(() => initThree(nShoes), 50);
      }, 1500);

      return () => clearTimeout(to);
    }
  }, [foundShoes, totalShoes, gameState, level, timeLeft, initThree]);

  const resetGame = useCallback(() => {
    setLevel(1); setScore(0); setGameState('start');
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <div ref={mountRef} className="w-full h-full" />

      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none">
        {gameState === 'playing' && (
          <div className="flex justify-between items-start">
            <div className="bg-black/60 text-white p-4 rounded-lg">
              <div className="text-xl font-bold">레벨 {level}</div>
              <div className="text-lg">점수: {score}</div>
              <div className="text-lg">신발: {foundShoes}/{totalShoes}</div>
            </div>
            <div className={`bg-black/60 text-white p-4 rounded-lg text-2xl font-bold ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : ''}`}>
              ⏰ {timeLeft}초
            </div>
          </div>
        )}
      </div>

      {/* 도움말 */}
      <div className="absolute bottom-4 left-0 right-0 pointer-events-none">
        {gameState === 'playing' && (
          <div className="text-center">
            <div className="bg-red-600/80 text-white px-6 py-3 rounded-lg inline-block mb-2">
              💬 버스 곧 출발해요! 신발 찾으세요!
            </div>
            <div className="bg-black/60 text-white px-4 py-2 rounded-lg inline-block text-sm">
              🎮 WASD/화살표 이동 | 마우스 회전(캔버스 클릭) | 클릭해서 신발 찾기
            </div>
          </div>
        )}
      </div>

      {/* 시작 화면 */}
      {gameState === 'start' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900 bg-opacity-95">
          <div className="text-center space-y-6 p-8 max-w-2xl">
            <h1 className="text-5xl font-bold text-white">나디아의 꿈 3D</h1>
            <h2 className="text-3xl text-yellow-300">신발 찾기 게임 👟</h2>
            <div className="bg-white/10 p-6 rounded-xl text-white">
              <p className="text-xl mb-4">🌙 3D 세계에서 신발을 찾아라!</p>
              <ul className="text-left space-y-2">
                <li>🎮 WASD 또는 화살표로 이동</li>
                <li>🖱️ 먼저 캔버스를 클릭하면 마우스로 회전</li>
                <li>👆 신발을 클릭해서 찾기</li>
                <li>⏰ 시간 안에 모든 신발 찾기!</li>
              </ul>
            </div>
            <button
              onClick={startGame}
              className="bg-yellow-500 hover:bg-yellow-600 text-black px-12 py-4 rounded-full text-2xl font-bold transition-all transform hover:scale-105 pointer-events-auto"
            >
              게임 시작!
            </button>
          </div>
        </div>
      )}

      {/* 레벨 완료 */}
      {gameState === 'levelComplete' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center space-y-4">
            <h1 className="text-6xl font-bold text-green-400 animate-bounce">레벨 클리어! 🎉</h1>
            <p className="text-3xl text-white">모든 신발을 찾았어요!</p>
            <p className="text-2xl text-yellow-300">+ {level * 100 + timeLeft * 10} 점</p>
            <p className="text-xl text-white">다음 레벨로...</p>
          </div>
        </div>
      )}

      {/* 게임 오버 */}
      {gameState === 'gameOver' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-red-900 to-black bg-opacity-95">
          <div className="text-center space-y-6 p-8">
            <h1 className="text-5xl font-bold text-red-400">시간 초과! ⏰</h1>
            <p className="text-2xl text-white">버스가 출발했어요... 🚌</p>
            <div className="bg-white/10 p-6 rounded-xl">
              <p className="text-3xl font-bold text-yellow-300 mb-2">최종 점수</p>
              <p className="text-5xl font-bold text-white">{score}</p>
              <p className="text-xl text-gray-300 mt-2">레벨 {level} 도달</p>
            </div>
            <button
              onClick={resetGame}
              className="bg-purple-600 hover:bg-purple-700 text-white px-12 py-4 rounded-full text-2xl font-bold transition-all transform hover:scale-105 pointer-events-auto"
            >
              다시 도전하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
