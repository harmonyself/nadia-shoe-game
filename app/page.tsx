'use client';

import { useState, useEffect, useMemo } from 'react';

export default function ShoeHuntGame() {
  const [gameState, setGameState] = useState('start');
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [clickedShoe, setClickedShoe] = useState<number | null>(null);
  
  const shoes = ['👟', '👞', '👠', '🥿', '🩴', '👢', '🥾', '👡'];
  const correctShoe = '👟';
  
  const getLevelConfig = () => {
    const baseShoes = 8;
    const shoesCount = baseShoes + (level - 1) * 4;
    const wrongShoes = shoesCount - 1;
    
    return {
      shoesCount,
      timeLimit: Math.max(20, 30 - (level - 1) * 2),
      wrongShoes
    };
  };
  
  const config = getLevelConfig();
  const [shoeArray, setShoeArray] = useState<string[]>([]);
  
  const generateShoes = () => {
    const shoeArray = [correctShoe];
    const availableWrongShoes = shoes.filter(s => s !== correctShoe);
    
    for (let i = 0; i < config.wrongShoes; i++) {
      const randomShoe = availableWrongShoes[Math.floor(Math.random() * availableWrongShoes.length)];
      shoeArray.push(randomShoe);
    }
    
    return shoeArray.sort(() => Math.random() - 0.5);
  };
  
  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (gameState === 'playing' && timeLeft === 0) {
      setGameState('gameOver');
    }
  }, [timeLeft, gameState]);
  
  const crowdMessages = useMemo(() => [
    "신발도 없잖아 ㅋㅋ",
    "팀장이 신발이 없다고?",
    "버스 곧 출발하는데...",
    "뭐하는 거야 빨리!"
  ], []);
  
  const [currentMessage, setCurrentMessage] = useState(crowdMessages[0]);
  
  useEffect(() => {
    if (gameState === 'playing') {
      const interval = setInterval(() => {
        setCurrentMessage(crowdMessages[Math.floor(Math.random() * crowdMessages.length)]);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [gameState, crowdMessages]);
  
  const startGame = () => {
    setShoeArray(generateShoes());
    setGameState('playing');
    setTimeLeft(config.timeLimit);
    setClickedShoe(null);
  };
  
  const handleShoeClick = (shoe: string, index: number) => {
    setClickedShoe(index);
    
    if (shoe === correctShoe) {
      setScore(score + level * 100);
      setGameState('found');
      setTimeout(() => {
        setLevel(level + 1);
        startGame();
      }, 3000);
    } else {
      setTimeout(() => setClickedShoe(null), 300);
    }
  };
  
  const resetGame = () => {
    setLevel(1);
    setScore(0);
    setGameState('start');
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 p-4 flex items-center justify-center">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl p-8">
        
        {gameState === 'start' && (
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-purple-600">나디아 팀장의 신발</h1>
            <h2 className="text-2xl text-gray-700">신발 찾기 게임 👟</h2>
            
            <div className="bg-purple-50 p-6 rounded-xl text-left max-w-2xl mx-auto">
              <p className="text-lg mb-2 font-semibold">🌙나디아 팀장의 상황:</p>
              <ul className="space-y-2 text-gray-700">
                <li>• 단체 행사에 가야 하는데 팀장의 신발이 없어졌다!</li>
                <li>• 버스가 곧 출발하는데...</li>
                <li>• 사람들이 &quot;팀장 맞아?&quot; 하며 웅성웅성</li>
                <li>• 신발을 찾아야 팀장으로 인정받는다!</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <p className="text-xl text-gray-600">당신의 신발(👟)을 찾아라!</p>
              <p className="text-sm text-gray-500">레벨이 오를수록 신발이 많아지고 시간이 줄어듭니다</p>
            </div>
            
            <button
              onClick={startGame}
              className="bg-purple-600 hover:bg-purple-700 text-white px-12 py-4 rounded-full text-xl font-bold transition-all transform hover:scale-105"
            >
              게임 시작!
            </button>
          </div>
        )}
        
        {gameState === 'playing' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="text-2xl font-bold text-purple-600">
                  레벨 {level}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⭐</span>
                  <span className="text-xl font-bold">{score}</span>
                </div>
              </div>
              
              <div className={`flex items-center gap-2 text-2xl font-bold ${timeLeft <= 5 ? 'text-red-600 animate-pulse' : 'text-gray-700'}`}>
                <span>⏰</span>
                {timeLeft}초
              </div>
            </div>
            
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-center">
              <p className="text-lg text-red-700">💬 {currentMessage}</p>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-xl text-center">
              <p className="text-gray-700 font-semibold">버스 출발 전에 당신의 신발(👟)을 찾으세요!</p>
            </div>
            
            <div className={`grid gap-4 ${config.shoesCount <= 12 ? 'grid-cols-4' : 'grid-cols-5'}`}>
              {shoeArray.map((shoe, index) => (
                <button
                  key={index}
                  onClick={() => handleShoeClick(shoe, index)}
                  className={`
                    aspect-square text-6xl bg-white border-4 rounded-2xl 
                    transition-all transform hover:scale-110 hover:shadow-xl
                    ${clickedShoe === index ? 'scale-95 bg-gray-200' : 'border-gray-300'}
                  `}
                >
                  {shoe}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {gameState === 'found' && (
          <div className="text-center space-y-6 animate-bounce">
            <h1 className="text-5xl font-bold text-green-600">찾았다! 👟</h1>
            
            <div className="bg-green-50 p-8 rounded-xl">
              <p className="text-3xl mb-4">🎉 팀장님 환영합니다! 🎉</p>
              <p className="text-xl text-gray-700 mb-2">&quot;역시 우리 팀장님이야!&quot;</p>
              <p className="text-xl text-gray-700">&quot;짝짝짝짝~&quot;</p>
            </div>
            
            <div className="text-2xl font-bold text-purple-600">
              + {level * 100} 점!
            </div>
            
            <p className="text-lg text-gray-600">다음 레벨로...</p>
          </div>
        )}
        
        {gameState === 'gameOver' && (
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-red-600">버스가 출발했어요... 🚌</h1>
            
            <div className="bg-red-50 p-6 rounded-xl">
              <p className="text-xl text-gray-700 mb-4">&quot;팀장 없이 가요!&quot;</p>
              <p className="text-lg text-gray-600">신발을 찾지 못했습니다...</p>
            </div>
            
            <div className="bg-purple-50 p-6 rounded-xl">
              <p className="text-2xl font-bold text-purple-600 mb-2">최종 점수</p>
              <p className="text-4xl font-bold">{score} 점</p>
              <p className="text-xl text-gray-600 mt-2">레벨 {level}까지 도달</p>
            </div>
            
            <button
              onClick={resetGame}
              className="bg-purple-600 hover:bg-purple-700 text-white px-12 py-4 rounded-full text-xl font-bold transition-all transform hover:scale-105"
            >
              다시 도전하기
            </button>
          </div>
        )}
        
      </div>
    </div>
  );
}