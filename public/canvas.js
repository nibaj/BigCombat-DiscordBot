/** @type {HTMLCanvasElement} */
// Create a WebSocket connection to the server
const socket = new WebSocket('wss://e4cb-2001-7e8-f606-fc01-b1bb-7d0b-5b58-6046.ngrok-free.app');

// Handle the connection open event
socket.onopen = () => {
    console.log('Connected to WebSocket server.');
};

// Handle messages received from the server
socket.onmessage = (event) => {
    console.log('Message from server:', event.data);
    if (event.data === 'sendCanvasImage') {
        console.log('Received command to send canvas image.');
        sendCanvasImage(); // Call the function to send the canvas image to the server
    }
};

// Handle the connection close event
socket.onclose = () => {
    console.log('Disconnected from WebSocket server.');
};

// Handle errors
socket.onerror = (error) => {
    console.error('WebSocket error:', error);
};


const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const backgroundImageSrc = "map.png"; // Path to your background image
const desiredRows = 13; // Number of rows for the hex grid

// Zoom and Pan Variables
let cameraOffset = { x: 0, y: 0 };
let cameraZoom = 1;
const MAX_ZOOM = 5;
const MIN_ZOOM = 1;
const SCROLL_SENSITIVITY = 0.0005;
// Unit information
let mouseX = 0;
let mouseY = 0;
let hoveredUnit = null;

// Unit images paths
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

// Load unit data from the JSON file
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

        preloadImages(() => {
            loadBackgroundImage(); // Background image is loaded, and then `draw()` will be called inside.
        });
    })
    .catch(error => console.error('Error loading unit data:', error));

// Load enemies data from the JSON file
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
    .catch(error => console.error('Error loading unit data:', error));


// Preload unit images
function preloadImages(callback) {
    let loadedCount = 0;
    const totalImages = Object.keys(unitImages).length;

    for (const [unitType, src] of Object.entries(unitImages)) {
        const img = new Image();
        img.src = src;

        img.onload = () => {
            loadedImages[unitType] = img;
            loadedCount++;
            if (loadedCount === totalImages) {
                callback();
            }
        };

        img.onerror = () => {
            console.error(`Failed to load image for unit: ${unitType}, source: ${src}`);
            loadedCount++;
            if (loadedCount === totalImages) {
                callback();
            }
        };
    }
}

// Global variable for the background image
let backgroundImage;

// Load the background image
function loadBackgroundImage() {
    backgroundImage = new Image();
    backgroundImage.src = backgroundImageSrc;

    backgroundImage.onload = () => {
        draw(); // Ensure we draw the canvas once the background is loaded
    };

    backgroundImage.onerror = () => {
        console.error('Failed to load background image.');
    };
}

// Function to draw the background image
function drawBackground() {
    if (backgroundImage) {
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    }
}

// Main draw function
function draw() {
    // Ensure the background image has been loaded before drawing
    if (!backgroundImage || !backgroundImage.width || !backgroundImage.height) {
        return; // Exit the draw function if the image is not loaded
    }

    // Set canvas size to 90% of the window's dimensions
    const canvasWidth = window.innerWidth * 0.9;

    // Calculate canvas height based on the background image's aspect ratio
    const aspectRatio = backgroundImage.width / backgroundImage.height;
    const canvasHeight = canvasWidth / aspectRatio;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transformations for zoom and panning
    ctx.save();  // Save the current context state
    ctx.translate(cameraOffset.x, cameraOffset.y);
    ctx.scale(cameraZoom, cameraZoom);

    // Draw the background (apply transformations for zoom and panning)
    drawBackground();

    // Calculate hex size based on the canvas height and the desired number of rows
    const hexHeight = canvas.height / desiredRows;
    const r = hexHeight / Math.sqrt(3);  // Hex size to fit the grid within the canvas

    // Draw the hexagon grid on top of the background
    drawHexagonGrid(r, desiredRows);

    // Draw the units
    drawUnits(r);

    ctx.restore();  // Restore the context to its original state
    requestAnimationFrame(draw);
}

// Function to draw hexagon grid
function drawHexagonGrid(r, numRows) {
    // Calculate the number of columns based on the canvas width and hex size
    const numColumns = Math.ceil(canvas.width / (1.5 * r));
    const hexHeight = r * Math.sqrt(3);

    // Use fixed line width to maintain consistent appearance
    ctx.lineWidth = 1 / cameraZoom;

    for (let i = 0; i < numColumns; i++) {
        for (let j = 0; j < numRows; j++) {
            const x = i * 1.5 * r;
            const y = j * hexHeight + (i % 2) * (hexHeight / 2);
            drawHexagon(x, y, r, i, j);
        }
    }
}


