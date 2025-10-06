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
  const playerRef = useRef({ x: 0, z: 0, rotationY: 0 });
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

    // 기존 씬/렌더러 정리 (짧은 회로 표현식 → if문으로 변경)
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
    playerRef.current = { x: 0, z: 0, rotationY: 0 };

    // 씬
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 10, 50);
    sceneRef.current = scene;

    // 카메라
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 0);
    cameraRef.current = camera;

    // 렌더러
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 조명
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    // 바닥
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0x90ee90, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // 벽
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

    // 신발
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

    // 이벤트
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    const onClick = (event: MouseEvent) => {
      if (gameState !== 'playing') return;

      const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // ⬇️ 타입 수정: THREE.Event → THREE.Object3DEventMap
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
      if (document.pointerLockElement === renderer.domElem
