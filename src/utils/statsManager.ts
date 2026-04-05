import { db } from '../firebase';
import { doc, setDoc, getDoc, updateDoc, increment, collection, query, where, getDocs } from 'firebase/firestore';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export interface UserStats {
  rating: number;
  totalGames: number;
  bestTime: number;
  winRate: number;
  currentStreak: number;
  accuracy: number;
  avgTime: number;
  bestStreak: number;
  lastPlayedDate?: string;
}

export interface UserProfile {
  name?: string;
  description?: string;
  photoURL?: string;
}

export interface GameRecord {
  date: string; // ISO date string (YYYY-MM-DD)
  gameTime: number;
  isSolved: boolean;
  mistakes: number;
  ratingChange: number;
  timestamp: string; // ISO timestamp
}

export interface RatingHistory {
  date: string;
  rating: number;
}

// Initialize default stats for a new user (only if they don't exist)
export const initializeUserStats = async (uid: string, email: string) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    // If user already has stats, don't overwrite them!
    if (userDoc.exists() && userDoc.data().stats && userDoc.data().stats.totalGames > 0) {
      console.log('✅ Stats already exist for user, skipping initialization');
      return;
    }

    const defaultStats: UserStats = {
      rating: 1600,
      totalGames: 0,
      bestTime: 999,
      winRate: 0,
      currentStreak: 0,
      accuracy: 0,
      avgTime: 0,
      bestStreak: 0,
      lastPlayedDate: new Date(0).toISOString() // Set to epoch so first game triggers streak
    };

    const data = {
      email,
      stats: defaultStats,
      createdAt: new Date().toISOString()
    };

    await setDoc(userRef, data, { merge: true });
    console.log('✅ User stats initialized');
    
    // Also cache locally
    localStorage.setItem(`user-stats-${uid}`, JSON.stringify(defaultStats));
  } catch (error: any) {
    console.error('Error initializing user stats:', error);
    
    // Cache locally even if Firestore fails
    const defaultStats: UserStats = {
      rating: 1600,
      totalGames: 0,
      bestTime: 999,
      winRate: 0,
      currentStreak: 0,
      accuracy: 0,
      avgTime: 0,
      bestStreak: 0,
      lastPlayedDate: new Date(0).toISOString()
    };
    localStorage.setItem(`user-stats-${uid}`, JSON.stringify(defaultStats));
  }
};

