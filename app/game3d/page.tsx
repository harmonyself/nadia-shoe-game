'use client';

import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ShoeHunt3D() {
  // 위 코드 전체 복사
  import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ShoeHunt3D() {
  const [gameState, setGameState] = useState('start');
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [foundShoes, setFoundShoes] = useState(0);
  const [totalShoes, setTotalShoes] = useState(1);
  
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const shoesRef = useRef([]);
  const playerRef = useRef({ x: 0, z: 0, rotationY: 0 });
  const keysRef = useRef({});
  const mouseRef = useRef({ x: 0, y: 0, locked: false });
  
  // 타이머
  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (gameState === 'playing' && timeLeft === 0) {
      setGameState('gameOver');
    }
  }, [timeLeft, gameState]);
  
  // 레벨 완료 체크
  useEffect(() => {
    if (gameState === 'playing' && foundShoes >= totalShoes) {
      setScore(score + level * 100 + timeLeft * 10);
      setGameState('levelComplete');
      setTimeout(() => {
        setLevel(level + 1);
        startGame();
      }, 3000);
    }
  }, [foundShoes, totalShoes, gameState]);
  
  const startGame = () => {
    const shoesCount = level;
    setTotalShoes(shoesCount);
    setFoundShoes(0);
    setTimeLeft(Math.max(20, 40 - level * 3));
    setGameState('playing');
    
    // 3D 씬 초기화
    setTimeout(() => initThreeJS(shoesCount), 100);
  };
  
  const initThreeJS = (shoesCount) => {
    if (!mountRef.current) return;
    
    // 기존 씬 정리
    if (rendererRef.current) {
      mountRef.current.removeChild(rendererRef.current.domElement);
      rendererRef.current.dispose();
    }
    
    // 씬 설정
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 10, 50);
    sceneRef.current = scene;
    
    // 카메라 (1인칭 시점)
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 0); // 눈 높이
    cameraRef.current = camera;
    
    // 렌더러
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // 조명
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // 바닥
    const floorGeometry = new THREE.PlaneGeometry(30, 30);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x90ee90,
      roughness: 0.8 
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    
    // 벽들
    const wallMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffd700,
      roughness: 0.7 
    });
    
    // 뒷벽
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(30, 5, 0.5), wallMaterial);
    backWall.position.set(0, 2.5, -15);
    scene.add(backWall);
    
    // 앞벽
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(30, 5, 0.5), wallMaterial);
    frontWall.position.set(0, 2.5, 15);
    scene.add(frontWall);
    
    // 왼쪽벽
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 30), wallMaterial);
    leftWall.position.set(-15, 2.5, 0);
    scene.add(leftWall);
    
    // 오른쪽벽
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 30), wallMaterial);
    rightWall.position.set(15, 2.5, 0);
    scene.add(rightWall);
    
    // 신발들 생성
    const shoes = [];
    const shoeColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
    
    for (let i = 0; i < shoesCount; i++) {
      const shoeGroup = new THREE.Group();
      
      // 신발 모양 (간단한 박스 조합)
      const soleMaterial = new THREE.MeshStandardMaterial({ 
        color: shoeColors[i % shoeColors.length]
      });
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.5), soleMaterial);
      sole.castShadow = true;
      shoeGroup.add(sole);
      
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.3), soleMaterial);
      upper.position.set(0, 0.125, -0.05);
      upper.castShadow = true;
      shoeGroup.add(upper);
      
      // 랜덤 위치 (벽에서 멀리)
      const x = (Math.random() - 0.5) * 20;
      const z = (Math.random() - 0.5) * 20;
      shoeGroup.position.set(x, 0.1, z);
      shoeGroup.rotation.y = Math.random() * Math.PI * 2;
      
      shoeGroup.userData.isShoe = true;
      shoeGroup.userData.found = false;
      shoeGroup.userData.originalColor = shoeColors[i % shoeColors.length];
      
      scene.add(shoeGroup);
      shoes.push(shoeGroup);
    }
    
    shoesRef.current = shoes;
    
    // 레이캐스터
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // 클릭 이벤트
    const onClick = (event) => {
      if (gameState !== 'playing') return;
      
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      
      for (let intersect of intersects) {
        let obj = intersect.object;
        while (obj.parent && !obj.userData.isShoe) {
          obj = obj.parent;
        }
        
        if (obj.userData.isShoe && !obj.userData.found) {
          obj.userData.found = true;
          obj.children.forEach(child => {
            if (child.material) {
              child.material.color.setHex(0x00ff00);
              child.material.emissive = new THREE.Color(0x00ff00);
              child.material.emissiveIntensity = 0.5;
            }
          });
          setFoundShoes(prev => prev + 1);
          break;
        }
      }
    };
    
    renderer.domElement.addEventListener('click', onClick);
    
    // 키보드 이벤트
    const onKeyDown = (e) => { keysRef.current[e.key.toLowerCase()] = true; };
    const onKeyUp = (e) => { keysRef.current[e.key.toLowerCase()] = false; };
    
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    
    // 마우스 이동
    const onMouseMove = (e) => {
      if (mouseRef.current.locked) {
        playerRef.current.rotationY -= e.movementX * 0.002;
      }
    };
    
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    
    // 포인터 락
    renderer.domElement.addEventListener('click', () => {
      renderer.domElement.requestPointerLock();
    });
    
    document.addEventListener('pointerlockchange', () => {
      mouseRef.current.locked = document.pointerLockElement === renderer.domElement;
    });
    
    // 애니메이션 루프
    const animate = () => {
      if (gameState !== 'playing') return;
      requestAnimationFrame(animate);
      
      // 플레이어 이동
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
      
      // 경계 체크
      playerRef.current.x = Math.max(-14, Math.min(14, playerRef.current.x));
      playerRef.current.z = Math.max(-14, Math.min(14, playerRef.current.z));
      
      camera.position.x = playerRef.current.x;
      camera.position.z = playerRef.current.z;
      camera.rotation.y = playerRef.current.rotationY;
      
      renderer.render(scene, camera);
    };
    
    animate();
    
    // 리사이즈
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    
    window.addEventListener('resize', onResize);
    
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
    };
  };
  
  const resetGame = () => {
    setLevel(1);
    setScore(0);
    setGameState('start');
  };
  
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* 3D Canvas */}
      <div ref={mountRef} className="w-full h-full" />
      
      {/* UI 오버레이 */}
      <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none">
        {gameState === 'playing' && (
          <div className="flex justify-between items-start">
            <div className="bg-black bg-opacity-60 text-white p-4 rounded-lg">
              <div className="text-xl font-bold">레벨 {level}</div>
              <div className="text-lg">점수: {score}</div>
              <div className="text-lg">신발: {foundShoes}/{totalShoes}</div>
            </div>
            
            <div className={`bg-black bg-opacity-60 text-white p-4 rounded-lg text-2xl font-bold ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : ''}`}>
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
            
            <div className="bg-white bg-opacity-10 p-6 rounded-xl text-white">
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
          <div className="text-center space-y-4 animate-bounce">
            <h1 className="text-6xl font-bold text-green-400">레벨 클리어! 🎉</h1>
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
}