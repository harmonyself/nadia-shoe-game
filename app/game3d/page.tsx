'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type KeysMap = Record<string, boolean>;

export default function ShoeHunt3D() {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'levelComplete' | 'gameOver'>('start');
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [foundShoes, setFoundShoes] = useState(0);
  const [totalShoes, setTotalShoes] = useState(1);
  const [timeLeft, setTimeLeft] = useState(30);

  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const shoesRef = useRef<THREE.Group[]>([]);
  const playerRef = useRef({ x: 0, z: 3, rotationY: 0 });
  const keysRef = useRef<KeysMap>({});
  const animationIdRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 타이머
  useEffect(() => {
    if (gameState === 'playing') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setGameState('gameOver');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      };
    }
  }, [gameState]);

  // ThreeJS 초기화
  const initThreeJS = useCallback((shoesCount: number) => {
    const mount = mountRef.current;
    if (!mount) return;

    // (1) 기존 씬/렌더러 정리: 짧은 회로 표현식 금지 → if문으로 전환 (no-unused-expressions 대응)
    if (rendererRef.current) {
      try {
        if (mount.contains(rendererRef.current.domElement)) {
          mount.removeChild(rendererRef.current.domElement);
        }
      } catch {
        // ignore
      }
      rendererRef.current.dispose();
      rendererRef.current = null;
    }
    sceneRef.current = null;
    cameraRef.current = null;
    shoesRef.current = [];
    playerRef.current = { x: 0, z: 3, rotationY: 0 };

    // (2) 씬
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 10, 50);
    sceneRef.current = scene;

    // (3) 카메라: 초기 시선 고정으로 검은 화면 방지
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000); // aspect는 아래에서 재계산
    camera.position.set(0, 1.6, 3);
    camera.lookAt(0, 1.6, -3);
    cameraRef.current = camera;

    // (4) 렌더러: 컬러스페이스/픽셀비율/톤매핑 설정 + 컨테이너 크기 기준
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace; // r152+
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setPixelRatio(Math.min((window.devicePixelRatio ?? 1), 2));

    const { clientWidth, clientHeight } = mount;
    renderer.setSize(clientWidth, clientHeight);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();

    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // (5) 조명
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    // (6) 바닥
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0x90ee90, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // (7) 벽
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.7 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(30, 5, 0.5), wallMaterial);
    backWall.position.set(0, 2.5, -15);
    scene.add(backWall);
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(30, 5, 0.5), wallMaterial);
    frontWall.position.set(0, 2.5, 15);
    scene.add(frontWall);
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 30), wallMaterial);
    leftWall.position.set(-15, 2.5, 0);
    scene.add(leftWall);
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 30), wallMaterial);
    rightWall.position.set(15, 2.5, 0);
    scene.add(rightWall);

    // (8) 즉시 확인용 디버그 큐브 — 보이면 렌더 OK (원하면 이후 삭제해도 됨)
    const debugCube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xff55ff, roughness: 0.5, metalness: 0.1 })
    );
    debugCube.position.set(0, 1.6, -3);
    scene.add(debugCube);

    // (9) 신발
    const shoes: THREE.Group[] = [];
    const shoeColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];

    for (let i = 0; i < shoesCount; i++) {
      const shoeGroup = new THREE.Group();
      const material = new THREE.MeshStandardMaterial({ color: shoeColors[i % shoeColors.length] });

      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.5), material);
      sole.castShadow = true;
      shoeGroup.add(sole);

      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.3), material);
      upper.position.set(0, 0.125, -0.05);
      upper.castShadow = true;
      shoeGroup.add(upper);

      const x = (Math.random() - 0.5) * 20;
      const z = (Math.random() - 0.5) * 20;
      shoeGroup.position.set(x, 0.1, z);
      shoeGroup.rotation.y = Math.random() * Math.PI * 2;

      (shoeGroup.userData as { isShoe: boolean; found: boolean; originalColor: number }) = {
        isShoe: true,
        found: false,
        originalColor: shoeColors[i % shoeColors.length],
      };

      scene.add(shoeGroup);
      shoes.push(shoeGroup);
    }
    shoesRef.current = shoes;

    // (10) 이벤트
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
      
      // 대기 화면에서 Enter로 시작
      if (gameState === 'start' && (e.key === 'Enter' || e.key === ' ')) {
        startGame();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    const onClick = (event: MouseEvent) => {
      // 게임 상태 체크
      if (gameState !== 'playing') return;

      const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // 타입 정합성: Object3DEventMap 사용
      const intersects: THREE.Intersection<THREE.Object3D<THREE.Object3DEventMap>>[] =
        raycaster.intersectObjects(scene.children, true);

      for (const intersect of intersects) {
        // 상위 Group까지 올라감
        let obj: THREE.Object3D<THREE.Object3DEventMap> = intersect.object;
        while (obj.parent && obj.parent.type !== 'Scene') {
          obj = obj.parent as THREE.Object3D<THREE.Object3DEventMap>;
        }

        const userData = obj.userData as { isShoe?: boolean; found?: boolean };
        if (userData?.isShoe && !userData?.found) {
          userData.found = true;

          // 자식 Mesh들의 재질 색상 변경
          obj.children.forEach((child) => {
            if (child instanceof THREE.Mesh) {
              const mat = child.material;
              const mats = Array.isArray(mat) ? mat : [mat];
              mats.forEach((m) => {
                if (m instanceof THREE.MeshStandardMaterial) {
                  m.color.setHex(0x00ff00);
                  m.emissive = new THREE.Color(0x00ff00);
                  m.emissiveIntensity = 0.5;
                }
              });
            }
          });

          setFoundShoes((prev) => prev + 1);
          break;
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === renderer.domElement) {
        playerRef.current.rotationY -= e.movementX * 0.002;
      }
    };

    const onResize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('click', onClick);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onResize);

    renderer.domElement.addEventListener('click', () => {
      renderer.domElement.requestPointerLock();
    });

    // (11) 애니메이션 루프: 항상 렌더 (idle 렌더), 이동/물리는 playing일 때만
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      if (gameState === 'playing') {
        const speed = 0.1;
        const rotation = playerRef.current.rotationY;

        if (keysRef.current['w'] || keysRef.current['arrowup']) {
          playerRef.current.x -= Math.sin(rotation) * speed;
          playerRef.current.z -= Math.cos(rotation) * speed;
        }
        if (keysRef.current['s'] || keysRef.current['arrowdown']) {
          playerRef.current.x += Math.sin(rotation) * speed;
          playerRef.current.z += Math.cos(rotation) * speed;
        }
        if (keysRef.current['a'] || keysRef.current['arrowleft']) {
          playerRef.current.x -= Math.cos(rotation) * speed;
          playerRef.current.z += Math.sin(rotation) * speed;
        }
        if (keysRef.current['d'] || keysRef.current['arrowright']) {
          playerRef.current.x += Math.cos(rotation) * speed;
          playerRef.current.z -= Math.sin(rotation) * speed;
        }

        // 경계
        playerRef.current.x = Math.max(-14, Math.min(14, playerRef.current.x));
        playerRef.current.z = Math.max(-14, Math.min(14, playerRef.current.z));

        camera.position.x = playerRef.current.x;
        camera.position.z = playerRef.current.z;
        camera.rotation.y = playerRef.current.rotationY;
      }

      renderer.render(scene, camera);
    };

    // (12) 첫 프레임 즉시 렌더 — 검은 화면 진단에 도움
    renderer.render(scene, camera);
    animate();

    // cleanup
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('click', onClick);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);

      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }

      try {
        if (renderer.domElement && mount.contains(renderer.domElement)) {
          mount.removeChild(renderer.domElement);
        }
      } catch {
        // ignore
      }
      renderer.dispose();
    };
  }, [gameState]);

  // 게임 시작(의존성 안정화)
  const startGame = useCallback(() => {
    const shoesCount = level;
    setTotalShoes(shoesCount);
    setFoundShoes(0);
    setTimeLeft(Math.max(20, 40 - level * 3));
    setGameState('playing');
    setTimeout(() => initThreeJS(shoesCount), 100);
  }, [initThreeJS, level]);

  // 레벨 완료 체크
  useEffect(() => {
    if (gameState === 'playing' && foundShoes >= totalShoes && totalShoes > 0) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setScore((prev) => prev + level * 100 + timeLeft * 10);
      setGameState('levelComplete');

      const to = setTimeout(() => {
        const next = level + 1;
        setLevel(next);
        const nextShoes = next;
        setTotalShoes(nextShoes);
        setFoundShoes(0);
        setTimeLeft(Math.max(20, 40 - next * 3));
        setGameState('playing');
        setTimeout(() => initThreeJS(nextShoes), 100);
      }, 3000);

      return () => clearTimeout(to);
    }
  }, [foundShoes, totalShoes, gameState, level, timeLeft, initThreeJS]);

  const resetGame = () => {
    setLevel(1);
    setScore(0);
    setGameState('start');
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <div ref={mountRef} className="w-full h-full" />

      {/* UI 오버레이 */}
      <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none">
        {gameState === 'playing' && (
          <div className="flex justify-between items-start">
            <div className="bg-black bg-opacity-60 text-white p-4 rounded-lg">
              <div className="text-xl font-bold">레벨 {level}</div>
              <div className="text-lg">점수: {score}</div>
              <div className="text-lg">
                신발: {foundShoes}/{totalShoes}
              </div>
            </div>

            <div
              className={`bg-black bg-opacity-60 text-white p-4 rounded-lg text-2xl font-bold ${
                timeLeft <= 5 ? 'text-red-400 animate-pulse' : ''
              }`}
            >
              ⏰ {timeLeft}초
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-4 left-0 right-0 pointer-events-none">
        {gameState === 'playing' && (
          <div className="text-center">
            <div className="bg-red-600 bg-opacity-80 text-white px-6 py-3 rounded-lg inline-block mb-2">
              💬 버스 곧 출발해요! 신발 찾으세요!
            </div>
            <div className="bg-black bg-opacity-60 text-white px-4 py-2 rounded-lg inline-block text-sm">
              🎮 WASD로 이동 | 마우스로 둘러보기 | 클릭해서 신발 찾기
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

            <div className="bg-white bg-opacity-10 p-6 rounded-xl text-black">
              <p className="text-xl mb-4">🌙 3D 세계에서 신발을 찾아라!</p>
              <ul className="text-left space-y-2">
                <li>🎮 WASD 또는 화살표로 이동</li>
                <li>🖱️ 마우스로 둘러보기</li>
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
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80">
          <div className="text-center space-y-4">
            <h1 className="text-6xl font-bold text-green-400 animate-bounce">
              레벨 클리어! 🎉
            </h1>
            <p className="text-3xl text-white">모든 신발을 찾았어요!</p>
            <p className="text-2xl text-yellow-300">
              + {level * 100 + timeLeft * 10} 점
            </p>
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

            <div className="bg-white bg-opacity-10 p-6 rounded-xl">
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
