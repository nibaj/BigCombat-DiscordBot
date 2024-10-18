/** @type {HTMLCanvasElement} */
// Create a WebSocket connection to the server
const socket = new WebSocket('wss://e4cb-2001-7e8-f606-fc01-b1bb-7d0b-5b58-6046.ngrok-free.app');

// Handle WebSocket connection events
socket.onopen = () => {
    console.log('Connected to WebSocket server.');
};

socket.onmessage = (event) => {
    console.log('Message from server:', event.data);
    if (event.data === 'sendCanvasImage') {
        sendCanvasImage(); // Call the function to send the canvas image to the server
    }
};

socket.onclose = () => {
    console.log('Disconnected from WebSocket server.');
};

socket.onerror = (error) => {
    console.error('WebSocket error:', error);
};

// Canvas and context setup
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Map and grid configuration
const backgroundImageSrc = "map.png"; // Path to the background image
const desiredRows = 13; // Number of rows for the hex grid

// Zoom and Pan Variables
let cameraOffset = { x: 0, y: 0 };
let cameraZoom = 1;
const MAX_ZOOM = 5;
const MIN_ZOOM = 1;
const SCROLL_SENSITIVITY = 0.0005;

// Mouse and unit tracking
let mouseX = 0;
let mouseY = 0;
let hoveredUnit = null;

// Checkbox elements to toggle display options
const toggleStatsCheckbox = document.getElementById('toggleStats');
let showUnitNames = false;
const toggleNamesCheckbox = document.getElementById('toggleNames');

// Vision range for units
const visionRange = 2;

// Paths to unit images
const unitImages = {
    'Combat Engineers': '/data/assets/units/Combat Engineers.png',
    'Combat Medical Unit': '/data/assets/units/Combat Medical Unit.png',
    'Infantry Unit': '/data/assets/units/Infantry Unit.png',
    'Irregular Unit': '/data/assets/units/Irregular Unit.png',
    'Mechanized Infantry': '/data/assets/units/Mechanized Infantry.png',
    'Power Armored Infantry': '/data/assets/units/Power Armored Infantry.png',
    'Sappers': '/data/assets/units/Sappers.png',
    'Special Forces': '/data/assets/units/Special Forces.png',
    // Enemies
    'Acid Spitters': '/data/assets/enemies/Acid Spitters.png',
    'Brutal Maulers': '/data/assets/enemies/Brutal Maulers.png',
    'Cave Crawlers': '/data/assets/enemies/Cave Crawlers.png',
    'Hive Guardian': '/data/assets/enemies/Hive Guardian.png',
    'Inferno Behemoths': '/data/assets/enemies/Inferno Behemoths.png',
    'Necrotic Swarmers': '/data/assets/enemies/Necrotic Swarmers.png',
    'Ravenous Gnashers': '/data/assets/enemies/Ravenous Gnashers.png',
    'Shadow Stalkers': '/data/assets/enemies/Shadow Stalkers.png',
    'Spore Hurlers': '/data/assets/enemies/Spore Hurlers.png',
    'Winged Terrors': '/data/assets/enemies/Winged Terrors.png',
};

// Object to hold preloaded images
const loadedImages = {};

// Fetch and load player unit data
let units = [];
fetch('/data/players.json')
    .then(response => response.json())
    .then(data => {
        for (const userId in data) {
            const user = data[userId];
            if (user.units && Array.isArray(user.units)) {
                user.units.forEach(unit => {
                    units.push({
                        x: unit.position.x,
                        y: unit.position.y,
                        name: unit.name,
                        type: unit.type,
                        FS: unit.stats.FS,
                        Armor: unit.stats.Armor,
                        Keywords: unit.stats.Keywords
                    });
                });
            }
        }
        preloadImages(loadBackgroundImage); // Preload images, then load the background
    })
    .catch(error => console.error('Error loading unit data:', error));

// Fetch and load enemy data
let liveEnemies = [];
fetch('/data/liveEnemies.json')
    .then(response => response.json())
    .then(data => {
        for (const enemyId in data) {
            const enemy = data[enemyId];
            if (enemy && enemy.position) {
                liveEnemies.push({
                    id: enemy.id,
                    x: enemy.position.x,
                    y: enemy.position.y,
                    name: enemy.id,
                    type: enemy.type,
                    FS: enemy.stats.FS,
                    Armor: enemy.stats.Armor
                });
            }
        }
    })
    .catch(error => console.error('Error loading enemy data:', error));