// Function to draw a single hexagon
function drawHexagon(a, b, r, x, y) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        ctx.lineTo(
            a + r * Math.cos((i * Math.PI) / 3),
            b + r * Math.sin((i * Math.PI) / 3)
        );
    }
    ctx.closePath();
    ctx.stroke();

    ctx.font = `${r * 0.2}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${x},${y}`, a,  b - r * 0.8);
}

// Function to draw units on the grid
function drawUnits(r) {
    hoveredUnit = null; // Reset hovered unit each frame

    // Create a map to store units in each hex
    const hexUnitMap = {};

    // Store only units with "Infantry" keyword for vision
    const visionUnits = units.filter(unit => unit.Keywords && unit.Keywords.includes("Infantry"));

    // Populate the hexUnitMap for player units
    units.forEach((unit) => {
        const key = `${unit.x},${unit.y}`; // Use hex coordinates as the key
        if (!hexUnitMap[key]) {
            hexUnitMap[key] = [];
        }
        hexUnitMap[key].push(unit);
    });

    liveEnemies.forEach((enemy) => {
        const enemyPos = { x: enemy.x, y: enemy.y };
        let isVisible = false;

        // Check if any "Infantry" units are within 2 hexes of this enemy
        visionUnits.forEach(unit => {
            const unitPos = { x: unit.x, y: unit.y };
            if (isWithinRange(unitPos, enemyPos)) {
                isVisible = true;
            }
        });
        if (isVisible) {
            const key = `${enemy.x},${enemy.y}`; // Use hex coordinates as the key
            if (!hexUnitMap[key]) {
                hexUnitMap[key] = [];
            }
            hexUnitMap[key].push(enemy);
        }
    });

    // Now, draw player units
    Object.keys(hexUnitMap).forEach((hexKey) => {
        const [hexX, hexY] = hexKey.split(',').map(Number);
        const unitList = hexUnitMap[hexKey];

        // Calculate the center position of the hex
        const hexCenterX = hexX * 1.5 * r;
        const hexCenterY = hexY * r * Math.sqrt(3) + (hexX % 2) * (r * Math.sqrt(3) / 2);

        // Distribute player units in the hex
        unitList.forEach((unit, index) => {
            drawUnitAt(unit, index, unitList, r, hexCenterX, hexCenterY);
        });
    });

    // Draw information for the hovered unit
    if (hoveredUnit) {
        drawUnitInfo(hoveredUnit, r);
    }
}

// Function to draw a unit at a given hex center with optional distribution
function drawUnitAt(unit, index, unitList, r, hexCenterX, hexCenterY) {
    // Distribute units in a circular pattern around the hex center
    const angle = (index / unitList.length) * 2 * Math.PI; // Evenly distribute units in a circle
    const offsetX = Math.cos(angle) * r * 0.3; // Adjust offset magnitude
    const offsetY = Math.sin(angle) * r * 0.3; // Adjust offset magnitude

    // Calculate the final position for this unit
    const unitX = hexCenterX + offsetX;
    const unitY = hexCenterY + offsetY;

    // Draw the unit image if available
    const unitImage = loadedImages[unit.type];
    if (unitImage) {
        const imgSize = r; // Size of the image
        ctx.drawImage(unitImage, unitX - imgSize / 2, unitY - imgSize / 2, imgSize, imgSize);
    } else {
        // Draw a placeholder circle if the image is not available
        ctx.beginPath();
        ctx.arc(unitX, unitY, r * 0.3, 0, 2 * Math.PI);
        ctx.fillStyle = "red";
        ctx.fill();
    }

    // Check if the mouse is hovering over this unit
    const dx = mouseX - unitX;
    const dy = mouseY - unitY;
    if (Math.sqrt(dx * dx + dy * dy) < r) {
        hoveredUnit = unit; // Store the hovered unit
    }
}


