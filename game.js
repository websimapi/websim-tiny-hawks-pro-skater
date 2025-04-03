import * as Matter from 'matter-js';

// Initialize WebsimSocket
const room = new WebsimSocket();

// Physics variables
const Engine = Matter.Engine;
const Render = Matter.Render;
const Runner = Matter.Runner;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Composite = Matter.Composite;
const Vector = Matter.Vector;
const Events = Matter.Events;
const Query = Matter.Query;

// Game constants
const SKATER_RADIUS = 20;
const GRAVITY_STRENGTH = 0.7;
const JUMP_FORCE = 12;
const MOVE_FORCE = 0.5;
const FRICTION = 0.03;
const AIR_FRICTION = 0.001;
const TRICK_FORCE = 8;
const TRICK_ROTATION_SPEED = 0.2;
const GRIND_SCORE = 50;
const TRICK_SCORE = 100;
const COMBO_MULTIPLIER = 2;
const COMBO_TIMEOUT = 3000; // 3 seconds

// Game variables
let localPlayer = {
    id: null,
    username: '',
    body: null,
    onGround: false,
    onRail: false,
    inAir: false,
    trickInProgress: false,
    trickRotation: 0,
    score: 0,
    combo: 1,
    lastTrickTime: 0,
    comboTimer: null,
    tricks: {
        kickflip: false,
        heelflip: false,
        shoveIt: false,
        grind: false
    }
};

// Controls state
const controls = {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    mouseX: 0,
    mouseY: 0,
    mouseDeltaX: 0,
    mouseDeltaY: 0,
    lastMouseX: 0,
    lastMouseY: 0
};

// Game state
let engine;
let render;
let runner;
let canvas;
let sceneObjects = {};
let rails = [];

// Initialize Matter.js
function initPhysics() {
    const gameContainer = document.getElementById('game-container');
    canvas = document.getElementById('game-canvas');
    
    // Create engine
    engine = Engine.create({
        gravity: { x: 0, y: GRAVITY_STRENGTH }
    });
    
    // Create renderer
    render = Render.create({
        canvas: canvas,
        engine: engine,
        options: {
            width: gameContainer.clientWidth,
            height: gameContainer.clientHeight,
            wireframes: false,
            background: '#2c3e50'
        }
    });
    
    // Run the renderer
    Render.run(render);
    
    // Create runner
    runner = Runner.create();
    Runner.run(runner, engine);
    
    // Resize handler
    window.addEventListener('resize', () => {
        render.options.width = gameContainer.clientWidth;
        render.options.height = gameContainer.clientHeight;
        render.canvas.width = gameContainer.clientWidth;
        render.canvas.height = gameContainer.clientHeight;
    });
}

// Create skate park
function createSkatePark() {
    const width = render.options.width;
    const height = render.options.height;
    
    // Ground
    const ground = Bodies.rectangle(width / 2, height - 50, width, 100, {
        isStatic: true,
        friction: 0.3,
        render: {
            fillStyle: '#3d4852'
        }
    });
    
    // Left wall
    const leftWall = Bodies.rectangle(0, height / 2, 50, height, {
        isStatic: true,
        friction: 0,
        render: {
            fillStyle: '#3d4852'
        }
    });
    
    // Right wall
    const rightWall = Bodies.rectangle(width, height / 2, 50, height, {
        isStatic: true,
        friction: 0,
        render: {
            fillStyle: '#3d4852'
        }
    });
    
    // Ceiling
    const ceiling = Bodies.rectangle(width / 2, 0, width, 50, {
        isStatic: true,
        friction: 0,
        render: {
            fillStyle: '#3d4852'
        }
    });
    
    // Ramp left
    const rampLeft = Bodies.trapezoid(width / 4, height - 120, width / 3, 150, 0.5, {
        isStatic: true,
        friction: 0.1,
        render: {
            fillStyle: '#b83b5e'
        }
    });
    
    // Ramp right
    const rampRight = Bodies.trapezoid(width * 3 / 4, height - 120, width / 3, 150, -0.5, {
        isStatic: true,
        friction: 0.1,
        render: {
            fillStyle: '#b83b5e'
        }
    });
    
    // Quarter pipe left
    const quarterPipeLeft = createQuarterPipe(150, height - 250, 100, 200, true);
    
    // Quarter pipe right
    const quarterPipeRight = createQuarterPipe(width - 150, height - 250, 100, 200, false);
    
    // Rails for grinding
    const railLeft = Bodies.rectangle(width / 3, height - 150, width / 4, 10, {
        isStatic: true,
        friction: 0.05,
        render: {
            fillStyle: '#f9ed69'
        },
        collisionFilter: {
            group: 2,
            category: 2,
            mask: 1
        },
        isRail: true
    });
    
    const railRight = Bodies.rectangle(width * 2 / 3, height - 200, width / 4, 10, {
        isStatic: true,
        friction: 0.05,
        render: {
            fillStyle: '#f9ed69'
        },
        collisionFilter: {
            group: 2,
            category: 2,
            mask: 1
        },
        isRail: true
    });
    
    // Add all objects to the world
    Composite.add(engine.world, [
        ground, leftWall, rightWall, ceiling,
        rampLeft, rampRight,
        ...quarterPipeLeft, ...quarterPipeRight,
        railLeft, railRight
    ]);
    
    rails.push(railLeft, railRight);
    
    // Store scene objects
    sceneObjects = {
        ground,
        leftWall,
        rightWall,
        ceiling,
        rampLeft,
        rampRight,
        railLeft,
        railRight
    };
}

