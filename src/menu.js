// Menu and Save System for Restaurant Game
const GameMenu = {
  // Get all saved slots from localStorage
  getAllSaves() {
    const saves = {};
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('save_')) {
          const slotName = key.replace('save_', '');
          try {
            saves[slotName] = JSON.parse(localStorage.getItem(key));
          } catch (e) {
            console.warn('Failed to parse save:', slotName);
          }
        }
      });
    } catch (e) {
      console.warn('Failed to get saves', e);
    }
    return saves;
  },

  // Get the last played save slot name
  getLastSave() {
    try {
      return localStorage.getItem('lastSaveSlot') || null;
    } catch (e) {
      return null;
    }
  },

  // Set the current save slot
  setCurrentSave(slotName) {
    try {
      localStorage.setItem('currentSaveSlot', slotName);
      localStorage.setItem('lastSaveSlot', slotName);
    } catch (e) {
      console.warn('Failed to set current save', e);
    }
  },

  // Create a new save with a unique name
  newSave() {
    const timestamp = Date.now();
    const saveName = `Save_${timestamp}`;
    this.setCurrentSave(saveName);
    
    // Clear any existing data and start fresh
    this.clearCurrentGameData();
    
    // Hide menu and start game
    this.hideMenu();
    this.startGame();
  },

  // Continue the last played save
  continueSave() {
    const lastSave = this.getLastSave();
    if (lastSave) {
      this.setCurrentSave(lastSave);
      this.hideMenu();
      this.startGame();
    } else {
      // No save found, create new one
      this.newSave();
    }
  },

  // Show the load save menu
  showLoadMenu() {
    const overlay = document.getElementById('loadMenuOverlay');
    const menu = document.getElementById('loadSaveMenu');
    const slotsList = document.getElementById('saveSlotsList');
    
    if (!overlay || !menu || !slotsList) return;
    
    // Get all saves
    const saves = this.getAllSaves();
    const saveKeys = Object.keys(saves);
    
    // Clear list
    slotsList.innerHTML = '';
    
    if (saveKeys.length === 0) {
      slotsList.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px;">No saves found. Create a new save to get started!</p>';
    } else {
      saveKeys.forEach(slotName => {
        const saveData = saves[slotName];
        const money = saveData.money || 0;
        const date = saveData.timestamp ? new Date(saveData.timestamp).toLocaleString() : 'Unknown';
        
        const slotDiv = document.createElement('div');
        slotDiv.className = 'save-slot';
        slotDiv.innerHTML = `
          <div class="save-info">
            <h3>${slotName}</h3>
            <p>Money: $${money} | Last played: ${date}</p>
          </div>
          <div class="save-actions">
            <button onclick="GameMenu.loadSave('${slotName}')">Load</button>
            <button class="delete-btn" onclick="GameMenu.deleteSave('${slotName}')">Delete</button>
          </div>
        `;
        slotsList.appendChild(slotDiv);
      });
    }
    
    overlay.classList.add('show');
    menu.classList.add('show');
  },

  // Close the load save menu
  closeLoadMenu() {
    const overlay = document.getElementById('loadMenuOverlay');
    const menu = document.getElementById('loadSaveMenu');
    if (overlay) overlay.classList.remove('show');
    if (menu) menu.classList.remove('show');
  },

  // Load a specific save
  loadSave(slotName) {
    this.setCurrentSave(slotName);
    this.closeLoadMenu();
    this.hideMenu();
    this.startGame();
  },

  // Delete a save slot
  deleteSave(slotName) {
    if (!confirm(`Are you sure you want to delete ${slotName}?`)) return;
    
    try {
      localStorage.removeItem('save_' + slotName);
      // If this was the last save, clear it
      if (this.getLastSave() === slotName) {
        localStorage.removeItem('lastSaveSlot');
      }
      // Refresh the menu
      this.showLoadMenu();
    } catch (e) {
      console.warn('Failed to delete save', e);
      alert('Failed to delete save');
    }
  },

  // Clear current game data (for new save)
  clearCurrentGameData() {
    // Don't clear the save slot tracking, just game data
    const keysToKeep = ['currentSaveSlot', 'lastSaveSlot'];
    const keysToRemove = ['money', 'cookSpeed', 'upgradeOvenSpeed', 'upgradeEarnRate', 'upgradePatience', 'upgradePlayerSpeed'];
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    });
  },

  // Hide the menu screen
  hideMenu() {
    const menu = document.getElementById('menuScreen');
    if (menu) menu.classList.add('hidden');
  },

  // Show the menu screen
  showMenu() {
    const menu = document.getElementById('menuScreen');
    if (menu) menu.classList.remove('hidden');
  },

  // Start the game (initialize Phaser)
  startGame() {
    this.hideMenu();
    if (window.startPhaserGame) {
      window.startPhaserGame();
    }
  },

  // Return to menu from game
  returnToMenu() {
    if (window.gameInstance) {
      window.gameInstance.destroy(true);
      window.gameInstance = null;
    }
    this.showMenu();
  }
};

// Expose globally
window.GameMenu = GameMenu;
