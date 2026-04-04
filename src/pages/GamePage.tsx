/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Camera, 
  Sparkles, 
  RotateCcw, 
  Play, 
  Pause, 
  Lightbulb, 
  Trash2, 
  CheckCircle2, 
  Dices, 
  Undo2, 
  Redo2, 
  Moon, 
  Sun, 
  Keyboard,
  Upload,
  Image as ImageIcon,
  Loader2,
  X,
  ChevronRight,
  Zap,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import Tesseract from 'tesseract.js';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { updateUserStats, initializeUserStats } from '../utils/statsManager';

// --- Constants & Types ---

type Grid = number[][];
type Difficulty = 'Easy' | 'Medium' | 'Hard';

const EMPTY_GRID: Grid = Array(9).fill(null).map(() => Array(9).fill(0));

// --- Sudoku Logic ---

const isValid = (grid: Grid, row: number, col: number, num: number): boolean => {
  for (let x = 0; x < 9; x++) {
    if (grid[row][x] === num || grid[x][col] === num) return false;
  }
  const startRow = row - (row % 3);
  const startCol = col - (col % 3);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (grid[i + startRow][j + startCol] === num) return false;
    }
  }
  return true;
};

const solveSudoku = (grid: Grid): boolean => {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] === 0) {
        for (let num = 1; num <= 9; num++) {
          if (isValid(grid, row, col, num)) {
            grid[row][col] = num;
            if (solveSudoku(grid)) return true;
            grid[row][col] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
};

const findEmpty = (grid: Grid): [number, number] | null => {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) return [r, c];
    }
  }
  return null;
};

const generatePuzzle = (difficulty: Difficulty): { puzzle: Grid; solution: Grid } => {
  const solution: Grid = Array(9).fill(null).map(() => Array(9).fill(0));
  
  // Fill diagonal 3x3 boxes first for randomness
  for (let i = 0; i < 9; i += 3) {
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
    let idx = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        solution[i + r][i + c] = nums[idx++];
      }
    }
  }
  
  solveSudoku(solution);
  
  const puzzle = solution.map(row => [...row]);
  const attempts = difficulty === 'Easy' ? 30 : difficulty === 'Medium' ? 45 : 60;
  
  let count = 0;
  while (count < attempts) {
    const r = Math.floor(Math.random() * 9);
    const c = Math.floor(Math.random() * 9);
    if (puzzle[r][c] !== 0) {
      puzzle[r][c] = 0;
      count++;
    }
  }
  
  return { puzzle, solution };
};

// --- Components ---