// Helper function to create quarter pipes
function createQuarterPipe(x, y, width, height, isLeft) {
    const segments = 8;
    const bodies = [];
    const radius = height;
    
    for (let i = 0; i < segments; i++) {
        const angle = (Math.PI / 2) * (i / (segments - 1));
        const segX = isLeft ? x + radius * Math.sin(angle) : x - radius * Math.sin(angle);
        const segY = y + radius * (1 - Math.cos(angle));
        
        const segment = Bodies.rectangle(
            segX,
            segY,
            width,
            10,
            {
                isStatic: true,
                angle: isLeft ? angle : Math.PI - angle,
                friction: 0.05,
                render: {
                    fillStyle: '#6a2c70'
                }
            }
        );
        
        bodies.push(segment);
    }
    
    return bodies;
}

// Create a skateboarder for the local player
function createLocalSkater(x, y) {
    const skater = Bodies.circle(x, y, SKATER_RADIUS, {
        restitution: 0.3,
        friction: FRICTION,
        frictionAir: AIR_FRICTION,
        density: 0.05,
        render: {
            fillStyle: '#f08a5d',
            sprite: {
                texture: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23f08a5d"/><rect x="8" y="26" width="24" height="4" fill="%23333" rx="2"/><circle cx="15" cy="16" r="2" fill="%23333"/><circle cx="25" cy="16" r="2" fill="%23333"/><path d="M15 22 Q 20 25 25 22" stroke="%23333" stroke-width="2" fill="none"/></svg>'
            }
        }
    });
    
    localPlayer.body = skater;
    Composite.add(engine.world, skater);
}

// Collision detection
function setupCollisions() {
    Events.on(engine, 'collisionStart', (event) => {
        const pairs = event.pairs;
        
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            
            // Check if player is on ground
            if ((pair.bodyA === localPlayer.body && pair.bodyB !== sceneObjects.ceiling) ||
                (pair.bodyB === localPlayer.body && pair.bodyA !== sceneObjects.ceiling)) {
                
                // Check if landing from air
                if (localPlayer.inAir && !localPlayer.onGround) {
                    handleLanding();
                }
                
                localPlayer.onGround = true;
                localPlayer.inAir = false;
                
                // Check if on rail
                if ((pair.bodyA.isRail || pair.bodyB.isRail) && !localPlayer.onRail) {
                    startGrind();
                }
            }
        }
    });
    
    Events.on(engine, 'collisionActive', () => {
        // Check if player is still on the ground
        localPlayer.onGround = isOnGround();
        
        // Check if player is still on a rail
        localPlayer.onRail = isOnRail();
    });
    
    Events.on(engine, 'collisionEnd', (event) => {
        const pairs = event.pairs;
        
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            
            // Check if player left the ground
            if ((pair.bodyA === localPlayer.body && pair.bodyB !== sceneObjects.ceiling) ||
                (pair.bodyB === localPlayer.body && pair.bodyA !== sceneObjects.ceiling)) {
                
                // Double check if really left the ground
                if (!isOnGround()) {
                    localPlayer.onGround = false;
                    
                    // If jumped
                    if (controls.jump) {
                        localPlayer.inAir = true;
                    }
                }
                
                // Check if left rail
                if ((pair.bodyA.isRail || pair.bodyB.isRail) && !isOnRail()) {
                    endGrind();
                }
            }
        }
    });
}

