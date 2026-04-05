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
type SudokuSize = 4 | 6 | 9; // 4x4, 6x6, 9x9 grids

const createEmptyGrid = (size: SudokuSize): Grid => 
  Array(size).fill(null).map(() => Array(size).fill(0));

const EMPTY_GRID: Grid = createEmptyGrid(9);

// --- Sudoku Logic ---

const isValid = (grid: Grid, row: number, col: number, num: number, size: SudokuSize = 9): boolean => {
  // Guard against invalid grid or parameters
  if (!grid || !grid[row] || row < 0 || col < 0 || row >= size || col >= size) return false;
  
  const boxSizeMap: Record<SudokuSize, { rows: number; cols: number }> = { 
    4: { rows: 2, cols: 2 }, 
    6: { rows: 2, cols: 3 }, 
    9: { rows: 3, cols: 3 } 
  };
  const { rows: boxRows, cols: boxCols } = boxSizeMap[size];

  for (let x = 0; x < size; x++) {
    if (grid[row]?.[x] === num || grid[x]?.[col] === num) return false;
  }

  const startRow = row - (row % boxRows);
  const startCol = col - (col % boxCols);
  for (let i = 0; i < boxRows; i++) {
    for (let j = 0; j < boxCols; j++) {
      if (grid[i + startRow]?.[j + startCol] === num) return false;
    }
  }
  return true;
};

const solveSudoku = (grid: Grid, size: SudokuSize = 9): boolean => {
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (grid[row][col] === 0) {
        for (let num = 1; num <= size; num++) {
          if (isValid(grid, row, col, num, size)) {
            grid[row][col] = num;
            if (solveSudoku(grid, size)) return true;
            grid[row][col] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
};

const findEmpty = (grid: Grid, size: SudokuSize = 9): [number, number] | null => {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === 0) return [r, c];
    }
  }
  return null;
};

const validateCompletedGrid = (grid: Grid, size: SudokuSize = 9): boolean => {
  // Guard: Check if grid exists and has correct structure
  if (!grid || grid.length !== size) {
    return false;
  }
  
  for (let r = 0; r < size; r++) {
    if (!grid[r] || grid[r].length !== size) {
      return false;
    }
  }
  
  // Check if grid is completely filled
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!grid[r][c] || grid[r][c] === 0) {
        return false;
      }
    }
  }
  
  // Validate all cells follow sudoku rules
  const boxSizeMap: Record<SudokuSize, { rows: number; cols: number }> = { 
    4: { rows: 2, cols: 2 }, 
    6: { rows: 2, cols: 3 }, 
    9: { rows: 3, cols: 3 } 
  };
  const { rows: boxRows, cols: boxCols } = boxSizeMap[size];
  
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const num = grid[r][c];
      if (num < 1 || num > size) return false;
      
      // Check row for duplicates
      for (let x = 0; x < size; x++) {
        if (x !== c && grid[r][x] === num) return false;  
      }
      
      // Check column for duplicates
      for (let x = 0; x < size; x++) {
        if (x !== r && grid[x][c] === num) return false;
      }
      
      // Check box for duplicates
      const startRow = r - (r % boxRows);
      const startCol = c - (c % boxCols);
      
      for (let i = 0; i < boxRows; i++) {
        for (let j = 0; j < boxCols; j++) {
          const checkR = i + startRow;
          const checkC = j + startCol;
          if (checkR >= 0 && checkR < size && checkC >= 0 && checkC < size) {
            if ((checkR !== r || checkC !== c) && grid[checkR][checkC] === num) {
              return false;
            }
          }
        }
      }
    }
  }
  return true;
};