// Preload unit images
function preloadImages(callback) {
    let loadedCount = 0;
    const totalImages = Object.keys(unitImages).length;

    // Load each image asynchronously
    for (const [unitType, src] of Object.entries(unitImages)) {
        const img = new Image();
        img.src = src;

        // Once an image is loaded or fails to load, increment the count
        img.onload = img.onerror = () => {
            loadedImages[unitType] = img;
            loadedCount++;
            if (loadedCount === totalImages) {
                callback(); // All images loaded, proceed to the next step
            }
        };
    }
}

// Load the background image
let backgroundImage;

function loadBackgroundImage() {
    backgroundImage = new Image();
    backgroundImage.src = backgroundImageSrc;

    backgroundImage.onload = () => {
        draw(); // Start drawing once the background image is loaded
    };

    backgroundImage.onerror = () => {
        console.error('Failed to load background image.');
    };
}

// Draw the background on the canvas
function drawBackground() {
    if (backgroundImage) {
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    }
}

// Main draw function to render the entire canvas
function draw() {
    const canvasWidth = window.innerWidth * 0.9;
    const aspectRatio = backgroundImage.width / backgroundImage.height;
    const canvasHeight = canvasWidth / aspectRatio;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear the canvas before redrawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save the context state for zoom and pan transformations
    ctx.save();
    ctx.translate(cameraOffset.x, cameraOffset.y);
    ctx.scale(cameraZoom, cameraZoom);

    drawBackground(); // Draw the background

    const hexHeight = canvas.height / desiredRows;
    const r = hexHeight / Math.sqrt(3);

    drawHexagonGrid(r, desiredRows); // Draw hex grid
    drawUnits(r); // Draw player units and enemies
    ctx.restore(); // Restore the context state after transformations

    requestAnimationFrame(draw); // Continue the drawing loop
}

// Draw hexagon grid based on the given number of rows and hex size
function drawHexagonGrid(r, numRows) {
    const numColumns = Math.ceil(canvas.width / (1.5 * r));
    const hexHeight = r * Math.sqrt(3);

    ctx.lineWidth = 1 / cameraZoom;

    for (let i = 0; i < numColumns; i++) {
        for (let j = 0; j < numRows; j++) {
            const x = i * 1.5 * r;
            const y = j * hexHeight + (i % 2) * (hexHeight / 2);
            const isVisible = isHexVisible(i, j); // Check visibility
            drawHexagon(x, y, r, i, j, isVisible);
        }
    }
}

// Draw individual hexagons
function drawHexagon(a, b, r, x, y, isVisible = true) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        ctx.lineTo(
            a + r * Math.cos((i * Math.PI) / 3),
            b + r * Math.sin((i * Math.PI) / 3)
        );
    }
    ctx.closePath();
    ctx.stroke();

    // Label the hex with its coordinates
    ctx.font = `${r * 0.2}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${x},${y}`, a, b - r * 0.8);

    // Apply a semi-transparent fill if not visible
    if (!isVisible) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fill();
    }
}

// Check if a hex is visible (within range of any infantry units)
function isHexVisible(hexX, hexY) {
    const hex = { x: hexX, y: hexY };
    return units.some(unit => unit.Keywords.includes("Infantry") && isWithinRange(unit, hex));
}

// Calculate the hex distance between two points (cube coordinate system)
function getHexDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dx + dy));
}

// Draw all units (player and enemy) on the grid
function drawUnits(r) {
    hoveredUnit = null; // Reset hovered unit each frame

    const hexUnitMap = {};
    const visionUnits = units.filter(unit => unit.Keywords && unit.Keywords.includes("Infantry"));

    // Store player units in hexUnitMap
    units.forEach(unit => {
        const key = `${unit.x},${unit.y}`;
        if (!hexUnitMap[key]) hexUnitMap[key] = [];
        hexUnitMap[key].push(unit);
    });

    // Store visible enemies in hexUnitMap
    liveEnemies.forEach(enemy => {
        const isVisible = visionUnits.some(unit => isWithinRange(unit, enemy));
        if (isVisible) {
            const key = `${enemy.x},${enemy.y}`;
            if (!hexUnitMap[key]) hexUnitMap[key] = [];
            hexUnitMap[key].push(enemy);
        }
    });

    // Draw each unit in its respective hex
    Object.keys(hexUnitMap).forEach(hexKey => {
        const [hexX, hexY] = hexKey.split(',').map(Number);
        const unitList = hexUnitMap[hexKey];
        const hexCenterX = hexX * 1.5 * r;
        const hexCenterY = hexY * r * Math.sqrt(3) + (hexX % 2) * (r * Math.sqrt(3) / 2);

        unitList.forEach((unit, index) => {
            drawUnitAt(unit, index, unitList, r, hexCenterX, hexCenterY);
        });
    });

    // Draw hover information if a unit is being hovered over
    if (hoveredUnit) drawUnitInfo(hoveredUnit, r);
}