// Helper to check if player is on ground
function isOnGround() {
    const playerPos = localPlayer.body.position;
    const playerRadius = SKATER_RADIUS;
    
    // Create a small region below the player to check for collisions
    const region = {
        min: { x: playerPos.x - playerRadius, y: playerPos.y + playerRadius - 2 },
        max: { x: playerPos.x + playerRadius, y: playerPos.y + playerRadius + 2 }
    };
    
    // Find all bodies in that region
    const bodies = Query.region(Composite.allBodies(engine.world), region);
    
    // Filter out the player body
    return bodies.some(body => body !== localPlayer.body);
}

// Helper to check if player is on rail
function isOnRail() {
    const playerPos = localPlayer.body.position;
    const playerRadius = SKATER_RADIUS;
    
    // Create a small region below the player to check for collisions
    const region = {
        min: { x: playerPos.x - playerRadius, y: playerPos.y + playerRadius - 2 },
        max: { x: playerPos.x + playerRadius, y: playerPos.y + playerRadius + 2 }
    };
    
    // Find all bodies in that region
    const bodies = Query.region(Composite.allBodies(engine.world), region);
    
    // Check if any of them is a rail
    return bodies.some(body => body.isRail);
}

// Input handling
function setupInputHandlers() {
    // Keyboard controls
    window.addEventListener('keydown', (e) => {
        switch (e.key.toLowerCase()) {
            case 'a':
            case 'arrowleft':
                controls.left = true;
                break;
            case 'd':
            case 'arrowright':
                controls.right = true;
                break;
            case 'w':
            case 'arrowup':
                controls.up = true;
                break;
            case 's':
            case 'arrowdown':
                controls.down = true;
                break;
            case ' ':
                if (!controls.jump && localPlayer.onGround) {
                    controls.jump = true;
                    jump();
                }
                break;
        }
    });
    
    window.addEventListener('keyup', (e) => {
        switch (e.key.toLowerCase()) {
            case 'a':
            case 'arrowleft':
                controls.left = false;
                break;
            case 'd':
            case 'arrowright':
                controls.right = false;
                break;
            case 'w':
            case 'arrowup':
                controls.up = false;
                break;
            case 's':
            case 'arrowdown':
                controls.down = false;
                break;
            case ' ':
                controls.jump = false;
                break;
        }
    });
    
    // Mouse controls for tricks
    window.addEventListener('mousemove', (e) => {
        controls.mouseDeltaX = e.clientX - controls.lastMouseX;
        controls.mouseDeltaY = e.clientY - controls.lastMouseY;
        controls.mouseX = e.clientX;
        controls.mouseY = e.clientY;
        controls.lastMouseX = e.clientX;
        controls.lastMouseY = e.clientY;
        
        // If in air and mouse moved significantly, perform trick
        if (localPlayer.inAir && !localPlayer.trickInProgress && 
            (Math.abs(controls.mouseDeltaX) > 10 || Math.abs(controls.mouseDeltaY) > 10)) {
            performTrick();
        }
    });
    
    // Touch controls (for mobile)
    const touchControls = document.createElement('div');
    touchControls.className = 'touch-controls';
    document.getElementById('game-container').appendChild(touchControls);
}

// Jump function
function jump() {
    if (localPlayer.onGround) {
        Body.applyForce(localPlayer.body, localPlayer.body.position, { x: 0, y: -JUMP_FORCE });
        localPlayer.onGround = false;
        localPlayer.inAir = true;
        
        // End any grind when jumping
        if (localPlayer.onRail) {
            endGrind();
        }
    }
}

