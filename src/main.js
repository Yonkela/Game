class MainScene extends Phaser.Scene {
  constructor() { super('MainScene'); }
  preload() {
    // Try to load user-supplied player image; if it's missing, we'll fall back to a runtime placeholder.
    this.load.image('player', 'assets/dude2.0.png');
    this.load.image('oven', 'assets/Oven.png');
    // Floor image for the restaurant interior (user-supplied)
    this.load.image('floor', 'assets/image.png');
  }
  create() {
    const W = this.scale.width; const H = this.scale.height;

    // Placeholder textures
    // Create placeholder textures for non-player assets first
    this.createTextures(false);

    // World bounds
    // Make the outside area look like grass and keep the interior floor distinct
    this.cameras.main.setBackgroundColor('#2e8b57'); // grass green

    // Floor margin so the green grass shows around the restaurant edges
    const floorMargin = 24;
    const floorW = Math.max(0, W - floorMargin * 2);
    const floorH = Math.max(0, H - floorMargin * 2);
    const floorX = W/2;
    const floorY = H/2;

    // Add floor image for the interior area. If the asset is missing, draw a placeholder rectangle.
    if(this.textures.exists('floor')){
      // Use a single stretched image for the interior floor (inset so grass is visible)
      this.floorImage = this.add.image(floorX, floorY, 'floor').setDisplaySize(floorW, floorH).setOrigin(0.5).setDepth(-2);
    } else {
      // Fallback: solid colored rectangle as floor placeholder inset from edges
      this.floorImage = this.add.rectangle(floorX, floorY, floorW, floorH, 0x8b5a2b).setOrigin(0.5).setDepth(-2);
    }

    // Add tables and customers as separate entities (dining area)
    this.tables = this.add.group();
    this.customers = this.add.group();
    this.foodItems = this.add.group(); // food on the ground that can be picked up
    const tablePositions = [ {x: 300, y:150}, {x: 500, y:200}, {x: 700, y:140}, {x: 350, y:350}, {x:600, y:360} ];
    tablePositions.forEach((p, idx)=>{
      // Create table (without customer)
      const table = this.add.image(p.x, p.y, 'table');
      table.order = null;
      table.orderTaken = false;
      table.orderText = null;
      table.patienceBar = null;
      table.patienceMax = 0;
      table.patienceRemaining = 0;
      this.tables.add(table);

      // Create customer as separate sprite
      const customer = this.add.image(p.x, p.y - 30, 'customer');
      customer.tableIndex = idx;
      customer.visible = true;
      customer.isWaiting = true; // whether customer is currently at table
      this.customers.add(customer);
    });

    // Place the oven directly below the dining area (centered under tables)
    const centerX = tablePositions.reduce((s,p)=>s+p.x,0) / tablePositions.length;
    this.kitchen = this.add.image(centerX, H - 80, 'oven').setOrigin(0.5).setDisplaySize(32, 32);
    // Kitchen interaction zone around the oven
    this.kitchenZone = new Phaser.Geom.Rectangle(centerX - 80, H - 140, 160, 80);
    
    // Place fridge to the left of the oven
    this.fridge = this.add.rectangle(centerX - 100, H - 80, 32, 32, 0x4b5563).setOrigin(0.5);
    this.fridgeZone = new Phaser.Geom.Rectangle(centerX - 150, H - 140, 120, 80);
    
    // Place trash can to the right of the oven
    this.trashcan = this.add.image(centerX + 100, H - 80, 'trashcan').setOrigin(0.5).setDisplaySize(32, 32);
    this.trashcanZone = new Phaser.Geom.Rectangle(centerX + 50, H - 140, 120, 80);

    // Create perimeter walls around the whole restaurant (static bodies)
    this.walls = this.physics.add.staticGroup();
    // top wall
    const topWall = this.add.rectangle(W/2, 0, W, 8, 0x000000).setOrigin(0.5,0);
    // bottom wall
    const bottomWall = this.add.rectangle(W/2, H, W, 8, 0x000000).setOrigin(0.5,1);
    // left wall
    const leftWall = this.add.rectangle(0, H/2, 8, H, 0x000000).setOrigin(0,0.5);
    // right wall
    const rightWall = this.add.rectangle(W, H/2, 8, H, 0x000000).setOrigin(1,0.5);
    this.walls.add(topWall);
    this.walls.add(bottomWall);
    this.walls.add(leftWall);
    this.walls.add(rightWall);

    // Dividing wall between dining and kitchen rooms (with door)
    const dividerY = H * 0.65; // position dividing wall about 65% down
    const doorWidth = 100; // width of door opening
    const doorCenterX = W / 2;
    // Left section of wall (before door)
    const leftWallWidth = doorCenterX - doorWidth / 2;
    const leftDoorWall = this.add.rectangle(leftWallWidth / 2, dividerY, leftWallWidth, 8, 0x000000);
    this.walls.add(leftDoorWall);
    // Right section of wall (after door)
    const rightWallStart = doorCenterX + doorWidth / 2;
    const rightWallWidth = W - rightWallStart;
    const rightDoorWall = this.add.rectangle(rightWallStart + rightWallWidth / 2, dividerY, rightWallWidth, 8, 0x000000);
    this.walls.add(rightDoorWall);

    // Player - if the 'player' texture failed to load, create a placeholder now
    if (!this.textures.exists('player')){
      this.createPlayerPlaceholder();
    }
    this.player = this.physics.add.sprite(120, H/2, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.speed = 160;
    this.player.holding = null; // either order string or food object
    this.player.lastVelX = 0; // track last movement for rotation
    this.player.lastVelY = -1; // default: facing down (negative Y)
    // Create a food display sprite that follows the player
    this.player.foodDisplay = this.add.image(this.player.x, this.player.y, 'plate').setDepth(1).setVisible(false);

    // Collide with perimeter walls
    if(this.walls) this.physics.add.collider(this.player, this.walls);

    // Simple world boundaries
    this.physics.world.setBounds(0,0,W,H);

    // Input: use WASD instead of arrow keys
    this.keys = this.input.keyboard.addKeys({ up: Phaser.Input.Keyboard.KeyCodes.W, left: Phaser.Input.Keyboard.KeyCodes.A, down: Phaser.Input.Keyboard.KeyCodes.S, right: Phaser.Input.Keyboard.KeyCodes.D });
    this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    // Resume AudioContext on first user gesture (Chrome blocks autoplay)
    // Try to resume on pointerdown or keyboard gesture so audio can play later
    const resumeAudio = ()=>{
      try{
        if(this.sound && this.sound.context && typeof this.sound.context.resume === 'function'){
          this.sound.context.resume();
        }
      }catch(e){ /* ignore */ }
    };
    this.input.once('pointerdown', resumeAudio);
    this.input.keyboard.once('keydown', resumeAudio);

    // Camera
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    // Game state (load saved values)
    this.money = parseInt(localStorage.getItem('money')) || 0;
    this.cookSpeed = parseFloat(localStorage.getItem('cookSpeed')) || 1.0; // higher = faster
    this.isCooking = false;

    // UI elements
    this.moneyEl = document.getElementById('money');
    this.statusEl = document.getElementById('status');
    this.orderEl = document.getElementById('order');
    this.upgradesBtn = document.getElementById('upgradesBtn');
    this.upgradesBtn.addEventListener('click', ()=> this.openUpgradesModal());
    document.getElementById('closeUpgradesBtn').addEventListener('click', ()=> this.closeUpgradesModal());
    document.getElementById('upgradesOverlay').addEventListener('click', ()=> this.closeUpgradesModal());

    // Initialize upgrade state
    this.upgrades = {
      ovenSpeed: parseInt(localStorage.getItem('upgradeOvenSpeed')) || 0,
      earnRate: parseInt(localStorage.getItem('upgradeEarnRate')) || 0,
      patience: parseInt(localStorage.getItem('upgradePatience')) || 0
    };

    // Make some tables generate orders periodically
    this.time.addEvent({ delay: 3000, callback: () => this.maybeGenerateOrders(), loop:true });

    // Autosave every 5 seconds
    this.autoSaveTimer = this.time.addEvent({ delay: 5000, callback: () => this.saveGame(), loop:true });

    // Cooking timer placeholder
    this.cookTimer = null;

    // Display interactive hint
    this.hintText = this.add.text(10,10,'Press E to interact',{font:'14px Arial', fill:'#fff'}).setScrollFactor(0);

    // Keep UI updated
    this.updateUI();
  }

  createTextures(){
    // Generate placeholder textures. If `withPlayer` is true, also create a player placeholder.
    const g = this.make.graphics({x:0,y:0,add:false});
    // Table (brown rectangle)
    g.fillStyle(0xa16207,1); g.fillRect(0,0,90,40); g.generateTexture('table',90,40);
    g.clear();
    // Customer (circle green)
    g.fillStyle(0x10b981,1); g.fillCircle(12,12,12); g.generateTexture('customer',24,24);
    g.clear();
    // Kitchen (gray)
    g.fillStyle(0x6b7280,1); g.fillRect(0,0,120,120); g.generateTexture('kitchen',120,120);
    g.clear();
    // Food placeholders - colored circles
    // Salad - green
    g.fillStyle(0x22c55e,1); g.fillCircle(14,14,12); g.generateTexture('Salad',28,28);
    g.clear();
    // Burger - red
    g.fillStyle(0xef4444,1); g.fillCircle(14,14,12); g.generateTexture('Burger',28,28);
    g.clear();
    // Pizza - yellow
    g.fillStyle(0xeab308,1); g.fillCircle(14,14,12); g.generateTexture('Pizza',28,28);
    g.clear();
    // Soup - tan
    g.fillStyle(0xd2b48c,1); g.fillCircle(14,14,12); g.generateTexture('Soup',28,28);
    g.clear();
    // Uncooked versions (grayed out)
    // Raw Salad - gray-green
    g.fillStyle(0x6b7280,1); g.fillCircle(14,14,12); g.generateTexture('RawSalad',28,28);
    g.clear();
    // Raw Burger - gray-red
    g.fillStyle(0x808080,1); g.fillCircle(14,14,12); g.generateTexture('RawBurger',28,28);
    g.clear();
    // Raw Pizza - gray
    g.fillStyle(0x9ca3af,1); g.fillCircle(14,14,12); g.generateTexture('RawPizza',28,28);
    g.clear();
    // Raw Soup - gray-tan
    g.fillStyle(0x9ca3af,1); g.fillCircle(14,14,12); g.generateTexture('RawSoup',28,28);
    g.clear();
    // Trash can (dark gray/black)
    g.fillStyle(0x1f2937,1); g.fillRect(0,0,32,32); g.generateTexture('trashcan',32,32);
    g.clear();
  }

  createPlayerPlaceholder(){
    // Create a simple 32x32 blue square as placeholder player texture
    const g = this.make.graphics({x:0,y:0,add:false});
    g.fillStyle(0x3b82f6,1); g.fillRect(0,0,32,32); g.generateTexture('player',32,32);
    g.clear();
  }

  maybeGenerateOrders(){
    this.tables.getChildren().forEach((table, idx)=>{
      const customer = this.customers.getChildren()[idx];
      if(customer && customer.visible && customer.isWaiting && !table.order && Math.random() < 0.4){
        const menu = ['Burger','Salad','Soup','Pizza'];
        table.order = Phaser.Utils.Array.GetRandom(menu);
        table.orderTaken = false;
        table.orderTime = this.time.now;
        const basePatienceMin = 12, basePatienceMax = 22;
        const patienceBonus = 3 * this.upgrades.patience; // +3s per upgrade level
        table.patienceMax = Phaser.Math.Between(basePatienceMin + patienceBonus, basePatienceMax + patienceBonus) * 1000; // ms
        table.patienceRemaining = table.patienceMax;
        // Create speech bubble for order above customer
        if(table.orderBubble){
          if(table.orderBubble.graphics) table.orderBubble.graphics.destroy();
          if(table.orderBubble.textObj) table.orderBubble.textObj.destroy();
        }
        table.orderBubble = this.createSpeechBubble(table.x, table.y - 80, table.order);
        // create patience bar graphics
        if(table.patienceBar) table.patienceBar.destroy();
        table.patienceBar = this.add.graphics().setDepth(6);
      }
    });
  }

  update(time, dt){
    this.handleMovement(dt);
    this.rotatePlayerToDirection();
    this.handleInteraction();
    this.updateTables(dt);
  }

  updateTables(dt){
    // decrement patience for tables with orders
    this.tables.getChildren().forEach((table, idx)=>{
      if(table.order){
        table.patienceRemaining -= dt;
        // update patience bar
        if(table.patienceBar){
          const pct = Phaser.Math.Clamp(table.patienceRemaining / table.patienceMax, 0, 1);
          table.patienceBar.clear();
          const bx = table.x - 30; const by = table.y - 72;
          table.patienceBar.fillStyle(0x000000, 0.7);
          table.patienceBar.fillRect(bx, by, 64, 8);
          table.patienceBar.fillStyle(pct > 0.5 ? 0x10b981 : (pct > 0.2 ? 0xf59e0b : 0xef4444), 1);
          table.patienceBar.fillRect(bx + 2, by + 2, Math.max(0, (64 - 4) * pct), 4);
        }
        if(table.patienceRemaining <= 0){
          // customer leaves angrily
          const customer = this.customers.getChildren()[idx];
          this.money = Math.max(0, this.money - 5);
          this.onCustomerLeave(table, customer);
        }
      }
    });
  }

  onCustomerLeave(table, customer){
    // Destroy speech bubble
    if(table.orderBubble){
      if(table.orderBubble.graphics) table.orderBubble.graphics.destroy();
      if(table.orderBubble.textObj) table.orderBubble.textObj.destroy();
      table.orderBubble = null;
    }
    if(table.orderText) table.orderText.destroy();
    if(table.patienceBar) table.patienceBar.destroy();
    // clear order and clear player's ticket if it was for this table
    const tableIdx = this.tables.getChildren().indexOf(table);
    if(this.player && this.player.orderTicket && this.player.orderTicket.tableIndex === tableIdx){
      this.player.orderTicket = null;
    }
    table.order = null;
    table.orderTaken = false;
    table.patienceRemaining = 0;
    table.patienceMax = 0;
    // Hide customer
    customer.visible = false;
    customer.isWaiting = false;
    this.updateUI();
    const s = this.add.text(table.x-20, table.y-60, 'Left',{font:'14px Arial', fill:'#ff0'}).setDepth(5);
    this.tweens.add({ targets: s, y: s.y-20, alpha:0, duration:800, onComplete: ()=> s.destroy() });
    // respawn customer after 5-10 seconds
    const respawnDelay = Phaser.Math.Between(5000, 10000);
    this.time.delayedCall(respawnDelay, ()=>{
      if(customer && !customer.isWaiting){
        customer.visible = true;
        customer.isWaiting = true;
        table.order = null;
        table.orderTaken = false;
        table.patienceRemaining = 0;
        if(table.orderBubble){
          if(table.orderBubble.graphics) table.orderBubble.graphics.destroy();
          if(table.orderBubble.textObj) table.orderBubble.textObj.destroy();
          table.orderBubble = null;
        }
        if(table.orderText) table.orderText.destroy();
        if(table.patienceBar) table.patienceBar.destroy();
      }
    }, [], this);
  }

  handleMovement(dt){
    const v = this.player.speed;
    let vx=0, vy=0;
    if(this.keys.left.isDown) vx = -v;
    else if(this.keys.right.isDown) vx = v;
    if(this.keys.up.isDown) vy = -v;
    else if(this.keys.down.isDown) vy = v;
    this.player.setVelocity(vx, vy);
    
    // Track movement direction for rotation
    if(vx !== 0 || vy !== 0){
      this.player.lastVelX = vx;
      this.player.lastVelY = vy;
    }
    
    // If player is holding food or raw ingredient, position it in front of the player
    if(this.player.holding && (this.player.holding.type === 'food' || this.player.holding.type === 'rawIngredient')){
      // Calculate position in front of player based on direction
      const distInFront = 24; // pixels in front
      const vxNorm = this.player.lastVelX === 0 ? 0 : this.player.lastVelX / Math.abs(this.player.lastVelX);
      const vyNorm = this.player.lastVelY === 0 ? 0 : this.player.lastVelY / Math.abs(this.player.lastVelY);
      this.player.foodDisplay.x = this.player.x + vxNorm * distInFront;
      this.player.foodDisplay.y = this.player.y + vyNorm * distInFront;
      // Update texture to match the food/ingredient type
      this.player.foodDisplay.setTexture(this.player.holding.name);
      this.player.foodDisplay.setVisible(true);
    } else {
      this.player.foodDisplay.setVisible(false);
    }
  }

  rotatePlayerToDirection(){
    // Rotate player sprite based on last movement direction
    const vx = this.player.lastVelX;
    const vy = this.player.lastVelY;
    const angle = Math.atan2(vy, vx) * Phaser.Math.RAD_TO_DEG;
    this.player.setRotation(Phaser.Math.DegToRad(angle - 90)); // -90 to face forward
  }

  handleInteraction(){
    if(Phaser.Input.Keyboard.JustDown(this.keyE)){
      // Check fridge first
      const p = this.player;
      if(Phaser.Geom.Rectangle.ContainsPoint(this.fridgeZone, p)){
        this.openFridgeModal();
        return;
      }
      // Check trash can
      if(Phaser.Geom.Rectangle.ContainsPoint(this.trashcanZone, p)){
        this.onTrashcanInteract();
        return;
      }
      // Check kitchen/oven
      if(Phaser.Geom.Rectangle.ContainsPoint(this.kitchenZone, p)){
        this.onKitchenInteract();
        return;
      }
      // Check tables in proximity
      const near = this.getNearbyTable(48);
      if(near) this.onTableInteract(near);
    }
  }

  createSpeechBubble(x, y, text, depth = 5){
    // Create a rounded rectangle speech bubble with text
    const padding = 8;
    const lineHeight = 18;
    const charWidth = 8;
    const width = Math.max(60, text.length * charWidth + padding * 2);
    const height = lineHeight + padding * 2;
    const radius = 6;
    
    // Create graphics for bubble background
    const graphics = this.add.graphics();
    graphics.setDepth(depth - 1);
    graphics.fillStyle(0xffffff, 1);
    graphics.lineStyle(2, 0x000000, 1);
    
    // Draw rounded rectangle (speech bubble)
    graphics.beginPath();
    graphics.moveTo(x - width/2 + radius, y - height/2);
    graphics.lineTo(x + width/2 - radius, y - height/2);
    graphics.arc(x + width/2 - radius, y - height/2 + radius, radius, -Math.PI/2, 0);
    graphics.lineTo(x + width/2, y + height/2 - radius);
    graphics.arc(x + width/2 - radius, y + height/2 - radius, radius, 0, Math.PI/2);
    graphics.lineTo(x - width/2 + radius, y + height/2);
    graphics.arc(x - width/2 + radius, y + height/2 - radius, radius, Math.PI/2, Math.PI);
    graphics.lineTo(x - width/2, y - height/2 + radius);
    graphics.arc(x - width/2 + radius, y - height/2 + radius, radius, Math.PI, -Math.PI/2);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
    
    // Draw tail (small triangle pointing down)
    graphics.fillStyle(0xffffff, 1);
    graphics.beginPath();
    graphics.moveTo(x - 8, y + height/2);
    graphics.lineTo(x + 8, y + height/2);
    graphics.lineTo(x, y + height/2 + 8);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
    
    // Add text
    const textObj = this.add.text(x, y, text, {font:'bold 14px Arial', fill:'#000', align:'center'}).setOrigin(0.5).setDepth(depth);
    
    return { graphics, textObj };
  }

  getNearbyTable(radius){
    const px = this.player.x, py = this.player.y;
    let found = null;
    this.tables.getChildren().forEach(t=>{
      const dx = t.x - px; const dy = t.y - py;
      if(Math.sqrt(dx*dx+dy*dy) <= radius) found = t;
    });
    return found;
  }

  onTableInteract(table){
    // If player holding cooked food that matches order -> deliver
    if(this.player.holding && this.player.holding.type === 'food' && table.order && this.player.holding.name === table.order){
      // Only allow serving if the order was taken first
      if(table.orderTaken){
        this.giveToTable(table);
      } else {
        if(this.statusEl) this.statusEl.textContent = 'Status: Must take the order first';
      }
      return;
    }
    // If table has an order and it hasn't been taken yet, allow player to take it (order ticket)
    const tableIdx = this.tables.getChildren().indexOf(table);
    if(table.order && !table.orderTaken && !this.player.holding){
      this.takeOrderFromTable(tableIdx, table);
      return;
    }
    // Otherwise instruct player to get ingredients from the fridge if they have an order
    if(this.statusEl) this.statusEl.textContent = 'Status: Get ingredients from fridge first';
  }

  takeOrderFromTable(tableIdx, table){
    // Give the player an order ticket (stored separately so player can still carry ingredients)
    this.player.orderTicket = { name: table.order, tableIndex: tableIdx };
    // mark that order is now being processed (customer waiting)
    table.orderTaken = true;
    if(table.orderText) table.orderText.setText('Ordered');
    if(table.orderBubble && table.orderBubble.textObj){
      table.orderBubble.textObj.setText(table.order + ' (Taken)');
    }
    if(this.statusEl) this.statusEl.textContent = 'Status: Took order - ' + table.order;
    this.updateUI();
  }

  onKitchenInteract(){
    // If player holding a raw ingredient -> start cooking
    if(this.player.holding && this.player.holding.type === 'rawIngredient'){
      if(this.isCooking){ if(this.statusEl) this.statusEl.textContent = 'Status: Already cooking'; return; }
      // Convert raw ingredient to cooked dish
      const dishName = this.player.holding.name.replace('Raw', '');
      this.startCooking(dishName);
      this.player.holding = null;
      this.updateUI();
      return;
    }
    // If player holding nothing, check for nearby food to pick up
    if(!this.player.holding){
      const px = this.player.x, py = this.player.y;
      const foodNearby = this.foodItems.getChildren().filter(f => Phaser.Math.Distance.Between(px, py, f.x, f.y) < 60);
      if(foodNearby.length > 0){
        const food = foodNearby[0];
        this.player.holding = { type:'food', name: food.dishName };
        food.destroy();
        if(this.statusEl) this.statusEl.textContent = 'Status: Picked up ' + food.dishName;
        this.updateUI();
        return;
      }
    }
    if(this.statusEl) this.statusEl.textContent = 'Status: Kitchen area';
  }

  startCooking(dishName){
    this.isCooking = true;
    const baseTime = 3000; // ms
    // Apply oven speed multiplier (1.5x per upgrade level) + cookSpeed from previous upgrades
    const ovenSpeedMult = 1 + (0.3 * this.upgrades.ovenSpeed);
    const cookDuration = (baseTime / this.cookSpeed) * (1 / ovenSpeedMult);
    if(this.statusEl) this.statusEl.textContent = 'Status: Cooking ' + dishName + '...';
    // Simulate cooking with a timer
    this.cookTimer = this.time.delayedCall(cookDuration, ()=>{
      this.isCooking = false;
      // Create food item at oven location with dish-specific texture
      const food = this.add.image(this.kitchen.x, this.kitchen.y, dishName);
      food.dishName = dishName;
      this.foodItems.add(food);
      if(this.statusEl) this.statusEl.textContent = 'Status: Cooked ' + dishName + ' (at oven)';
      this.updateUI();
    }, [], this);
  }

  giveToTable(table){
    // Serve and reward money
    const got = this.player.holding && this.player.holding.name;
    const tableIdx = this.tables.getChildren().indexOf(table);
    // Require that the player has the ticket for this table
    if(!this.player.orderTicket || this.player.orderTicket.tableIndex !== tableIdx){
      if(this.statusEl) this.statusEl.textContent = 'Status: You must take this table\'s order first';
      return;
    }
    if(table.order === got){
      if(!table.orderTaken){
        if(this.statusEl) this.statusEl.textContent = 'Status: You must take the order first';
        return;
      }
      // Base reward + earn rate upgrade bonus
      const baseReward = 20;
      const earnBonus = 5 * this.upgrades.earnRate;
      const totalReward = baseReward + earnBonus;
      this.money += totalReward;
      table.order = null;
      // Destroy speech bubble
      if(table.orderBubble){
        if(table.orderBubble.graphics) table.orderBubble.graphics.destroy();
        if(table.orderBubble.textObj) table.orderBubble.textObj.destroy();
        table.orderBubble = null;
      }
      if(table.orderText) table.orderText.destroy();
      if(table.patienceBar) table.patienceBar.destroy();
      this.player.holding = null;
      if(this.statusEl) this.statusEl.textContent = 'Status: Served ' + got + ' +$' + totalReward;
      this.updateUI();
      // small happy effect
      const s = this.add.text(table.x-20, table.y-60, '+$' + totalReward,{font:'14px Arial', fill:'#0f0'}).setDepth(5);
      this.tweens.add({ targets: s, y: s.y-20, alpha:0, duration:800, onComplete: ()=> s.destroy() });
      // Find customer at this table and make them leave
      if(tableIdx >= 0){
        const customer = this.customers.getChildren()[tableIdx];
        this.onCustomerLeave(table, customer);
      }
      // clear player's order ticket when served
      this.player.orderTicket = null;
    } else {
      if(this.statusEl) this.statusEl.textContent = 'Status: Wrong dish';
    }
  }

  openUpgradesModal(){
    document.getElementById('upgradesOverlay').classList.add('show');
    document.getElementById('upgradesModal').classList.add('show');
    this.renderUpgrades();
  }

  closeUpgradesModal(){
    document.getElementById('upgradesOverlay').classList.remove('show');
    document.getElementById('upgradesModal').classList.remove('show');
  }

  renderUpgrades(){
    const upgradesList = document.getElementById('upgradesList');
    upgradesList.innerHTML = '';
    const upgradeDefs = [
      { id: 'ovenSpeed', name: 'Oven Speed Boost', desc: 'Cook 30% faster per level', baseCost: 40 },
      { id: 'earnRate', name: 'Better Prices', desc: 'Earn $5 more per dish per level', baseCost: 35 },
      { id: 'patience', name: 'Better Service', desc: 'Customers wait 3s longer per level', baseCost: 30 }
    ];
    upgradeDefs.forEach(upgrade => {
      const level = this.upgrades[upgrade.id];
      const cost = Math.round(upgrade.baseCost * Math.pow(1.5, level));
      const canAfford = this.money >= cost;
      const item = document.createElement('div');
      item.className = 'upgrade-item';
      item.innerHTML = `
        <div class="upgrade-info">
          <h3>${upgrade.name}</h3>
          <p>${upgrade.desc}</p>
          <p style="color:#aaa; font-size:11px; margin-top:4px;">Level: ${level}</p>
        </div>
        <div class="upgrade-cost">$${cost}</div>
        <button onclick="window.gameScene.buyUpgrade('${upgrade.id}', ${cost})" ${canAfford ? '' : 'disabled'}>Buy</button>
      `;
      upgradesList.appendChild(item);
    });
  }

  buyUpgrade(upgradeId, cost){
    if(this.money >= cost){
      this.money -= cost;
      this.upgrades[upgradeId] = (this.upgrades[upgradeId] || 0) + 1;
      // Save upgrade state
      localStorage.setItem(`upgrade${upgradeId.charAt(0).toUpperCase() + upgradeId.slice(1)}`, String(this.upgrades[upgradeId]));
      this.updateUI();
      this.renderUpgrades();
      if(this.statusEl) this.statusEl.textContent = 'Status: Bought upgrade!';
    } else {
      if(this.statusEl) this.statusEl.textContent = 'Status: Not enough money';
    }
  }

  updateUI(){
    if(this.moneyEl) this.moneyEl.textContent = 'Money: $' + this.money;
    if(this.orderEl) {
      const holdingText = this.player.holding ? (this.player.holding.name + ' ('+this.player.holding.type+')') : '-';
      const ticketText = this.player.orderTicket ? (' | Ticket: ' + this.player.orderTicket.name + ' (T' + (this.player.orderTicket.tableIndex+1) + ')') : '';
      this.orderEl.textContent = 'Holding: ' + holdingText + ticketText;
    }
    // Update upgrades button
    if(this.upgradesBtn){
      this.upgradesBtn.disabled = false;
    }
    // Render orders panel (top-right)
    const ordersPanel = document.getElementById('ordersPanel');
    if(ordersPanel){
      const tables = (this.tables && typeof this.tables.getChildren === 'function') ? this.tables.getChildren() : [];
      let html = '';
      tables.forEach((table, idx)=>{
        if(table && table.order){
          const taken = table.orderTaken ? 'Taken' : 'Waiting';
          // color dot matching food
          let color = '#ffffff';
          if(table.order === 'Salad') color = '#22c55e';
          else if(table.order === 'Burger') color = '#ef4444';
          else if(table.order === 'Pizza') color = '#eab308';
          else if(table.order === 'Soup') color = '#d2b48c';
          html += `<div class="order-item"><div class="order-label"><span class="order-dot" style="background:${color}"></span><div>Table ${idx+1}: ${table.order}</div></div><div style="font-size:12px;color:#ccc">${taken}</div></div>`;
        }
      });
      ordersPanel.innerHTML = html;
    }
  }

  openFridgeModal(){
    const overlay = document.getElementById('fridgeOverlay');
    const modal = document.getElementById('fridgeModal');
    if(overlay && modal){
      overlay.classList.add('show');
      modal.classList.add('show');
    }
  }

  closeFridgeModal(){
    const overlay = document.getElementById('fridgeOverlay');
    const modal = document.getElementById('fridgeModal');
    if(overlay && modal){
      overlay.classList.remove('show');
      modal.classList.remove('show');
    }
  }

  grabIngredient(ingredientName){
    // Give player the raw ingredient
    this.player.holding = { type: 'rawIngredient', name: 'Raw' + ingredientName };
    this.closeFridgeModal();
    if(this.statusEl) this.statusEl.textContent = 'Status: Got ' + ingredientName + ' (take to oven)';
    this.updateUI();
  }

  onTrashcanInteract(){
    if(this.player.holding){
      const itemName = this.player.holding.name;
      this.player.holding = null;
      if(this.statusEl) this.statusEl.textContent = 'Status: Disposed ' + itemName;
      this.updateUI();
    } else {
      if(this.statusEl) this.statusEl.textContent = 'Status: Nothing to dispose';
    }
  }

  saveGame(){
    try{
      localStorage.setItem('money', String(this.money));
      localStorage.setItem('cookSpeed', String(this.cookSpeed || 1));
      const el = document.getElementById('saveStatus'); if(el) el.textContent = 'Saved';
      // clear the saved text after a short time
      this.time && this.time.delayedCall && this.time.delayedCall(900, ()=>{ if(el) el.textContent = ''; }, [], this);
    }catch(e){
      console.warn('Failed to save game', e);
    }
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 960,
  height: 640,
  physics: { default:'arcade', arcade:{ debug:false } },
  scene: [ MainScene ]
};

window.onload = ()=>{
  const game = new Phaser.Game(config);
  // Make UI updates on each frame for status and expose scene globally for upgrade modal
  game.events.on('step', ()=>{
    const scene = game.scene.getScene('MainScene');
    if(scene){
      scene.updateUI();
      window.gameScene = scene; // store for modal button clicks
    }
  });
};