export default function GamePage() {
  const navigate = useNavigate();
  
  // State
  const [grid, setGrid] = useState<Grid>(EMPTY_GRID);
  const [initialGrid, setInitialGrid] = useState<Grid>(EMPTY_GRID);
  const [solution, setSolution] = useState<Grid | null>(null);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [history, setHistory] = useState<Grid[]>([]);
  const [redoStack, setRedoStack] = useState<Grid[]>([]);
  const [isPencilMode, setIsPencilMode] = useState(false);
  const [pencilMarks, setPencilMarks] = useState<Set<number>[][]>(
    Array(9).fill(null).map(() => Array(9).fill(null).map(() => new Set()))
  );
  const [isSolving, setIsSolving] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [solveSpeed, setSolveSpeed] = useState(50);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [timer, setTimer] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gameCompleted, setGameCompleted] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const solveAbortRef = useRef(false);

  // --- Effects ---

  useEffect(() => {
    // Check if user is logged in
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate('/login');
      } else {
        setUserEmail(user.email);
        setUserId(user.uid);
        // Initialize user stats in background (don't block)
        if (user.email) {
          initializeUserStats(user.uid, user.email).catch(err => {
            console.error('Stats initialization failed (but page continues):', err);
          });
        }
      }
      setIsLoading(false);
    });
    
    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    const saved = localStorage.getItem('sudoku-state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setGrid(parsed.grid);
        setInitialGrid(parsed.initialGrid);
        setTimer(parsed.timer);
        setDifficulty(parsed.difficulty);
      } catch (e) {
        console.error("Failed to load saved state", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sudoku-state', JSON.stringify({ grid, initialGrid, timer, difficulty }));
  }, [grid, initialGrid, timer, difficulty]);

  useEffect(() => {
    if (isTimerActive) {
      timerRef.current = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTimerActive]);

  // --- Handlers ---

  const handleCellClick = (r: number, c: number) => {
    if (isSolving) return;
    setSelectedCell([r, c]);
    if (!isTimerActive && grid.some(row => row.some(cell => cell !== 0))) {
      setIsTimerActive(true);
    }
  };

  const updateCell = useCallback((r: number, c: number, val: number) => {
    if (initialGrid[r][c] !== 0) return;
    
    if (isPencilMode && val !== 0) {
      const newMarks = [...pencilMarks.map(row => row.map(cell => new Set(cell)))];
      if (newMarks[r][c].has(val)) {
        newMarks[r][c].delete(val);
      } else {
        newMarks[r][c].add(val);
      }
      setPencilMarks(newMarks);
      return;
    }

    // Check if the entered number is invalid
    if (val !== 0 && !isValid(grid, r, c, val)) {
      setMistakes(prev => prev + 1);
    }

    setHistory(prev => [...prev, grid.map(row => [...row])]);
    setRedoStack([]);
    
    const newGrid = grid.map((row, ri) => 
      row.map((cell, ci) => (ri === r && ci === c ? val : cell))
    );
    setGrid(newGrid);

    // Check if solved
    if (newGrid.every(row => row.every(cell => cell !== 0))) {
      const flat = newGrid.flat();
      const isAllValid = newGrid.every((row, ri) => 
        row.every((cell, ci) => {
          const temp = newGrid[ri][ci];
          newGrid[ri][ci] = 0;
          const v = isValid(newGrid, ri, ci, temp);
          newGrid[ri][ci] = temp;
          return v;
        })
      );
      if (isAllValid) {
        setIsTimerActive(false);
        setGameCompleted(true);
        
        // Save stats to Firestore if user is logged in
        if (userId) {
          updateUserStats(userId, timer, true, mistakes);
        }
        
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ffffff', '#cccccc', '#999999']
        });
      }
    }
  }, [grid, initialGrid, pencilMarks, isPencilMode, userId, timer]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isSolving || !selectedCell) return;
    const [r, c] = selectedCell;

    if (e.key >= '1' && e.key <= '9') {
      updateCell(r, c, parseInt(e.key));
    } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      updateCell(r, c, 0);
    } else if (e.key === 'ArrowUp' && r > 0) setSelectedCell([r - 1, c]);
    else if (e.key === 'ArrowDown' && r < 8) setSelectedCell([r + 1, c]);
    else if (e.key === 'ArrowLeft' && c > 0) setSelectedCell([r, c - 1]);
    else if (e.key === 'ArrowRight' && c < 8) setSelectedCell([r, c + 1]);
    else if (e.ctrlKey && e.key === 'z') undo();
    else if (e.ctrlKey && e.key === 'y') redo();
  };

  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack(prevRedo => [grid.map(row => [...row]), ...prevRedo]);
    setGrid(prev);
    setHistory(prevHistory => prevHistory.slice(0, -1));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setHistory(prevHistory => [...prevHistory, grid.map(row => [...row])]);
    setGrid(next);
    setRedoStack(prevRedo => prevRedo.slice(1));
  };

  const resetBoard = () => {
    setGrid(initialGrid);
    setHistory([]);
    setRedoStack([]);
    setTimer(0);
    setIsTimerActive(false);
    setError(null);
    setCelebrationDismissed(false);
    setMistakes(0);
    // Keep uploadedImage and difficulty to preserve image-based puzzles
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('user-email');
      localStorage.removeItem('sudoku-state');
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const generateNew = (diff: Difficulty) => {
    const { puzzle, solution: sol } = generatePuzzle(diff);
    setGrid(puzzle);
    setInitialGrid(puzzle);
    setSolution(sol);
    setHistory([]);
    setRedoStack([]);
    setTimer(0);
    setIsTimerActive(true);
    setDifficulty(diff);
    setError(null);
    setCelebrationDismissed(false);
    setMistakes(0);
  };

  const solveInstantly = () => {
    const workingGrid = grid.map(row => [...row]);
    if (solveSudoku(workingGrid)) {
      setGrid(workingGrid);
      setTimer(0);
      setIsTimerActive(false);
    } else {
      setError("This puzzle is unsolvable!");
    }
  };

  const watchSolve = async () => {
    if (isSolving) {
      solveAbortRef.current = true;
      setIsSolving(false);
      return;
    }

    setTimer(0);
    setIsTimerActive(true);
    setIsSolving(true);
    solveAbortRef.current = false;
    const workingGrid = grid.map(row => [...row]);
    
    const step = async (g: Grid): Promise<boolean> => {
      if (solveAbortRef.current) return false;
      
      const empty = findEmpty(g);
      if (!empty) return true;
      
      const [r, c] = empty;
      for (let num = 1; num <= 9; num++) {
        if (solveAbortRef.current) return false;
        
        if (isValid(g, r, c, num)) {
          g[r][c] = num;
          setGrid(g.map(row => [...row]));
          
          // Delay
          await new Promise(resolve => setTimeout(resolve, solveSpeed));
          
          while (isPaused && !solveAbortRef.current) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          if (await step(g)) return true;
          g[r][c] = 0;
          setGrid(g.map(row => [...row]));
        }
      }
      return false;
    };

    if (await step(workingGrid)) {
      setIsTimerActive(false);
    } else if (!solveAbortRef.current) {
      setError("Unsolvable puzzle!");
    }
    setIsSolving(false);
  };

  const giveHint = () => {
    const workingGrid = grid.map(row => [...row]);
    const sol = [...workingGrid.map(r => [...r])];
    if (solveSudoku(sol)) {
      const emptyCells: [number, number][] = [];
      grid.forEach((row, r) => row.forEach((cell, c) => {
        if (cell === 0) emptyCells.push([r, c]);
      }));
      
      if (emptyCells.length > 0) {
        const [r, c] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        updateCell(r, c, sol[r][c]);
      }
    } else {
      setError("Cannot provide hint for unsolvable puzzle.");
    }
  };

  const validateBoard = () => {
    const isAllValid = grid.every((row, ri) => 
      row.every((cell, ci) => {
        if (cell === 0) return true;
        const temp = grid[ri][ci];
        grid[ri][ci] = 0;
        const v = isValid(grid, ri, ci, temp);
        grid[ri][ci] = temp;
        return v;
      })
    );
    if (isAllValid) {
      setError(null);
      alert("Board is valid so far!");
    } else {
      setError("There are conflicts on the board!");
    }
  };

  // --- Advanced Image Processing with Grid Detection ---

  // Detect grid lines and extract Sudoku cells
  const detectGridAndExtractCells = (imageSrc: string): Promise<string[][]> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const timeout = setTimeout(() => reject(new Error("Grid detection timeout")), 10000);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          // Step 1: Create main canvas and load image
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);

          // Step 2: Convert to grayscale and detect edges
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          const gray = new Uint8ClampedArray(canvas.width * canvas.height);

          for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          }

          // Step 3: Apply Sobel edge detection
          const edges = new Uint8ClampedArray(canvas.width * canvas.height);
          for (let y = 1; y < canvas.height - 1; y++) {
            for (let x = 1; x < canvas.width - 1; x++) {
              const idx = y * canvas.width + x;
              const gx = -gray[(y-1)*canvas.width+(x-1)] - 2*gray[y*canvas.width+(x-1)] - gray[(y+1)*canvas.width+(x-1)]
                       + gray[(y-1)*canvas.width+(x+1)] + 2*gray[y*canvas.width+(x+1)] + gray[(y+1)*canvas.width+(x+1)];
              const gy = -gray[(y-1)*canvas.width+(x-1)] - 2*gray[(y-1)*canvas.width+x] - gray[(y-1)*canvas.width+(x+1)]
                       + gray[(y+1)*canvas.width+(x-1)] + 2*gray[(y+1)*canvas.width+x] + gray[(y+1)*canvas.width+(x+1)];
              edges[idx] = Math.sqrt(gx*gx + gy*gy);
            }
          }

          // Step 4: Find horizontal and vertical lines (grid lines)
          const hLines: number[] = [];
          const vLines: number[] = [];

          // Find horizontal lines
          for (let y = 0; y < canvas.height; y++) {
            let lineStrength = 0;
            for (let x = 0; x < canvas.width; x++) {
              if (edges[y * canvas.width + x] > 50) lineStrength++;
            }
            if (lineStrength > canvas.width * 0.6) hLines.push(y);
          }

          // Find vertical lines
          for (let x = 0; x < canvas.width; x++) {
            let lineStrength = 0;
            for (let y = 0; y < canvas.height; y++) {
              if (edges[y * canvas.width + x] > 50) lineStrength++;
            }
            if (lineStrength > canvas.height * 0.6) vLines.push(x);
          }

          // Step 5: Cluster lines to find grid boundaries
          const clusterLines = (lines: number[], spacing: number = 10): number[] => {
            if (lines.length === 0) return [];
            const clustered: number[] = [];
            let currentCluster = [lines[0]];

            for (let i = 1; i < lines.length; i++) {
              if (lines[i] - lines[i - 1] <= spacing) {
                currentCluster.push(lines[i]);
              } else {
                clustered.push(Math.round(currentCluster.reduce((a, b) => a + b) / currentCluster.length));
                currentCluster = [lines[i]];
              }
            }
            if (currentCluster.length > 0) {
              clustered.push(Math.round(currentCluster.reduce((a, b) => a + b) / currentCluster.length));
            }
            return clustered;
          };

          const hClusteredLines = clusterLines(hLines);
          const vClusteredLines = clusterLines(vLines);

          console.log('Horizontal lines found:', hClusteredLines.length);
          console.log('Vertical lines found:', vClusteredLines.length);

          // If we can't find grid, use fallback division
          let rowBoundaries = hClusteredLines.length >= 10 ? hClusteredLines : 
            Array.from({length: 10}, (_, i) => Math.round(i * canvas.height / 9));
          let colBoundaries = vClusteredLines.length >= 10 ? vClusteredLines : 
            Array.from({length: 10}, (_, i) => Math.round(i * canvas.width / 9));

          // Step 6: Extract cell images (9x9 grid)
          const cellImages: string[][] = [];
          for (let row = 0; row < 9; row++) {
            const cellRow: string[] = [];
            const y1 = rowBoundaries[row];
            const y2 = rowBoundaries[row + 1] || canvas.height;

            for (let col = 0; col < 9; col++) {
              const x1 = colBoundaries[col];
              const x2 = colBoundaries[col + 1] || canvas.width;

              // Extract cell
              const cellCanvas = document.createElement('canvas');
              cellCanvas.width = x2 - x1;
              cellCanvas.height = y2 - y1;
              const cellCtx = cellCanvas.getContext('2d')!;
              cellCtx.drawImage(canvas, x1, y1, x2 - x1, y2 - y1, 0, 0, x2 - x1, y2 - y1);

              cellRow.push(cellCanvas.toDataURL());
            }
            cellImages.push(cellRow);
          }

          resolve(cellImages);
        } catch (err) {
          clearTimeout(timeout);
          reject(err);
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Failed to load image"));
      };

      img.src = imageSrc;
    });
  };

  // Extract number from individual cell
  const extractNumberFromCell = async (cellImage: string): Promise<number> => {
    try {
      const { data: { text } } = await Tesseract.recognize(
        cellImage,
        'eng',
        { logger: () => {} } // Silent
      );
      const num = parseInt(text.match(/\d/)?.[0] || '0');
      return num >= 1 && num <= 9 ? num : 0;
    } catch {
      return 0;
    }
  };

  const handleImageUpload = async (file: File) => {
    setIsScanning(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setUploadedImage(base64);
      
      try {
        // Step 1: Detect grid and extract cell images
        console.log('Starting grid detection...');
        const cellImages = await detectGridAndExtractCells(base64);
        console.log('Grid detected. Extracted cells:', cellImages.length + 'x' + cellImages[0].length);

        // Step 2: OCR each cell individually
        const grid: Grid = [];
        let cellsFilled = 0;
        
        for (let row = 0; row < 9; row++) {
          const gridRow: number[] = [];
          for (let col = 0; col < 9; col++) {
            const num = await extractNumberFromCell(cellImages[row][col]);
            gridRow.push(num);
            if (num !== 0) cellsFilled++;
          }
          grid.push(gridRow);
        }

        console.log('OCR complete. Cells filled:', cellsFilled);

        if (cellsFilled < 17) {
          throw new Error(`Only found ${cellsFilled} numbers. Sudoku needs at least 17 clues.`);
        }

        setGrid(grid);
        setInitialGrid(grid);
        setTimer(0);
        setIsTimerActive(true);
        setDifficulty(null);
        setMistakes(0);
      } catch (err: any) {
        setError(err.message || "Failed to scan Sudoku. Try a clearer photo with visible grid lines.");
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const item = e.clipboardData.items[0];
    if (item?.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) handleImageUpload(file);
    }
  };

  // --- Helpers ---

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCellStatus = (r: number, c: number) => {
    const val = grid[r][c];
    if (val === 0) return 'empty';
    if (initialGrid[r][c] !== 0) return 'initial';
    
    // Check validity
    const temp = grid[r][c];
    grid[r][c] = 0;
    const valid = isValid(grid, r, c, temp);
    grid[r][c] = temp;
    
    if (!valid) return 'invalid';
    if (isSolving) return 'solving';
    return 'user';
  };

  const isRelated = (r: number, c: number) => {
    if (!selectedCell) return false;
    const [sr, sc] = selectedCell;
    if (r === sr && c === sc) return false;
    return r === sr || c === sc || (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3));
  };

  const remainingCells = useMemo(() => {
    return grid.flat().filter(c => c === 0).length;
  }, [grid]);

  // --- Render ---

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDarkMode ? 'bg-[#0f0f0f] text-white' : 'bg-slate-50 text-slate-900'} font-sans selection:bg-black/30`} onPaste={onPaste}>
      
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-white" />
            <p className="text-white font-medium">Loading...</p>
          </div>
        </div>
      )}
      
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-gray-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -right-24 w-80 h-80 bg-gray-700/20 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-gray-800 to-black rounded-2xl shadow-lg shadow-black/30">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className={`text-3xl font-bold tracking-tight bg-clip-text text-transparent ${isDarkMode ? 'bg-gradient-to-r from-gray-200 to-white' : 'bg-gradient-to-r from-gray-900 to-gray-800'}`}>
                SudoBot
              </h1>
              <p className="text-sm opacity-60 font-medium">Let the Bot Do the Logic.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-6 px-6 py-3 rounded-2xl backdrop-blur-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10 shadow-sm'}`}>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Time</p>
                <p className="font-mono text-xl font-bold">{formatTime(timer)}</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Left</p>
                <p className="text-xl font-bold">{remainingCells}</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Level</p>
                <p className={`text-sm font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{difficulty || 'Custom'}</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Mistakes</p>
                <p className="text-xl font-bold text-red-400">{mistakes}</p>
              </div>
            </div>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-3 rounded-xl border transition-all hover:scale-110 active:scale-95 ${isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-200 shadow-sm hover:bg-slate-50'}`}
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>
            <div className="relative group">
              <button 
                onClick={() => navigate('/dashboard')}
                className={`w-10 h-10 rounded-full border transition-all hover:scale-110 active:scale-95 flex items-center justify-center text-sm font-bold ${isDarkMode ? 'bg-blue-500/20 border-blue-500/30 hover:bg-blue-500/30 text-blue-300' : 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-600'}`}
                title={userEmail || 'User Dashboard'}
              >
                {userEmail ? userEmail.charAt(0).toUpperCase() : '?'}
              </button>
              <div className={`absolute right-0 mt-2 hidden group-hover:block px-3 py-2 rounded-lg text-xs whitespace-nowrap z-50 ${isDarkMode ? 'bg-gray-800 text-gray-200 border border-gray-700' : 'bg-white text-gray-800 border border-gray-200 shadow-lg'}`}>
                <p className="font-medium">{userEmail}</p>
                <p className="text-[10px] opacity-60 mt-1">Click to view dashboard</p>
              </div>
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Left Column: Grid & Controls */}
          <div className="lg:col-span-7 flex flex-col items-center">
            
            {/* Sudoku Grid */}
            <div 
              className={`relative p-1 rounded-2xl border-4 transition-all duration-500 ${isDarkMode ? 'bg-slate-800/50 border-slate-800 shadow-2xl shadow-black/20' : 'bg-white border-slate-200 shadow-xl'}`}
              onKeyDown={handleKeyDown}
              tabIndex={0}
            >
              <div className="grid grid-cols-9 gap-0.5 bg-slate-700/30 overflow-hidden rounded-lg">
                {grid.map((row, r) => row.map((cell, c) => {
                  const status = getCellStatus(r, c);
                  const isSel = selectedCell?.[0] === r && selectedCell?.[1] === c;
                  const isRel = isRelated(r, c);
                  const isBoxEdgeRight = (c + 1) % 3 === 0 && c < 8;
                  const isBoxEdgeBottom = (r + 1) % 3 === 0 && r < 8;

                  return (
                    <motion.div
                      key={`${r}-${c}`}
                      onClick={() => handleCellClick(r, c)}
                      whileHover={{ scale: 1.05, zIndex: 20 }}
                      whileTap={{ scale: 0.95 }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: (r * 9 + c) * 0.005 }}
                      className={`
                        relative w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center text-xl sm:text-2xl font-bold cursor-pointer transition-all duration-200
                        ${isDarkMode ? 'bg-[#1e293b]' : 'bg-white'}
                        ${isSel ? (isDarkMode ? 'bg-gray-700/40 ring-2 ring-gray-400 z-10' : 'bg-gray-100 ring-2 ring-gray-500 z-10') : ''}
                        ${!isSel && isRel ? (isDarkMode ? 'bg-gray-700/10' : 'bg-gray-50') : ''}
                        ${isBoxEdgeRight ? 'border-r-2 border-slate-500/50' : ''}
                        ${isBoxEdgeBottom ? 'border-b-2 border-slate-500/50' : ''}
                      `}
                    >
                      <span className={`
                        ${status === 'initial' ? (isDarkMode ? 'text-gray-300' : 'text-gray-700') : ''}
                        ${status === 'user' ? (isDarkMode ? 'text-white' : 'text-slate-800') : ''}
                        ${status === 'invalid' ? 'text-red-500 animate-pulse' : ''}
                        ${status === 'solving' ? 'text-green-400' : ''}
                      `}>
                        {cell !== 0 ? cell : ''}
                      </span>
                      
                      {/* Pencil Marks */}
                      {cell === 0 && pencilMarks[r][c].size > 0 && (
                        <div className="absolute inset-0 grid grid-cols-3 p-0.5 pointer-events-none">
                          {[1,2,3,4,5,6,7,8,9].map(n => (
                            <span key={n} className="text-[8px] sm:text-[10px] leading-none opacity-40 flex items-center justify-center">
                              {pencilMarks[r][c].has(n) ? n : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                }))}
              </div>
            </div>

            {/* Number Pad */}
            <div className="mt-8 grid grid-cols-11 gap-2 w-full max-w-md">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  onClick={() => selectedCell && updateCell(selectedCell[0], selectedCell[1], num)}
                  className={`h-12 rounded-xl font-bold text-lg transition-all active:scale-90 ${isDarkMode ? 'bg-white/5 hover:bg-white/10 border border-white/10' : 'bg-white hover:bg-slate-50 border border-slate-200 shadow-sm'}`}
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => selectedCell && updateCell(selectedCell[0], selectedCell[1], 0)}
                className={`h-12 rounded-xl flex items-center justify-center transition-all active:scale-90 ${isDarkMode ? 'bg-gray-700/50 text-gray-300 border border-gray-600/50 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 border border-gray-300 hover:bg-gray-300'}`}
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                onClick={resetBoard}
                className={`h-12 rounded-xl flex items-center justify-center transition-all active:scale-90 ${isDarkMode ? 'bg-gray-700/50 text-gray-300 border border-gray-600/50 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 border border-gray-300 hover:bg-gray-300'}`}
                title="Restart Game"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>

            {/* Main Controls */}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button 
                onClick={solveInstantly}
                className="px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white rounded-2xl font-bold shadow-lg shadow-black/40 flex items-center gap-2 transition-all hover:-translate-y-1 active:translate-y-0"
              >
                <Zap className="w-5 h-5" /> Solve
              </button>
              <button 
                onClick={watchSolve}
                className={`px-6 py-3 rounded-2xl font-bold border flex items-center gap-2 transition-all hover:-translate-y-1 active:translate-y-0 ${isSolving ? 'bg-gray-700/50 border-gray-600/50 text-gray-300' : (isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-200 shadow-sm hover:bg-slate-50')}`}
              >
                {isSolving ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                {isSolving ? 'Stop' : 'Watch'}
              </button>
              <button 
                onClick={() => setIsPencilMode(!isPencilMode)}
                className={`px-6 py-3 rounded-2xl font-bold border flex items-center gap-2 transition-all hover:-translate-y-1 active:translate-y-0 ${isPencilMode ? 'bg-gray-600/50 border-gray-500/50 text-gray-200' : (isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-200 shadow-sm hover:bg-slate-50')}`}
              >
                <Sparkles className="w-5 h-5" /> Pencil {isPencilMode ? 'ON' : 'OFF'}
              </button>
              <button 
                onClick={giveHint}
                className={`px-6 py-3 rounded-2xl font-bold border flex items-center gap-2 transition-all hover:-translate-y-1 active:translate-y-0 ${isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-200 shadow-sm hover:bg-slate-50'}`}
              >
                <Lightbulb className="w-5 h-5 text-yellow-400" /> Hint
              </button>
            </div>
          </div>

          {/* Right Column: Side Panel */}
          <div className="lg:col-span-5 space-y-8 animate-in fade-in slide-in-from-right-4 duration-1000">
            
            {/* Image Upload Zone */}
            <div 
              onDragOver={e => e.preventDefault()}
              onDrop={onDrop}
              className={`relative group h-64 rounded-3xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-4 overflow-hidden ${isScanning ? 'border-gray-400 bg-gray-500/5' : (isDarkMode ? 'border-white/10 hover:border-gray-500/50 bg-white/5' : 'border-slate-300 hover:border-gray-400 bg-slate-50')}`}
            >
              {isScanning ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-12 h-12 text-gray-400 animate-spin" />
                  <p className="font-bold text-gray-400 animate-pulse">Scanning Puzzle...</p>
                </div>
              ) : uploadedImage ? (
                <>
                  <img src={uploadedImage} alt="Uploaded Sudoku" className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-20 transition-opacity" />
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <ImageIcon className="w-10 h-10 text-gray-400" />
                    <p className="font-bold">Image Loaded</p>
                    <button 
                      onClick={() => setUploadedImage(null)}
                      className="mt-2 text-xs text-red-400 hover:underline"
                    >
                      Remove Image
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-4 bg-gray-500/10 rounded-full group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-gray-500" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-lg">Upload Sudoku Image</p>
                    <p className="text-sm opacity-50">Drag & drop or upload</p>
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </>
              )}
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3"
                >
                  <button 
                    onClick={() => setError(null)}
                    className="mt-0.5 hover:opacity-75 transition-opacity shrink-0"
                  >
                    <X className="w-5 h-5 text-red-500" />
                  </button>
                  <p className="text-sm text-red-400 flex-1">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Generator Card */}
            <div className={`p-6 rounded-3xl border backdrop-blur-xl ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex items-center gap-3 mb-6">
                <Dices className="w-6 h-6 text-gray-400" />
                <h3 className="font-bold text-lg">Generate New</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map(d => (
                  <button
                    key={d}
                    onClick={() => generateNew(d)}
                    className={`py-3 rounded-xl font-bold transition-all active:scale-95 ${difficulty === d ? 'bg-gray-700 text-white shadow-lg shadow-gray-700/40' : (isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200')}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Speed Control */}
            <div className={`p-6 rounded-3xl border backdrop-blur-xl ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Play className="w-5 h-5 text-gray-400" />
                  <h3 className="font-bold">Solve Speed</h3>
                </div>
                <span className="text-xs font-mono opacity-50">{solveSpeed}ms</span>
              </div>
              <input 
                type="range" 
                min="10" 
                max="500" 
                step="10"
                value={solveSpeed}
                onChange={e => setSolveSpeed(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-600/20 rounded-lg appearance-none cursor-pointer accent-gray-600"
              />
              <div className="flex justify-between mt-2 text-[10px] uppercase tracking-widest opacity-40">
                <span>Fast</span>
                <span>Slow</span>
              </div>
            </div>

            {/* History Controls */}
            <div className="flex gap-4">
              <button 
                onClick={undo}
                disabled={history.length === 0}
                className={`flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-30 ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-sm'}`}
              >
                <Undo2 className="w-5 h-5" /> Undo
              </button>
              <button 
                onClick={redo}
                disabled={redoStack.length === 0}
                className={`flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-30 ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200 shadow-sm'}`}
              >
                <Redo2 className="w-5 h-5" /> Redo
              </button>
            </div>

          </div>
        </main>

        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 opacity-50">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Keyboard className="w-4 h-4" />
              <span className="text-xs">Arrows to Navigate</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-mono">1-9</span>
              <span className="text-xs">to Fill</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-mono">DEL</span>
              <span className="text-xs">to Erase</span>
            </div>
          </div>
          <p className="text-xs font-medium">Built with React & Firebase</p>
        </footer>

      </div>

      {/* Celebration Overlay */}
      <AnimatePresence>
        {remainingCells === 0 && !celebrationDismissed && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setCelebrationDismissed(true)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer"
          >
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-gray-800 to-gray-900 p-1 rounded-3xl shadow-2xl relative"
            >
              <button
                onClick={() => setCelebrationDismissed(true)}
                className="absolute -top-3 -right-3 bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white rounded-full p-2 transition-all shadow-lg"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="bg-[#0f0f0f] px-12 py-8 rounded-[22px] text-center">
                <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h2 className="text-4xl font-black mb-2">SOLVED!</h2>
                <p className="text-gray-300 font-mono text-xl">{formatTime(timer)}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