// Start grinding on rail
function startGrind() {
    if (!localPlayer.tricks.grind) {
        localPlayer.tricks.grind = true;
        localPlayer.onRail = true;
        
        // Apply slight upward force to stay on rail
        Body.applyForce(localPlayer.body, localPlayer.body.position, { x: 0, y: -0.05 });
        
        // Reduce friction when grinding
        localPlayer.body.friction = 0.01;
        
        // Award points
        addScore(GRIND_SCORE);
        
        // Display trick text
        showTrickText("RAIL GRIND!", localPlayer.body.position.x, localPlayer.body.position.y - 40);
        
        // Broadcast grind start
        room.updatePresence({
            x: localPlayer.body.position.x,
            y: localPlayer.body.position.y,
            angle: localPlayer.body.angle,
            grinding: true
        });
    }
}

// End grinding
function endGrind() {
    if (localPlayer.tricks.grind) {
        localPlayer.tricks.grind = false;
        localPlayer.onRail = false;
        
        // Restore normal friction
        localPlayer.body.friction = FRICTION;
        
        // Broadcast grind end
        room.updatePresence({
            x: localPlayer.body.position.x,
            y: localPlayer.body.position.y,
            angle: localPlayer.body.angle,
            grinding: false
        });
    }
}

// Perform trick based on mouse movement
function performTrick() {
    if (!localPlayer.trickInProgress && localPlayer.inAir) {
        localPlayer.trickInProgress = true;
        
        // Determine trick type based on mouse movement
        let trickType;
        let rotationDirection;
        
        if (Math.abs(controls.mouseDeltaX) > Math.abs(controls.mouseDeltaY)) {
            // Horizontal movement - kickflip or heelflip
            if (controls.mouseDeltaX > 0) {
                trickType = "KICKFLIP!";
                rotationDirection = 1;
                localPlayer.tricks.kickflip = true;
            } else {
                trickType = "HEELFLIP!";
                rotationDirection = -1;
                localPlayer.tricks.heelflip = true;
            }
        } else {
            // Vertical movement - shove-it
            trickType = "SHOVE-IT!";
            rotationDirection = controls.mouseDeltaY > 0 ? 1 : -1;
            localPlayer.tricks.shoveIt = true;
        }
        
        // Apply rotation force
        localPlayer.trickRotation = rotationDirection * TRICK_ROTATION_SPEED;
        
        // Display trick text
        showTrickText(trickType, localPlayer.body.position.x, localPlayer.body.position.y - 40);
        
        // Broadcast trick
        room.updatePresence({
            x: localPlayer.body.position.x,
            y: localPlayer.body.position.y,
            angle: localPlayer.body.angle,
            trick: trickType
        });
    }
}

// Handle landing from a trick
function handleLanding() {
    if (localPlayer.trickInProgress) {
        // Check if trick was completed based on rotation
        const rotation = localPlayer.body.angle % (2 * Math.PI);
        const rotationDegrees = Math.abs(rotation * (180 / Math.PI));
        
        // Successful trick if rotation is close to 360 degrees
        const trickSuccess = rotationDegrees < 45 || rotationDegrees > 315;
        
        if (trickSuccess) {
            // Award points for successful trick
            addScore(TRICK_SCORE);
            showTrickText("LANDED!", localPlayer.body.position.x, localPlayer.body.position.y - 40);
        } else {
            // Failed trick
            resetCombo();
            showTrickText("FAILED!", localPlayer.body.position.x, localPlayer.body.position.y - 40);
        }
        
        // Reset trick state
        localPlayer.trickInProgress = false;
        localPlayer.trickRotation = 0;
        localPlayer.tricks.kickflip = false;
        localPlayer.tricks.heelflip = false;
        localPlayer.tricks.shoveIt = false;
        
        // Broadcast landing
        room.updatePresence({
            x: localPlayer.body.position.x,
            y: localPlayer.body.position.y,
            angle: localPlayer.body.angle,
            landed: trickSuccess
        });
    }
}

// Display trick text with animation
function showTrickText(text, x, y) {
    const trickText = document.createElement('div');
    trickText.className = 'trick-text';
    trickText.textContent = text;
    trickText.style.left = `${x}px`;
    trickText.style.top = `${y}px`;
    
    document.getElementById('game-container').appendChild(trickText);
    
    // Animate
    setTimeout(() => {
        trickText.style.transform = 'translateY(-50px)';
        trickText.style.opacity = '0';
    }, 50);
    
    // Remove after animation
    setTimeout(() => {
        trickText.remove();
    }, 1000);
}