// Draw individual unit at a given hex center
function drawUnitAt(unit, index, unitList, r, hexCenterX, hexCenterY) {
    // Position units in a circular pattern within the hex
    const angle = (index / unitList.length) * 2 * Math.PI;
    const offsetX = Math.cos(angle) * r * 0.3;
    const offsetY = Math.sin(angle) * r * 0.3;

    const unitX = hexCenterX + offsetX;
    const unitY = hexCenterY + offsetY;

    // Draw the unit's image or placeholder if not available
    const unitImage = loadedImages[unit.type];
    if (unitImage) {
        const imgSize = r;
        ctx.drawImage(unitImage, unitX - imgSize / 2, unitY - imgSize / 2, imgSize, imgSize);
    } else {
        // Draw a placeholder circle if the image is not available
        ctx.beginPath();
        ctx.arc(unitX, unitY, r * 0.3, 0, 2 * Math.PI);
        ctx.fillStyle = "red";
        ctx.fill();
    }

    // Draw stats and names if toggled
    if (toggleStatsCheckbox.checked) drawStats(unit, unitX, unitY, r);
    if (toggleNamesCheckbox.checked) drawNames(unit, unitX, unitY, r, index, unitList.length);

    // Check if the mouse is hovering over this unit using a distance-based approach
    const dx = mouseX - unitX;
    const dy = mouseY - unitY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < r / 2) {  // Adjust r/2 based on the size of your unit for accurate hovering
        hoveredUnit = unit;
    }
}


// Draw unit stats on hover
function drawUnitInfo(unit, r) {
    const x = unit.x * 1.5 * r;
    const y = unit.y * r * Math.sqrt(3) + (unit.x % 2) * (r * Math.sqrt(3) / 2);

    ctx.font = `${r * 0.3}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "red";

    const unitInfoText = `${unit.name}\nFS: ${unit.FS} Armor: ${unit.Armor}`;
    const textWidth = ctx.measureText(unitInfoText).width;
    const textHeight = r * 0.6;

    // Draw background box for the unit information
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(x - textWidth / 2 - 5, y - r * 1.2 - 5, textWidth + 10, textHeight + 20);

    // Draw the unit's name, FS, and Armor stats
    ctx.fillStyle = "white";
    ctx.fillText(unit.name, x, y - r * 1.2);
    ctx.fillText(`FS: ${unit.FS} Armor: ${unit.Armor}`, x, y - r * 0.8);
}

// Draw unit FS and Armor stats
function drawStats(unit, unitX, unitY, r) {
    const fsText = `${unit.FS}`;
    const armorText = `${unit.Armor}`;
    const circleRadius = r * 0.15;
    const circleSpacing = circleRadius;

    // Draw green FS circle
    ctx.beginPath();
    ctx.arc(unitX - circleSpacing, unitY - r * 0.5, circleRadius, 0, 2 * Math.PI);
    ctx.fillStyle = "green";
    ctx.fill();

    // Draw gray Armor circle
    ctx.beginPath();
    ctx.arc(unitX + circleSpacing, unitY - r * 0.5, circleRadius, 0, 2 * Math.PI);
    ctx.fillStyle = "gray";
    ctx.fill();

    // Draw FS and Armor text inside the circles
    ctx.font = `${circleRadius * 1.2}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "white";
    ctx.fillText(fsText, unitX - circleSpacing, unitY - r * 0.5);
    ctx.fillText(armorText, unitX + circleSpacing, unitY - r * 0.5);
}