const generatePuzzle = (difficulty: Difficulty, size: SudokuSize): { puzzle: Grid; solution: Grid } => {
  const boxSizeMap: Record<SudokuSize, { rows: number; cols: number }> = { 
    4: { rows: 2, cols: 2 }, 
    6: { rows: 2, cols: 3 }, 
    9: { rows: 3, cols: 3 } 
  };
  const { rows: boxRows, cols: boxCols } = boxSizeMap[size];
  const solution: Grid = Array(size).fill(null).map(() => Array(size).fill(0));
  
  // Fill diagonal boxes first for randomness
  const step = Math.max(boxRows, boxCols);
  for (let boxRow = 0; boxRow < size; boxRow += boxRows) {
    for (let boxCol = 0; boxCol < size; boxCol += boxCols) {
      if (Math.floor(boxRow / boxRows) === Math.floor(boxCol / boxCols)) { // Diagonal boxes only
        const nums = Array.from({ length: size }, (_, idx) => idx + 1).sort(() => Math.random() - 0.5);
        let idx = 0;
        for (let r = 0; r < boxRows; r++) {
          for (let c = 0; c < boxCols; c++) {
            if (boxRow + r < size && boxCol + c < size) {
              solution[boxRow + r][boxCol + c] = nums[idx++];
            }
          }
        }
      }
    }
  }
  
  solveSudoku(solution, size);
  
  const puzzle = solution.map((row: number[]) => [...row]);
  const attemptsMap: Record<Difficulty, Record<SudokuSize, number>> = {
    Easy: { 4: 4, 6: 10, 9: 30 },
    Medium: { 4: 6, 6: 15, 9: 45 },
    Hard: { 4: 8, 6: 20, 9: 60 }
  };
  const attempts = attemptsMap[difficulty][size];
  
  let count = 0;
  while (count < attempts) {
    const r = Math.floor(Math.random() * size);
    const c = Math.floor(Math.random() * size);
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
  
  // Helper: Get saved sudoku size from localStorage
  const getSavedSudokuSize = (): SudokuSize => {
    const saved = localStorage.getItem('sudoku-size');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if ([4, 6, 9].includes(parsed)) {
        return parsed as SudokuSize;
      }
    }
    return 9;
  };

  const savedSize = getSavedSudokuSize();

  // State - Initialize with correct sudokuSize from localStorage
  const [sudokuSize, setSudokuSize] = useState<SudokuSize>(savedSize);
  const [grid, setGrid] = useState<Grid>(() => createEmptyGrid(savedSize));
  const [initialGrid, setInitialGrid] = useState<Grid>(() => createEmptyGrid(savedSize));
  const [solution, setSolution] = useState<Grid | null>(null);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [history, setHistory] = useState<Grid[]>([]);
  const [redoStack, setRedoStack] = useState<Grid[]>([]);
  const [isPencilMode, setIsPencilMode] = useState(false);
  const [pencilMarks, setPencilMarks] = useState<Set<number>[][]>(() =>
    Array(savedSize).fill(null).map(() => Array(savedSize).fill(null).map(() => new Set()))
  );
  const [isSolving, setIsSolving] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [solveSpeed, setSolveSpeed] = useState(50);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [timer, setTimer] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme-mode');
    return saved ? saved === 'dark' : true;
  });
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
  const activeSolveSizeRef = useRef<SudokuSize | null>(null);
  const prevSizeRef = useRef<SudokuSize | undefined>(undefined);

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

  // Save theme mode and sync across tabs/pages
  useEffect(() => {
    localStorage.setItem('theme-mode', isDarkMode ? 'dark' : 'light');
    // Dispatch custom event for same-window listeners
    window.dispatchEvent(new CustomEvent('themeChange', { detail: { isDarkMode } }));
  }, [isDarkMode]);

  // Load saved game state from localStorage (only once on mount)
  useEffect(() => {
    const saved = localStorage.getItem('sudoku-state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Only restore if the saved size matches current size
        if (parsed.sudokuSize && parsed.sudokuSize === sudokuSize) {
          setGrid(parsed.grid);
          setInitialGrid(parsed.initialGrid);
          setTimer(parsed.timer);
          setDifficulty(parsed.difficulty);
          if (parsed.pencilMarks) {
            setPencilMarks(parsed.pencilMarks.map((row: any[]) => row.map((cell: any) => new Set(cell))));
          }
        } else {
          console.warn(`Size mismatch: saved ${parsed.sudokuSize} vs current ${sudokuSize}`);
        }
      } catch (e) {
        console.error("Failed to load saved state", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sudoku-state', JSON.stringify({ grid, initialGrid, timer, difficulty, sudokuSize, pencilMarks: Array.from(pencilMarks, row => row.map(cell => Array.from(cell))) }));
  }, [grid, initialGrid, timer, difficulty, sudokuSize, pencilMarks]);

  useEffect(() => {
    if (isTimerActive) {
      timerRef.current = setInterval(() => {
        setTimer((t: number) => t + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTimerActive]);

  // Handle grid size changes (only when size actually changes, not on initial mount)
  useEffect(() => {
    if (sudokuSize === 4 || sudokuSize === 6 || sudokuSize === 9) {
      // Skip on initial mount (when prevSizeRef is still undefined)
      if (prevSizeRef.current === undefined) {
        prevSizeRef.current = sudokuSize;
        return;
      }
      
      // Only process if size actually changed from before
      const oldSize = prevSizeRef.current;
      if (sudokuSize === oldSize) return;
      
      prevSizeRef.current = sudokuSize;
      
      // Stop any active solving immediately
      solveAbortRef.current = true;
      activeSolveSizeRef.current = null;
      
      // Clear the saved state so no old data interferes
      localStorage.removeItem('sudoku-state');
      localStorage.setItem('sudoku-size', sudokuSize.toString());
      
      // Create empty grid with correct dimensions
      const emptyGrid: Grid = createEmptyGrid(sudokuSize);
      
      setGrid(emptyGrid);
      setInitialGrid(emptyGrid);
      setSolution(null);
      setHistory([]);
      setRedoStack([]);
      setPencilMarks(Array(sudokuSize).fill(null).map(() => Array(sudokuSize).fill(null).map(() => new Set())));
      setSelectedCell(null);
      setTimer(0);
      setIsTimerActive(false);
      setIsSolving(false);
      setIsPaused(false);
      setDifficulty(null);
      setMistakes(0);
      setError(null);
      setUploadedImage(null);
      setCelebrationDismissed(false);
      setGameCompleted(false);
    }
  }, [sudokuSize]);

  // --- Handlers ---

  const handleCellClick = (r: number, c: number) => {
    if (isSolving) return;
    setSelectedCell([r, c]);
    if (!isTimerActive && grid.some((row: number[]) => row.some((cell: number) => cell !== 0))) {
      setIsTimerActive(true);
    }
  };

  const updateCell = useCallback((r: number, c: number, val: number) => {
    if (initialGrid[r][c] !== 0) return;
    
    if (isPencilMode && val !== 0) {
      const newMarks = [...pencilMarks.map((row: Set<number>[]) => row.map((cell: Set<number>) => new Set(cell)))];
      if (newMarks[r][c].has(val)) {
        newMarks[r][c].delete(val);
      } else {
        newMarks[r][c].add(val);
      }
      setPencilMarks(newMarks);
      return;
    }

    // Check if the entered number is invalid
    if (val !== 0 && !isValid(grid, r, c, val, sudokuSize)) {
      setMistakes((prev: number) => prev + 1);
    }

    setHistory((prev: Grid[]) => [...prev, grid.map((row: number[]) => [...row])]);
    setRedoStack([]);
    
    const newGrid = grid.map((row: number[], ri: number) => 
      row.map((cell: number, ci: number) => (ri === r && ci === c ? val : cell))
    );
    setGrid(newGrid);

    // Check if solved using comprehensive validation
    if (validateCompletedGrid(newGrid, sudokuSize)) {
      console.log(`✅ Grid solved! Size: ${sudokuSize}×${sudokuSize}, Timer: ${timer}s, Mistakes: ${mistakes}`);
      console.log('Grid state after validation passed:', newGrid);
      setIsTimerActive(false);
      setGameCompleted(true);
      
      // Save stats to Firestore if user is logged in
      if (userId) {
        updateUserStats(userId, timer, true, mistakes);
      }
    } else {
      const filledCount = newGrid.flat().filter((c: number) => c !== 0).length;
      const totalCells = sudokuSize * sudokuSize;
      if (filledCount === totalCells) {
        console.warn(`⚠️ Grid fully filled (${filledCount}/${totalCells}) but validation failed for size ${sudokuSize}×${sudokuSize}`);
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
    setRedoStack((prevRedo: Grid[]) => [grid.map((row: number[]) => [...row]), ...prevRedo]);
    setGrid(prev);
    setHistory((prevHistory: Grid[]) => prevHistory.slice(0, -1));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setHistory((prevHistory: Grid[]) => [...prevHistory, grid.map((row: number[]) => [...row])]);
    setGrid(next);
    setRedoStack((prevRedo: Grid[]) => prevRedo.slice(1));
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
    const { puzzle, solution: sol } = generatePuzzle(diff, sudokuSize);
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
    // Make a deep copy to avoid modifying the current grid
    const workingGrid = grid.map((row: number[]) => [...row]);
    
    // Validate that the puzzle can actually be solved
    if (workingGrid.every((row: number[], ri: number) => 
      row.every((cell: number, ci: number) => {
        if (cell === 0) return true;
        const temp = workingGrid[ri][ci];
        workingGrid[ri][ci] = 0;
        const v = isValid(workingGrid, ri, ci, temp, sudokuSize);
        workingGrid[ri][ci] = temp;
        return v;
      })
    )) {
      // Current state is valid, now try to solve
      const solveGrid = workingGrid.map((r: number[]) => [...r]);
      if (solveSudoku(solveGrid, sudokuSize)) {
        setGrid(solveGrid);
        setTimer(0);
        setIsTimerActive(false);
      } else {
        setError("This puzzle is unsolvable!");
      }
    } else {
      setError("Current board state has conflicts. Fix the conflicts before solving.");
    }
  };

  const watchSolve = useCallback(async () => {
    if (isSolving) {
      solveAbortRef.current = true;
      activeSolveSizeRef.current = null;
      setIsSolving(false);
      return;
    }

    setTimer(0);
    setIsTimerActive(true);
    setIsSolving(true);
    solveAbortRef.current = false;
    activeSolveSizeRef.current = sudokuSize; // Track which size this solve is for
    const workingGrid = grid.map(row => [...row]);
    const initialSize = sudokuSize; // Capture size at solve start
    
    const step = async (g: Grid): Promise<boolean> => {
      // Stop if size changed or abort requested
      if (solveAbortRef.current || activeSolveSizeRef.current !== initialSize) return false;
      
      const empty = findEmpty(g, initialSize);
      if (!empty) return true;
      
      const [r, c] = empty;
      for (let num = 1; num <= initialSize; num++) {
        if (solveAbortRef.current || activeSolveSizeRef.current !== initialSize) return false;
        
        if (isValid(g, r, c, num, initialSize)) {
          g[r][c] = num;
          // Only update UI if size hasn't changed
          if (activeSolveSizeRef.current === initialSize) {
            setGrid(g.map(row => [...row]));
          }
          
          // Delay
          await new Promise(resolve => setTimeout(resolve, solveSpeed));
          
          while (isPaused && !solveAbortRef.current && activeSolveSizeRef.current === initialSize) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          if (await step(g)) return true;
          g[r][c] = 0;
          // Only update UI if size hasn't changed
          if (activeSolveSizeRef.current === initialSize) {
            setGrid(g.map(row => [...row]));
          }
        }
      }
      return false;
    };

    try {
      const solved = await step(workingGrid);
      // Only update UI if size is still the same
      if (activeSolveSizeRef.current === initialSize) {
        if (solved) {
          setIsTimerActive(false);
        } else if (!solveAbortRef.current) {
          setError("Unsolvable puzzle!");
        }
      }
    } catch (err) {
      console.error('Solve error:', err);
      if (activeSolveSizeRef.current === initialSize) {
        setError('An error occurred while solving');
      }
    } finally {
      if (activeSolveSizeRef.current === initialSize) {
        setIsSolving(false);
      }
      activeSolveSizeRef.current = null;
    }
  }, [isSolving, grid, sudokuSize, solveSpeed, isPaused]);

  const giveHint = () => {
    const workingGrid = grid.map((row: number[]) => [...row]);
    const sol = workingGrid.map((r: number[]) => [...r]);
    
    // Validate current grid state
    const isValid_current = workingGrid.every((row: number[], ri: number) => 
      row.every((cell: number, ci: number) => {
        if (cell === 0) return true;
        const temp = workingGrid[ri][ci];
        workingGrid[ri][ci] = 0;
        const v = isValid(workingGrid, ri, ci, temp, sudokuSize);
        workingGrid[ri][ci] = temp;
        return v;
      })
    );

    if (!isValid_current) {
      setError("Current board state has conflicts. Fix them before getting a hint.");
      return;
    }

    if (solveSudoku(sol, sudokuSize)) {
      const emptyCells: [number, number][] = [];
      grid.forEach((row: number[], r: number) => row.forEach((cell: number, c: number) => {
        if (cell === 0) emptyCells.push([r, c]);
      }));
      
      if (emptyCells.length > 0) {
        const [r, c] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        updateCell(r, c, sol[r][c]);
      } else {
        setError("Puzzle is already complete!");
      }
    } else {
      setError("Cannot provide hint for unsolvable puzzle.");
    }
  };

  const validateBoard = () => {
    const isAllValid = grid.every((row: number[], ri: number) => 
      row.every((cell: number, ci: number) => {
        if (cell === 0) return true;
        const temp = grid[ri][ci];
        grid[ri][ci] = 0;
        const v = isValid(grid, ri, ci, temp, sudokuSize);
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

  // Preprocess image for better OCR: enhance contrast and reduce noise
  const preprocessImageForOCR = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Calculate histogram for contrast stretching
    const histogram = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
      histogram[gray]++;
    }

    // Find min/max for stretching (ignore extreme outliers)
    let minBrightness = 0, maxBrightness = 255;
    let pixelCount = 0;
    for (let i = 0; i < 256; i++) {
      if (histogram[i] > 0) {
        if (pixelCount === 0) minBrightness = i;
        maxBrightness = i;
        pixelCount += histogram[i];
      }
    }

    // Apply contrast stretching (more aggressive)
    const range = Math.max(1, maxBrightness - minBrightness);
    const stretchedData = new Uint8ClampedArray(data.length);
    
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      // Stretch to full 0-255 range
      const stretched = ((gray - minBrightness) / range) * 255;
      // Use adaptive threshold (median of stretched image)
      const threshold = stretched > 180 ? 255 : 0;
      stretchedData[i] = stretchedData[i+1] = stretchedData[i+2] = threshold;
      stretchedData[i+3] = data[i+3]; // Preserve alpha
    }

    ctx.putImageData(new ImageData(stretchedData, canvas.width, canvas.height), 0, 0);
    return canvas;
  };

  // Detect grid lines and extract Sudoku cells
  const detectGridAndExtractCells = (imageSrc: string, gridSize: SudokuSize = 9): Promise<{ cellImages: string[][]; detectedSize: SudokuSize }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const timeout = setTimeout(() => reject(new Error("Grid detection timeout")), 15000);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          // Step 1: Resize image if too large (improves performance)
          const maxDim = 2000;
          let canvas = document.createElement('canvas');
          if (img.width > maxDim || img.height > maxDim) {
            const scale = Math.min(maxDim / img.width, maxDim / img.height);
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
          } else {
            canvas.width = img.width;
            canvas.height = img.height;
          }
          
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Step 2: Convert to grayscale
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          const gray = new Uint8ClampedArray(canvas.width * canvas.height);

          for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          }

          // Step 3: Apply Sobel edge detection with adaptive threshold
          const edges = new Uint8ClampedArray(canvas.width * canvas.height);
          let maxEdge = 0;
          
          for (let y = 1; y < canvas.height - 1; y++) {
            for (let x = 1; x < canvas.width - 1; x++) {
              const idx = y * canvas.width + x;
              const gx = -gray[(y-1)*canvas.width+(x-1)] - 2*gray[y*canvas.width+(x-1)] - gray[(y+1)*canvas.width+(x-1)]
                       + gray[(y-1)*canvas.width+(x+1)] + 2*gray[y*canvas.width+(x+1)] + gray[(y+1)*canvas.width+(x+1)];
              const gy = -gray[(y-1)*canvas.width+(x-1)] - 2*gray[(y-1)*canvas.width+x] - gray[(y-1)*canvas.width+(x+1)]
                       + gray[(y+1)*canvas.width+(x-1)] + 2*gray[(y+1)*canvas.width+x] + gray[(y+1)*canvas.width+(x+1)];
              edges[idx] = Math.sqrt(gx*gx + gy*gy);
              if (edges[idx] > maxEdge) maxEdge = edges[idx];
            }
          }

          // Adaptive threshold (50% of max detected edge)
          const edgeThreshold = Math.max(20, maxEdge * 0.3);

          // Step 4: Find horizontal and vertical lines with improved detection
          const hLines: number[] = [];
          const vLines: number[] = [];

          // Find horizontal lines
          for (let y = 0; y < canvas.height; y++) {
            let lineStrength = 0;
            for (let x = 0; x < canvas.width; x++) {
              if (edges[y * canvas.width + x] > edgeThreshold) lineStrength++;
            }
            if (lineStrength > canvas.width * 0.5) hLines.push(y);
          }

          // Find vertical lines
          for (let x = 0; x < canvas.width; x++) {
            let lineStrength = 0;
            for (let y = 0; y < canvas.height; y++) {
              if (edges[y * canvas.width + x] > edgeThreshold) lineStrength++;
            }
            if (lineStrength > canvas.height * 0.5) vLines.push(x);
          }

          // Step 5: Cluster lines with adaptive spacing based on image size
          const adaptiveSpacing = Math.max(canvas.height / 30, canvas.width / 30);
          
          const clusterLines = (lines: number[], spacing: number): number[] => {
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

          const hClusteredLines = clusterLines(hLines, adaptiveSpacing);
          const vClusteredLines = clusterLines(vLines, adaptiveSpacing);

          console.log('Horizontal lines found:', hClusteredLines.length);
          console.log('Vertical lines found:', vClusteredLines.length);

          // Auto-detect grid size from number of lines
          let detectedSize: SudokuSize = gridSize;
          const lineCount = Math.max(hClusteredLines.length, vClusteredLines.length);
          if (lineCount >= 9 && lineCount <= 11) {
            detectedSize = 9;
          } else if (lineCount >= 6 && lineCount <= 8) {
            detectedSize = 6;
          } else if (lineCount >= 4 && lineCount <= 6) {
            detectedSize = 4;
          }
          console.log('Detected grid size:', detectedSize);

          const gridLines = detectedSize + 1; // 4x4 needs 5 lines, 6x6 needs 7 lines, 9x9 needs 10 lines
          const gridDivisions = detectedSize;
          
          // If we can't find grid, use fallback division
          let rowBoundaries: number[];
          let colBoundaries: number[];
          
          if (hClusteredLines.length >= gridLines) {
            // Use detected lines, ensure we have exactly gridLines
            rowBoundaries = hClusteredLines.slice(0, gridLines);
          } else {
            // Fallback: divide uniformly
            rowBoundaries = Array.from({length: gridLines}, (_, i) => Math.round(i * canvas.height / gridDivisions));
          }
          
          if (vClusteredLines.length >= gridLines) {
            colBoundaries = vClusteredLines.slice(0, gridLines);
          } else {
            colBoundaries = Array.from({length: gridLines}, (_, i) => Math.round(i * canvas.width / gridDivisions));
          }

          // Ensure boundaries are sorted
          rowBoundaries = rowBoundaries.sort((a, b) => a - b);
          colBoundaries = colBoundaries.sort((a, b) => a - b);

          // Step 6: Extract and preprocess cell images (size x size grid)
          const cellImages: string[][] = [];
          for (let row = 0; row < detectedSize; row++) {
            const cellRow: string[] = [];
            const y1 = Math.max(0, rowBoundaries[row]);
            const y2 = Math.min(canvas.height, rowBoundaries[row + 1] || canvas.height);

            for (let col = 0; col < detectedSize; col++) {
              const x1 = Math.max(0, colBoundaries[col]);
              const x2 = Math.min(canvas.width, colBoundaries[col + 1] || canvas.width);

              // Extract cell
              const cellCanvas = document.createElement('canvas');
              cellCanvas.width = Math.max(1, x2 - x1);
              cellCanvas.height = Math.max(1, y2 - y1);
              const cellCtx = cellCanvas.getContext('2d')!;
              cellCtx.drawImage(canvas, x1, y1, x2 - x1, y2 - y1, 0, 0, cellCanvas.width, cellCanvas.height);

              // Preprocess cell for OCR
              preprocessImageForOCR(cellCanvas);
              
              cellRow.push(cellCanvas.toDataURL());
            }
            cellImages.push(cellRow);
          }

          resolve({ cellImages, detectedSize });
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

  // Extract number from individual cell with better OCR
  const extractNumberFromCell = async (cellImage: string): Promise<number> => {
    try {
      const { data: { text } } = await Tesseract.recognize(
        cellImage,
        'eng',
        { logger: () => {} } // Silent
      );
      
      // Extract first digit (1-9) found, ignore 0 and other characters
      const match = text.match(/[1-9]/);
      const num = match ? parseInt(match[0]) : 0;
      return num >= 1 && num <= 9 ? num : 0;
    } catch (err) {
      console.error('OCR error:', err);
      return 0;
    }
  };

  // Validate puzzle solvability and uniqueness
  const validatePuzzle = (puzzle: Grid, size: SudokuSize = sudokuSize): { valid: boolean; message: string } => {
    const cellsFilled = puzzle.flat().filter((n: number) => n !== 0).length;
    const minCluesMap: Record<SudokuSize, number> = { 4: 3, 6: 6, 9: 8 };
    const minClues = minCluesMap[size];
    
    if (cellsFilled < minClues) {
      return { 
        valid: false, 
        message: `Only found ${cellsFilled} numbers. Please provide at least ${minClues} starting numbers.` 
      };
    }

    // Check if current state is valid (no conflicting numbers)
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (puzzle[r][c] !== 0) {
          const temp = puzzle[r][c];
          puzzle[r][c] = 0;
          if (!isValid(puzzle, r, c, temp, size)) {
            puzzle[r][c] = temp;
            return { valid: false, message: 'Puzzle has conflicting clues!' };
          }
          puzzle[r][c] = temp;
        }
      }
    }

    // Try to solve to verify solvability
    const testGrid = puzzle.map((row: number[]) => [...row]);
    if (!solveSudoku(testGrid, size)) {
      return { valid: false, message: 'Puzzle appears to be unsolvable.' };
    }

    return { valid: true, message: 'Puzzle validated successfully!' };
  };

  const handleImageUpload = async (file: File) => {
    setIsScanning(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setUploadedImage(base64);
      
      try {
        // Step 1: Detect grid and extract cell images (auto-detects grid size)
        console.log('Starting grid detection...');
        const { cellImages, detectedSize } = await detectGridAndExtractCells(base64, sudokuSize);
        console.log('Grid detected. Size:', detectedSize, 'Extracted cells:', cellImages.length + 'x' + (cellImages[0]?.length || 0));

        // Switch to detected size if different
        if (detectedSize !== sudokuSize) {
          console.log('Switching grid size from', sudokuSize, 'to', detectedSize);
          setSudokuSize(detectedSize);
        }

        // Step 2: OCR each cell individually
        const grid: Grid = [];
        let cellsFilled = 0;
        
        for (let row = 0; row < detectedSize; row++) {
          const gridRow: number[] = [];
          for (let col = 0; col < detectedSize; col++) {
            const num = await extractNumberFromCell(cellImages[row][col]);
            gridRow.push(num);
            if (num !== 0) cellsFilled++;
          }
          grid.push(gridRow);
        }

        console.log('OCR complete. Cells filled:', cellsFilled);
        console.log('Grid:', grid);

        // Step 3: Validate the extracted puzzle (using detected size, not state)
        const validation = validatePuzzle(grid, detectedSize);
        if (!validation.valid) {
          throw new Error(validation.message);
        }

        // Success - load the puzzle
        setGrid(grid);
        setInitialGrid(grid);
        setTimer(0);
        setIsTimerActive(true);
        setDifficulty(null);
        setMistakes(0);
        setError(null);
        console.log('Puzzle loaded successfully! ✓');
      } catch (err: any) {
        console.error('Image processing error:', err);
        setError(err.message || "Failed to scan Sudoku. Try a clearer photo with visible grid lines and all numbers clearly visible.");
        setUploadedImage(null);
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
    // Guard against out-of-bounds access
    if (r < 0 || c < 0 || r >= sudokuSize || c >= sudokuSize || !grid[r]) return 'empty';
    
    const val = grid[r][c];
    if (val === 0) return 'empty';
    if (initialGrid[r] && initialGrid[r][c] !== 0) return 'initial';
    
    // Check validity
    const temp = grid[r][c];
    grid[r][c] = 0;
    const valid = isValid(grid, r, c, temp, sudokuSize);
    grid[r][c] = temp;
    
    if (!valid) return 'invalid';
    if (isSolving) return 'solving';
    return 'user';
  };

  const isRelated = (r: number, c: number) => {
    if (!selectedCell) return false;
    const [sr, sc] = selectedCell;
    if (r === sr && c === sc) return false;
    
    const boxSizeMap: Record<SudokuSize, { rows: number; cols: number }> = { 
      4: { rows: 2, cols: 2 }, 
      6: { rows: 2, cols: 3 }, 
      9: { rows: 3, cols: 3 } 
    };
    const { rows: boxRows, cols: boxCols } = boxSizeMap[sudokuSize];
    
    return r === sr || c === sc || (Math.floor(r / boxRows) === Math.floor(sr / boxRows) && Math.floor(c / boxCols) === Math.floor(sc / boxCols));
  };

  const remainingCells = useMemo(() => {
    return grid.flat().filter((c: number) => c === 0).length;
  }, [grid]);

  // Trigger confetti and stop timer when puzzle is solved
  useEffect(() => {
    if (gameCompleted) {
      console.log(`🟢 Game completed triggered. Remaining cells: ${remainingCells}, Grid fully filled: ${remainingCells === 0}`);
      
      if (remainingCells === 0) {
        console.log('🎉 All cells filled! Triggering celebration...');
        setIsTimerActive(false);
        setCelebrationDismissed(false);
        
        // Trigger confetti
        confetti({
          particleCount: 200,
          spread: 90,
          origin: { y: 0.5 },
          colors: ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa']
        });
      } else {
        console.warn(`⚠️ Game marked complete but ${remainingCells} cells still empty!`);
      }
    }
  }, [gameCompleted, remainingCells]);

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
            {/* Size Selector - Before Time */}
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10 shadow-sm'}`}>
              <label className="text-[10px] uppercase tracking-widest opacity-60 font-semibold whitespace-nowrap">Sudoku Size</label>
              <select
                value={sudokuSize}
                onChange={(e) => setSudokuSize(parseInt(e.target.value) as SudokuSize)}
                className={`px-3 py-2 rounded-lg border font-bold transition-all appearance-none cursor-pointer ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white hover:bg-slate-800 shadow-lg' : 'bg-white border-slate-300 text-slate-900 hover:bg-slate-50 shadow-md'}`}
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${isDarkMode ? 'white' : 'black'}' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.5rem center',
                  backgroundSize: '1.5em 1.5em',
                  paddingRight: '2.5rem'
                }}
              >
                <option value={4} style={{ backgroundColor: isDarkMode ? '#1e293b' : 'white', color: isDarkMode ? 'white' : 'black' }}>4×4</option>
                <option value={6} style={{ backgroundColor: isDarkMode ? '#1e293b' : 'white', color: isDarkMode ? 'white' : 'black' }}>6×6</option>
                <option value={9} style={{ backgroundColor: isDarkMode ? '#1e293b' : 'white', color: isDarkMode ? 'white' : 'black' }}>9×9</option>
              </select>
            </div>

            {/* Stats */}
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
            <motion.div
              key={`grid-${sudokuSize}`}
              initial={{ opacity: 0, scale: 0.95, rotateX: -20 }}
              animate={{ opacity: 1, scale: 1, rotateX: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut', type: 'spring', bounce: 0.3 }}
              className={`relative p-1 rounded-2xl border-4 transition-all duration-500 ${isDarkMode ? 'bg-slate-800/50 border-slate-800 shadow-2xl shadow-black/20' : 'bg-white border-slate-200 shadow-xl'}`}
              onKeyDown={handleKeyDown}
              tabIndex={0}
            >
              <motion.div 
                layout
                className={`grid gap-0.5 bg-slate-700/30 overflow-hidden rounded-lg`}
                style={{ gridTemplateColumns: `repeat(${sudokuSize}, minmax(0, 1fr))` }}
                transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
              >
                {grid.map((row, r) => row.map((cell, c) => {
                  const status = getCellStatus(r, c);
                  const isSel = selectedCell?.[0] === r && selectedCell?.[1] === c;
                  const isRel = isRelated(r, c);
                  const boxSizeMap: Record<SudokuSize, { rows: number; cols: number }> = { 
                    4: { rows: 2, cols: 2 }, 
                    6: { rows: 2, cols: 3 }, 
                    9: { rows: 3, cols: 3 } 
                  };
                  const { rows: boxRows, cols: boxCols } = boxSizeMap[sudokuSize];
                  const isBoxEdgeRight = (c + 1) % boxCols === 0 && c < sudokuSize - 1;
                  const isBoxEdgeBottom = (r + 1) % boxRows === 0 && r < sudokuSize - 1;

                  return (
                    <motion.div
                      key={`${r}-${c}`}
                      onClick={() => handleCellClick(r, c)}
                      whileHover={{ scale: 1.08, zIndex: 20, boxShadow: '0 0 20px rgba(255,255,255,0.1)' }}
                      whileTap={{ scale: 0.92 }}
                      initial={{ opacity: 0, scale: 0.6, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: (r * sudokuSize + c) * 0.01, duration: 0.4, type: 'spring', stiffness: 300, damping: 20 }}
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
                        <div 
                          className="absolute inset-0 grid p-0.5 pointer-events-none"
                          style={{ gridTemplateColumns: `repeat(${sudokuSize === 4 ? 2 : sudokuSize === 6 ? 3 : 3}, minmax(0, 1fr))` }}
                        >
                          {Array.from({ length: sudokuSize }, (_, i) => i + 1).map(n => (
                            <span key={n} className="text-[8px] sm:text-[10px] leading-none opacity-40 flex items-center justify-center">
                              {pencilMarks[r][c].has(n) ? n : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                }))}
              </motion.div>
            </motion.div>

            {/* Number Pad */}
            <div className="mt-8 grid gap-2 w-full max-w-md" style={{ gridTemplateColumns: `repeat(${sudokuSize + 2}, minmax(0, 1fr))` }}>
              {Array.from({ length: sudokuSize }, (_, i) => i + 1).map((num: number) => (
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
        </footer>

      </div>

      {/* Celebration Overlay */}
      <AnimatePresence>
        {remainingCells === 0 && gameCompleted && !celebrationDismissed && (
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