// Update user stats after completing a game
export const updateUserStats = async (
  uid: string,
  gameTime: number,
  isSolved: boolean,
  mistakes: number,
  totalCells: number = 81
) => {
  try {
    console.log('🎯 Starting updateUserStats for uid:', uid);
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      console.log('⚠️ User doc does not exist, initializing...');
      await initializeUserStats(uid, '');
      return;
    }

    const currentData = userDoc.data();
    console.log('📖 Current Firestore data:', currentData);
    
    const currentStats: UserStats = currentData.stats || {
      rating: 1600,
      totalGames: 0,
      bestTime: 999,
      winRate: 0,
      currentStreak: 0,
      accuracy: 0,
      avgTime: 0,
      bestStreak: 0
    };

    // Calculate new stats
    const newTotalGames = currentStats.totalGames + 1;
    const newBestTime = Math.min(currentStats.bestTime, gameTime);
    const accuracy = isSolved ? ((totalCells - mistakes) / totalCells) * 100 : 0;
    const newAvgTime = Math.floor(
      (currentStats.avgTime * currentStats.totalGames + gameTime) / newTotalGames
    );
    
    let newWinRate = 0;
    if (isSolved) {
      const newWins = Math.floor(currentStats.winRate / 100 * currentStats.totalGames) + 1;
      newWinRate = (newWins / newTotalGames) * 100;
    } else {
      const newWins = Math.floor(currentStats.winRate / 100 * currentStats.totalGames);
      newWinRate = (newWins / newTotalGames) * 100;
    }

    // Update rating based on performance
    let ratingChange = 0;
    if (isSolved) {
      ratingChange = Math.max(1, Math.floor((600 - gameTime) / 60)); // More points for faster solves
      ratingChange -= mistakes * 10; // Deduct points for mistakes
    } else {
      ratingChange = -20; // Penalty for unsolved
    }

    const newRating = Math.max(1000, currentStats.rating + ratingChange);

    // Update streak
    const lastPlayed = currentData.stats?.lastPlayedDate;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const lastPlayedDate = lastPlayed ? new Date(lastPlayed).toDateString() : null;

    let newCurrentStreak = currentStats.currentStreak;
    let newBestStreak = currentStats.bestStreak;

    if (isSolved) {
      if (lastPlayedDate === yesterday) {
        newCurrentStreak = currentStats.currentStreak + 1;
      } else if (lastPlayedDate !== today) {
        newCurrentStreak = 1;
      }
      newBestStreak = Math.max(newBestStreak, newCurrentStreak);
    } else if (lastPlayedDate !== today) {
      newCurrentStreak = 0;
    }

    // Update Firestore
    const updatedStats: UserStats = {
      rating: newRating,
      totalGames: newTotalGames,
      bestTime: newBestTime,
      winRate: newWinRate,
      currentStreak: newCurrentStreak,
      accuracy,
      avgTime: newAvgTime,
      bestStreak: newBestStreak,
      lastPlayedDate: new Date().toISOString()
    };

    console.log('📝 Calculated updated stats:', updatedStats);
    
    try {
      await updateDoc(userRef, {
        'stats': updatedStats,
        'lastUpdated': new Date().toISOString()
      });
      console.log('✅ User stats updated in Firestore:', updatedStats);
    } catch (firestoreError: any) {
      console.error('❌ FIRESTORE UPDATE FAILED:', firestoreError.message, firestoreError.code);
      throw firestoreError;
    }

    // Store game record in sub-collection for history tracking
    try {
      // Use local date instead of UTC to match user's timezone
      const today = new Date();
      const localDateStr = today.getFullYear() + '-' + 
        String(today.getMonth() + 1).padStart(2, '0') + '-' + 
        String(today.getDate()).padStart(2, '0');

      const gameRecord: GameRecord = {
        date: localDateStr,
        gameTime,
        isSolved,
        mistakes,
        ratingChange,
        timestamp: new Date().toISOString()
      };
      
      const gamesRef = collection(db, 'users', uid, 'games');
      const gameDocId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(gamesRef, gameDocId), gameRecord);
      console.log('✅ Game record saved to Firestore:', { gameDocId, gameRecord });
    } catch (err: any) {
      console.error('❌ Error storing game record:', err.message || err);
    }

    // Cache locally
    localStorage.setItem(`user-stats-${uid}`, JSON.stringify(updatedStats));

    return updatedStats;
  } catch (error: any) {
    console.error('❌ Error updating user stats:', error.message || error);
    console.error('Full error object:', error);
    console.error('Error code:', error.code);
    
    // Return null if offline or error
    return null;
  }
};

// Fetch user stats
export const fetchUserStats = async (uid: string): Promise<UserStats | null> => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists() && userDoc.data().stats) {
      const freshStats = userDoc.data().stats as UserStats;
      console.log('✅ Fresh stats from Firestore:', freshStats);
      // Always update localStorage with latest Firestore data
      localStorage.setItem(`user-stats-${uid}`, JSON.stringify(freshStats));
      return freshStats;
    }
    
    // If no cloud data, try localStorage
    const cached = localStorage.getItem(`user-stats-${uid}`);
    console.log('📦 No Firestore data, using cached:', cached);
    return cached ? JSON.parse(cached) : null;
  } catch (error: any) {
    console.error('❌ Error fetching user stats from Firestore:', error.message);
    
    // Fallback to localStorage on error
    const cached = localStorage.getItem(`user-stats-${uid}`);
    if (cached) {
      console.log('📦 Firestore failed, using cached stats from localStorage');
      return JSON.parse(cached);
    }
    
    return null;
  }
};