// Scoring system
function addScore(points) {
    // Add points based on combo multiplier
    const pointsWithCombo = points * localPlayer.combo;
    localPlayer.score += pointsWithCombo;
    
    // Increment combo
    localPlayer.combo *= COMBO_MULTIPLIER;
    
    // Update UI
    updateScoreUI();
    
    // Update last trick time
    localPlayer.lastTrickTime = Date.now();
    
    // Clear existing combo timer
    if (localPlayer.comboTimer) {
        clearTimeout(localPlayer.comboTimer);
    }
    
    // Set new combo timer
    localPlayer.comboTimer = setTimeout(resetCombo, COMBO_TIMEOUT);
    
    // Broadcast score update
    room.updatePresence({
        score: localPlayer.score,
        combo: localPlayer.combo
    });
}

// Reset combo multiplier
function resetCombo() {
    localPlayer.combo = 1;
    updateScoreUI();
    
    // Clear combo timer
    if (localPlayer.comboTimer) {
        clearTimeout(localPlayer.comboTimer);
        localPlayer.comboTimer = null;
    }
}

// Update score display
function updateScoreUI() {
    document.getElementById('score').textContent = `Score: ${localPlayer.score}`;
    document.getElementById('combo').textContent = `Combo: x${localPlayer.combo.toFixed(1)}`;
}

// Update player list
function updatePlayersList() {
    const playersContainer = document.getElementById('players-container');
    playersContainer.innerHTML = '';
    
    Object.values(room.peers).forEach(peer => {
        const playerPresence = room.presence[peer.id] || {};
        
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.innerHTML = `
            <span>${peer.username}: ${playerPresence.score || 0}</span>
            <img class="player-avatar" src="${peer.avatarUrl}" alt="${peer.username}">
        `;
        
        playersContainer.appendChild(playerItem);
    });
}

// Game update loop
function gameLoop() {
    if (!localPlayer.body) return;
    
    // Apply movement forces
    if (localPlayer.onGround || localPlayer.onRail) {
        if (controls.left) {
            Body.applyForce(localPlayer.body, localPlayer.body.position, { x: -MOVE_FORCE, y: 0 });
        }
        if (controls.right) {
            Body.applyForce(localPlayer.body, localPlayer.body.position, { x: MOVE_FORCE, y: 0 });
        }
    } else {
        // Reduced control in air
        if (controls.left) {
            Body.applyForce(localPlayer.body, localPlayer.body.position, { x: -MOVE_FORCE * 0.3, y: 0 });
        }
        if (controls.right) {
            Body.applyForce(localPlayer.body, localPlayer.body.position, { x: MOVE_FORCE * 0.3, y: 0 });
        }
    }
    
    // Apply trick rotation
    if (localPlayer.trickInProgress) {
        Body.setAngularVelocity(localPlayer.body, localPlayer.trickRotation);
    } else if (localPlayer.onGround && !localPlayer.onRail) {
        // Stabilize rotation when on ground
        Body.setAngle(localPlayer.body, 0);
        Body.setAngularVelocity(localPlayer.body, 0);
    }
    
    // Update position in room presence
    room.updatePresence({
        x: localPlayer.body.position.x,
        y: localPlayer.body.position.y,
        angle: localPlayer.body.angle,
        onGround: localPlayer.onGround,
        onRail: localPlayer.onRail,
        inAir: localPlayer.inAir
    });
    
    // Request next frame
    requestAnimationFrame(gameLoop);
}

// Initialize game
async function initGame() {
    await room.initialize();
    
    // Set local player ID
    localPlayer.id = room.clientId;
    
    // Initialize physics and game objects
    initPhysics();
    createSkatePark();
    
    // Create skateboard for local player
    createLocalSkater(render.options.width / 2, 100);
    
    // Setup collision detection
    setupCollisions();
    
    // Setup input handlers
    setupInputHandlers();
    
    // Subscribe to presence changes
    room.subscribePresence(presenceData => {
        updatePlayersList();
    });
    
    // Subscribe to messages for events
    room.onmessage = (event) => {
        const data = event.data;
        
        if (data.type === "connected" || data.type === "disconnected") {
            updatePlayersList();
        }
        
        // Custom message handling can be added here
    };
    
    // Start game loop
    gameLoop();
}

// Start the game
initGame();