// Function to draw unit information on hover
function drawUnitInfo(unit, r) {
    const x = unit.x * 1.5 * r;
    const y = unit.y * r * Math.sqrt(3) + (unit.x % 2) * (r * Math.sqrt(3) / 2);

    // Set text properties
    ctx.font = `${r * 0.3}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "red";

    // Prepare the unit information text
    const unitInfoText = `${unit.name}\nFS: ${unit.FS} Armor: ${unit.Armor}`;

    // Calculate the background size based on text metrics
    const textWidth = ctx.measureText(unitInfoText).width;
    const textHeight = r * 0.6; // Adjust as needed for spacing

    // Set the background properties
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)"; // Semi-transparent black
    ctx.fillRect(x - textWidth / 2 - 5, y - r * 1.2 - 5, textWidth + 10, textHeight + 20);

    // Draw unit name
    ctx.fillStyle = "white"; // Set text color to white
    ctx.fillText(unit.name, x, y - r * 1.2);

    // Draw FS and Armor
    ctx.fillText(`FS: ${unit.FS} Armor: ${unit.Armor}`, x, y - r * 0.8);

}


// Gets the relevant location from a mouse or single touch event
function getEventLocation(e) {
    if (e.touches && e.touches.length == 1) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.clientX && e.clientY) {
        return { x: e.clientX, y: e.clientY };
    }
}

let isDragging = false;
let dragStart = { x: 0, y: 0 };

function onPointerDown(e) {
    isDragging = true;
    dragStart.x = getEventLocation(e).x / cameraZoom - cameraOffset.x;
    dragStart.y = getEventLocation(e).y / cameraZoom - cameraOffset.y;
}

function onPointerUp(e) {
    isDragging = false;
    initialPinchDistance = null;
    lastZoom = cameraZoom;
}

function onPointerMove(e) {
    if (isDragging) {
        cameraOffset.x = getEventLocation(e).x / cameraZoom - dragStart.x;
        cameraOffset.y = getEventLocation(e).y / cameraZoom - dragStart.y;
    }
}

function handleTouch(e, singleTouchHandler) {
    if (e.touches.length == 1) {
        singleTouchHandler(e);
    } else if (e.type == "touchmove" && e.touches.length == 2) {
        isDragging = false;
        handlePinch(e);
    }
}

let initialPinchDistance = null;
let lastZoom = cameraZoom;

function handlePinch(e) {
    e.preventDefault();

    let touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    let touch2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };

    // This is distance squared, but no need for an expensive sqrt as it's only used in ratio
    let currentDistance = (touch1.x - touch2.x) ** 2 + (touch1.y - touch2.y) ** 2;

    if (initialPinchDistance == null) {
        initialPinchDistance = currentDistance;
    } else {
        adjustZoom(null, currentDistance / initialPinchDistance);
    }
}

function adjustZoom(zoomAmount, zoomFactor, zoomCenter) {
    if (!isDragging) {
        const oldZoom = cameraZoom;

        // Adjust the zoom level
        if (zoomAmount) {
            cameraZoom += zoomAmount;
        } else if (zoomFactor) {
            cameraZoom = zoomFactor * lastZoom;
        }

        // Clamp the zoom level to the min/max limits
        cameraZoom = Math.min(cameraZoom, MAX_ZOOM);
        cameraZoom = Math.max(cameraZoom, MIN_ZOOM);

        // Calculate the scale factor between the old and new zoom
        const zoomScale = cameraZoom / oldZoom;

        // Apply the zoom centered around the zoomCenter (mouse position)
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


// Handle mouse and touch events for panning and zooming
canvas.addEventListener("mousedown", onPointerDown);
canvas.addEventListener("touchstart", (e) => handleTouch(e, onPointerDown));
canvas.addEventListener("mouseup", onPointerUp);
canvas.addEventListener("touchend", (e) => handleTouch(e, onPointerUp));
canvas.addEventListener("mousemove", onPointerMove);
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();

    // Adjust mouse coordinates for zoom and pan
    mouseX = (e.clientX - rect.left) / cameraZoom - cameraOffset.x / cameraZoom;
    mouseY = (e.clientY - rect.top) / cameraZoom - cameraOffset.y / cameraZoom;
});
canvas.addEventListener("touchmove", (e) => handleTouch(e, onPointerMove));
canvas.addEventListener("wheel", (e) => {
    const zoomCenter = getEventLocation(e);
    adjustZoom(e.deltaY * SCROLL_SENSITIVITY, null, zoomCenter);
});

function sendCanvasImage() {
    const canvas = document.getElementById('canvas');
    if (!canvas) {
        console.error('Canvas element not found.');
        return;
    }

    // Convert the canvas content to a data URL (base64 string)
    const imageData = canvas.toDataURL('image/png');

    // Send the base64 string over the WebSocket to the server
    socket.send(JSON.stringify({ type: 'canvasImage', data: imageData }));

    console.log('Canvas image data sent over WebSocket.');
}

// Convert offset (even-q) coordinates to cube coordinates
function offsetToCube(col, row) {
    let x = col;
    let z = row - (col - (col & 1)) / 2;
    let y = -x - z;
    return { x, y, z };
}

// Calculate distance between two hexes in cube coordinates
function hexDistance(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
}

// Check if the enemy is within 2 hexes of any player unit
function isWithinRange(playerUnits, enemy, range = 2) {
    const enemyCube = offsetToCube(enemy.x, enemy.y);

    if( typeof playerUnits == "object"){
        const unitCube = offsetToCube(playerUnits.x, playerUnits.y);
        if (hexDistance(enemyCube, unitCube) <= range) {
            return true;  // Enemy is within range
        }
    } else {
        for (const unit of playerUnits) {
            const unitCube = offsetToCube(unit.x, unit.y);
            if (hexDistance(enemyCube, unitCube) <= range) {
                return true;  // Enemy is within range
            }
        }
    }

    return false;  // Enemy is not in range of any player unit
}