// Draw unit names
function drawNames(unit, x, y, r, index, totalUnits) {
    ctx.font = `${r * 0.3}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const offsetY = (index / totalUnits) * 20 - 5;

    const unitInfoText = `${unit.name}`;
    const textWidth = ctx.measureText(unitInfoText).width;
    const textHeight = r * 0.6;

    // Draw background for the name
    ctx.fillStyle = "rgba(51, 255, 51, 1)";
    ctx.fillRect(x - textWidth / 2, y - r * 0.1 - 5 + offsetY, textWidth, textHeight - 10);

    // Draw the unit's name
    ctx.fillStyle = "black";
    ctx.fillText(unit.name, x, y - r * 0.1 + offsetY);
}

// Utility function to get event location from mouse or touch
function getEventLocation(e) {
    if (e.touches && e.touches.length == 1) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.clientX && e.clientY) {
        return { x: e.clientX, y: e.clientY };
    }
}

// Dragging and zoom variables
let isDragging = false;
let dragStart = { x: 0, y: 0 };

// Handle pointer down (start dragging)
function onPointerDown(e) {
    isDragging = true;
    dragStart.x = getEventLocation(e).x / cameraZoom - cameraOffset.x;
    dragStart.y = getEventLocation(e).y / cameraZoom - cameraOffset.y;
}

// Handle pointer up (stop dragging)
function onPointerUp() {
    isDragging = false;
}

// Handle pointer move (dragging)
function onPointerMove(e) {
    if (isDragging) {
        cameraOffset.x = getEventLocation(e).x / cameraZoom - dragStart.x;
        cameraOffset.y = getEventLocation(e).y / cameraZoom - dragStart.y;
    }
}

// Handle touch events for drag or pinch zoom
function handleTouch(e, singleTouchHandler) {
    if (e.touches.length == 1) {
        singleTouchHandler(e); // Handle single touch drag
    } else if (e.type === "touchmove" && e.touches.length === 2) {
        isDragging = false;
        handlePinch(e); // Handle pinch zoom
    }
}

// Handle pinch zoom
let lastZoom = cameraZoom;

function handlePinch(e) {
    e.preventDefault();

    let touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    let touch2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };

    let currentDistance = (touch1.x - touch2.x) ** 2 + (touch1.y - touch2.y) ** 2;

    if (!this.initialPinchDistance) {
        this.initialPinchDistance = currentDistance;
    } else {
        adjustZoom(null, currentDistance / this.initialPinchDistance);
    }
}

// Adjust zoom based on scroll or pinch
function adjustZoom(zoomAmount, zoomFactor, zoomCenter) {
    if (!isDragging) {
        const oldZoom = cameraZoom;

        // Adjust the zoom level based on zoomAmount or zoomFactor
        if (zoomAmount) {
            cameraZoom += zoomAmount;
        } else if (zoomFactor) {
            cameraZoom = zoomFactor * lastZoom;
        }

        // Clamp the zoom level between min and max values
        cameraZoom = Math.min(cameraZoom, MAX_ZOOM);
        cameraZoom = Math.max(cameraZoom, MIN_ZOOM);

        // Recalculate offset for zoom centering
        if (zoomCenter) {
            const worldPos = {
                x: (zoomCenter.x - cameraOffset.x) / oldZoom,
                y: (zoomCenter.y - cameraOffset.y) / oldZoom,
            };

            cameraOffset.x = zoomCenter.x - worldPos.x * cameraZoom;
            cameraOffset.y = zoomCenter.y - worldPos.y * cameraZoom;
        }
    }
}

// Mouse and touch event listeners
canvas.addEventListener("mousedown", onPointerDown);
canvas.addEventListener("touchstart", (e) => handleTouch(e, onPointerDown));
canvas.addEventListener("mouseup", onPointerUp);
canvas.addEventListener("touchend", (e) => handleTouch(e, onPointerUp));
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) / cameraZoom - cameraOffset.x / cameraZoom;
    mouseY = (e.clientY - rect.top) / cameraZoom - cameraOffset.y / cameraZoom;
    if (isDragging) {
        onPointerMove(e);
    }
});
canvas.addEventListener("touchmove", (e) => handleTouch(e, onPointerMove));
canvas.addEventListener("wheel", (e) => {
    const zoomCenter = getEventLocation(e);
    adjustZoom(e.deltaY * SCROLL_SENSITIVITY, null, zoomCenter);
});

// Send the canvas image data to the WebSocket server
function sendCanvasImage() {
    const canvas = document.getElementById('canvas');
    if (!canvas) {
        console.error('Canvas element not found.');
        return;
    }

    const imageData = canvas.toDataURL('image/png');
    socket.send(JSON.stringify({ type: 'canvasImage', data: imageData }));

    console.log('Canvas image data sent over WebSocket.');
}

// Utility to convert offset coordinates to cube coordinates (for hex distance calculation)
function offsetToCube(col, row) {
    let x = col;
    let z = row - (col - (col & 1)) / 2;
    let y = -x - z;
    return { x, y, z };
}

// Calculate the distance between two hexes using cube coordinates
function hexDistance(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
}

// Check if an enemy is within range of any player unit
function isWithinRange(playerUnits, enemy, range = visionRange) {
    const enemyCube = offsetToCube(enemy.x, enemy.y);
    const unitsToCheck = Array.isArray(playerUnits) ? playerUnits : [playerUnits];

    for (const unit of unitsToCheck) {
        const unitCube = offsetToCube(unit.x, unit.y);
        if (hexDistance(enemyCube, unitCube) <= range) {
            return true;
        }
    }

    return false;
}