// Fetch game history for the last 365 days (for heatmap)
export const fetchGameHistoryForHeatmap = async (uid: string): Promise<Record<string, number>> => {
  try {
    const today = new Date();
    const data: Record<string, number> = {};

    // Initialize all dates to 0 (full year) using LOCAL timezone
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const key = `${year}-${month}-${day}`;
      data[key] = 0;
    }

    console.log('📥 Fetching game history for user:', uid);

    // Fetch game records from Firestore
    const gamesRef = collection(db, 'users', uid, 'games');
    const q = query(gamesRef);
    const snapshot = await getDocs(q);

    console.log('📊 Found', snapshot.size, 'game records');

    snapshot.forEach((doc) => {
      const game = doc.data() as GameRecord;
      const gameDate = game.date;
      
      // Only count games from last 365 days
      const gameDateTime = new Date(gameDate + 'T00:00:00Z').getTime();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 365);
      
      if (gameDateTime >= cutoffDate.getTime()) {
        if (data[gameDate] !== undefined) {
          data[gameDate]++;
        } else {
          data[gameDate] = 1;
        }
        console.log('  📌', gameDate, '→', data[gameDate], 'games');
      }
    });

    const totalGames = Object.values(data).reduce((a, b) => a + b, 0);
    console.log('✅ Game history fetched:', totalGames, 'total games in past 365 days');

    // Cache locally
    localStorage.setItem(`game-history-${uid}`, JSON.stringify(data));
    return data;
  } catch (error: any) {
    console.error('❌ Error fetching game history:', error);
    
    // Try to use cached data
    const cached = localStorage.getItem(`game-history-${uid}`);
    if (cached) {
      console.log('📦 Using cached game history');
      return JSON.parse(cached);
    }

    // Return empty heatmap
    const today = new Date();
    const data: Record<string, number> = {};
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const key = `${year}-${month}-${day}`;
      data[key] = 0;
    }
    return data;
  }
};

// Fetch rating history for the last 30 days (for chart)
export const fetchRatingHistoryForChart = async (uid: string): Promise<RatingHistory[]> => {
  try {
    const today = new Date();
    const ratingMap: Record<string, number> = {};
    let currentRating = 1600;

    // Fetch all game records
    const gamesRef = collection(db, 'users', uid, 'games');
    const q = query(gamesRef);
    const snapshot = await getDocs(q);

    const games: GameRecord[] = [];
    snapshot.forEach((doc) => {
      games.push(doc.data() as GameRecord);
    });

    // Sort games by timestamp
    games.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Build rating progression from last 30 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    // First pass: set all dates to current user rating
    const userStats = await fetchUserStats(uid);
    if (userStats) {
      currentRating = userStats.rating;
    }

    // Second pass: replay games to build history
    let replayRating = 1600;
    for (const game of games) {
      const gameDate = game.date;
      const gameDateTime = new Date(gameDate).getTime();

      if (gameDateTime >= cutoffDate.getTime()) {
        replayRating += game.ratingChange || 0;
        ratingMap[gameDate] = replayRating;
      }
    }

    // Create array for last 30 days
    const result: RatingHistory[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const rating = ratingMap[dateStr] || (result.length > 0 ? result[result.length - 1].rating : 1600);
      result.push({
        date: dateStr,
        rating
      });
    }

    // Cache locally
    localStorage.setItem(`rating-history-${uid}`, JSON.stringify(result));
    return result;
  } catch (error: any) {
    console.error('Error fetching rating history:', error);
    
    // Try to use cached data
    const cached = localStorage.getItem(`rating-history-${uid}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Return default progression for last 30 days
    const today = new Date();
    const result: RatingHistory[] = [];
    let rating = 1600;
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      result.push({
        date: date.toISOString().split('T')[0],
        rating
      });
      rating += Math.random() * 20 - 10; // Small random variation
    }
    return result;
  }
};

// Fetch user profile
export const fetchUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists() && userDoc.data().profile) {
      const profile = userDoc.data().profile as UserProfile;
      console.log('✅ User profile fetched:', profile);
      return profile;
    }
    
    return null;
  } catch (error: any) {
    console.error('Error fetching user profile:', error.message);
    return null;
  }
};

// Update user profile
export const updateUserProfile = async (uid: string, profile: UserProfile): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', uid);
    
    await updateDoc(userRef, {
      'profile': profile,
      'lastUpdated': new Date().toISOString()
    });
    
    console.log('✅ User profile updated:', profile);
    return true;
  } catch (error: any) {
    console.error('❌ Error updating user profile:', error.message);
    return false;
  }
};

// Upload profile photo to Firebase Storage
export const uploadProfilePhoto = async (uid: string, file: File): Promise<string | null> => {
  try {
    console.log('📤 Uploading profile photo...');
    
    // Create a unique filename
    const timestamp = Date.now();
    const fileName = `profile-${uid}-${timestamp}`;
    const storageRef = ref(storage, `profiles/${uid}/${fileName}`);
    
    // Upload file
    await uploadBytes(storageRef, file);
    
    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    console.log('✅ Photo uploaded successfully:', downloadURL);
    
    return downloadURL;
  } catch (error: any) {
    console.error('❌ Error uploading photo:', error.message);
    return null;
  }
};
