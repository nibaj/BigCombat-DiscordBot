import fs from 'fs';
import path from 'path';

// Load player data from JSON (or any database in the future)
export function loadPlayerData() {
  try {
    return JSON.parse(fs.readFileSync('public/data/players.json', 'utf-8'));
  } catch (err) {
    console.error('Error loading player data:', err);
    return {};
  }
}

// Save player data to JSON
function savePlayerData(players) {
  fs.writeFileSync('public/data/players.json', JSON.stringify(players, null, 4));
}

// Load predefined units from units.json
export function loadUnits() {
  try {
    return JSON.parse(fs.readFileSync('public/data/units.json'));
  } catch (e) {
    return [];
  }
}

// Create a new unit for a player
export function createUnit(playerId, username, unitName, unitType) {
  const players = loadPlayerData();
  const units = loadUnits();

  // Check if the unitType is valid
  const selectedUnit = units.find(unit => unit.Unit_Name === unitType);
  if (!selectedUnit) {
    return `Invalid unit type "${unitType}". Please choose a valid unit type.`;
  }

  // Check if the player already exists
  if (!players[playerId]) {
    players[playerId] = {
      username: username,
      pay: 0,
      unitLimit: 2,
      units: []
    };
  } else {
    // Update the username if it already exists
    players[playerId].username = username;
  }

  const playerUnits = players[playerId].units;

  // Check if player already has 2 units
  if (playerUnits.length >= players[playerId].playerLimit) {
    return { success: false, message: `You have reached your unit limit of ${players[playerId].playerLimit}.` };
  }

  // Create the new unit and add it to the player's unit list
  const newUnit = {
    name: unitName,      // Custom name from the player
    type: unitType,      // Predefined type from units.json
    position: {
          x: -1,
          y: -1
        },
    stats: selectedUnit, // Inherit stats from the predefined unit
  };

  playerUnits.push(newUnit);
  savePlayerData(players);

  return { success: true };
}

/// Delete a unit from any player's units
export function deleteUnit(unitName) {
  const players = JSON.parse(fs.readFileSync('public/data/players.json', 'utf-8'));
  let unitFound = false;

  // Loop through all players to find and delete the unit
  for (const playerId in players) {
    const player = players[playerId];
    const unitIndex = player.units.findIndex(unit => unit.name.toLowerCase() === unitName.toLowerCase());

    // If the unit is found, remove it
    if (unitIndex !== -1) {
      player.units.splice(unitIndex, 1);
      unitFound = true;
      break; // Exit the loop since we've found and deleted the unit
    }
  }

  // Save the updated data back to the file if a unit was found and deleted
  if (unitFound) {
    fs.writeFileSync('public/data/players.json', JSON.stringify(players, null, 2));
  }

  return { success: unitFound };
}

// Get information about the specified user's units
export function getUserInfo(userId) {
  let players;

  try {
    players = JSON.parse(fs.readFileSync('public/data/players.json', 'utf-8'));
  } catch (error) {
    console.error('Error reading players.json:', error);
    return { success: false };
  }

  // Find the player by userId
  const player = players[userId];

  if (!player || !player.units || player.units.length === 0) {
    console.error('No units found for user:', userId);
    return { success: false };
  }

  // Format the player's units information
  const unitsInfo = player.units.map(unit => {
    return `- **${unit.name}**: ${unit.type}, FS: ${unit.stats.FS}, Position: ${unit.position.x}. ${unit.position.y}`;
  }).join('\n');

  return { success: true, units: unitsInfo };
}
// Get information about a unit by its name
export function getUnitInfo(unitName) {
  let players;

  try {
    players = JSON.parse(fs.readFileSync('public/data/players.json', 'utf-8'));
  } catch (error) {
    console.error('Error reading players.json:', error);
    return { success: false };
  }

  // Iterate through all players and their units to find the specified unit
  for (const playerId in players) {
    const player = players[playerId];
    const unit = player.units.find(unit => unit.name.toLowerCase() === unitName.toLowerCase());

    if (unit) {
      // Format the unit's information
      const unitInfo = `- **Name**: ${unit.name}\n- **Type**: ${unit.type}\n- **Position**: (${unit.position.x}, ${unit.position.y})\n- **FS**: ${unit.stats.FS}\n- **Armor**: ${unit.stats.Armor}\n- **Speed**: ${unit.stats.Speed}\n- **Range**: ${unit.stats.Range}\n- **Upgrade Points**: ${unit.stats.Upgrade_Points}\n- **Special Rule**: ${unit.stats.Special_Rule}\n- **Equipped Equipment**: ${unit.stats.Equipped_Equipment.join(', ') || 'None'}`;

      return { success: true, unitInfo: unitInfo };
    }
  }

  // If unit is not found
  return { success: false };
}


// Save units data to JSON
function saveUnits(units) {
  fs.writeFileSync('public/data/units.json', JSON.stringify(units, null, 4));
}

// Get the player's units by their ID
export function getPlayerUnits(playerId) {
  const players = loadPlayerData();
  const player = players[playerId];

  if (!player || !player.units) {
    return [];
  }

  return player.units;
}

export function loadEquipmentData() {
  try {
    const data = JSON.parse(fs.readFileSync('public/data/equipment.json', 'utf-8'));
    return data;
  } catch (err) {
    console.error('Error loading equipment data:', err);
    return {};
  }
}

// Function to get available equipment for a unit
export function getAvailableEquipment(unit) {
  try {
    const allEquipment = JSON.parse(fs.readFileSync('public/data/equipment.json', 'utf-8'));

    // Ensure that allEquipment is an object
    if (typeof allEquipment !== 'object') {
      console.error('Expected equipment data to be an object but got:', typeof allEquipment);
      return [];  // Return an empty list if the data is not an object
    }

    // Ensure the unit has a type and filter based on allowed units
    if (!unit.type) {
      console.error('Unit type is undefined:', unit);
      return [];  // Return an empty list if no type is defined
    }

    // Create an array to hold available equipment
    const availableEquipment = [];

    // Iterate over the equipment keys
    for (const equipmentName in allEquipment) {
      const equipment = allEquipment[equipmentName];


      // Check if Allowed_Units is defined and is an array
      if (!equipment.Allowed_Units || !Array.isArray(equipment.Allowed_Units)) {
        console.error('Allowed_Units is undefined or not an array for equipment:', equipment);
        continue;  // Skip equipment without Allowed_Units or if it's not an array
      }

      // Check if the unit's type is in the Allowed_Units array
      if (equipment.Allowed_Units.includes(unit.type)) {
        // Add this equipment to the available list
        availableEquipment.push({
          name: equipmentName
        });
      }
    }

    return availableEquipment;

  } catch (err) {
    console.error('Error loading equipment data:', err);
    return [];  // Return an empty list in case of error
  }
}

// Function to upgrade a unit with selected equipment
export function upgradeUnitWithEquipment(playerId, unitName, equipmentName) {
  // Load the player data
  const players = JSON.parse(fs.readFileSync('public/data/players.json', 'utf-8'));

  // Find the player
  const player = players[playerId];
  if (!player) {
    return `Player not found.`;
  }

  // Find the unit
  const unit = player.units.find(u => u.name.toLowerCase() === unitName.toLowerCase());
  if (!unit) {
    return `Unit "${unitName}" not found.`;
  }

  // Load equipment data
  const equipmentData = JSON.parse(fs.readFileSync('public/data/equipment.json', 'utf-8'));
  const equipment = equipmentData[equipmentName];
  if (!equipment) {
    return `Equipment "${equipmentName}" not found.`;
  }

  // Check if the equipment is allowed for the unit
  if (!equipment.Allowed_Units.includes(unit.type)) {
    return `Equipment "${equipmentName}" is not allowed for unit "${unitName}".`;
  }

  // Check if the unit has enough upgrade points to equip this item
  if (unit.stats.Upgrade_Points < equipment.Cost) {
    return `Unit "${unitName}" does not have enough upgrade points to equip "${equipmentName}".`;
  }

  // Deduct the upgrade points
  unit.stats.Upgrade_Points -= equipment.Cost;

  // Add the equipment to the unit's Equipped_Equipment array
  unit.stats.Equipped_Equipment = unit.stats.Equipped_Equipment || [];
  unit.stats.Equipped_Equipment.push(equipmentName);

  // Save the updated player data back to the file
  fs.writeFileSync('public/data/players.json', JSON.stringify(players, null, 2));

  return `Successfully upgraded unit "${unitName}" with equipment "${equipmentName}".`;
}

export function updateUnitPosition(playerId, unitName, newQ, newR) {
  const players = JSON.parse(fs.readFileSync('public/data/players.json', 'utf-8'));

  const player = players[playerId];
  if (!player) {
    throw new Error(`Player ${playerId} not found.`);
  }

  const unit = player.units.find(u => u.name.toLowerCase() === unitName.toLowerCase());
  if (!unit) {
    throw new Error(`Unit "${unitName}" not found.`);
  }

  // Update unit's position in axial coordinates
  unit.position = { x: newQ, y: newR };

  // Save the updated data back to the file
  fs.writeFileSync('public/data/players.json', JSON.stringify(players, null, 2));
}

// https://www.redblobgames.com/grids/hexagons-v1/
export function isWithinReach2(currentQ, currentR, targetQ, targetR, speed) {
  // Define current and target hexes
  const currentHex = { col: currentQ, row: currentR };
  const targetHex = { col: targetQ, row: targetR };

  // Calculate the distance using offset coordinates
  const distance = offsetDistance(currentHex, targetHex);

  console.log(`Current Hex: (${currentQ}, ${currentR}), Target Hex: (${targetQ}, ${targetR})`);
  console.log(`Calculated distance: ${distance}, Speed: ${speed}`);

  // Return whether the distance is within the unit's speed
  return distance <= speed;
}
// Calculate distance between two hexes using cube coordinates
function offsetDistance(a, b) {
  const ac = evenqToCube(a);
  const bc = evenqToCube(b);
  return cubeDistance(ac, bc);
}
// Cube distance calculation
function cubeDistance(cube1, cube2) {
  return Math.max(
    Math.abs(cube1.x - cube2.x),
    Math.abs(cube1.y - cube2.y),
    Math.abs(cube1.z - cube2.z)
  );
}
// Converts even-q offset coordinates to cube coordinates
function evenqToCube(hex) {
  const x = hex.col;
  const z = hex.row - Math.floor((hex.col + (hex.col & 1)) / 2);
  const y = -x - z;
  return { x, y, z };
}

// Path to liveEnemies.json
const enemiesFilePath = 'public/data/liveEnemies.json';
const predefinedEnemiesPath = 'public/data/enemies.json';

// Load live enemies data
export function loadEnemiesData() {
    if (fs.existsSync(enemiesFilePath)) {
        return JSON.parse(fs.readFileSync(enemiesFilePath, 'utf8'));
    } else {
        return {};
    }
}

// Save live enemies data
export function saveEnemiesData(data) {
    fs.writeFileSync(enemiesFilePath, JSON.stringify(data, null, 2));
}

// Load predefined enemies from enemies.json
function loadPredefinedEnemies() {
    try {
        return JSON.parse(fs.readFileSync(predefinedEnemiesPath, 'utf8'));
    } catch (err) {
        console.error('Error loading predefined enemies:', err);
        return {};
    }
}

// Function to create a live enemy based on predefined enemies
export function createLiveEnemy(type, position) {
    const predefinedEnemies = loadPredefinedEnemies();

    // Ensure predefinedEnemies is an array
    if (!Array.isArray(predefinedEnemies)) {
        return { success: false, message: 'Enemy data is invalid.' };
    }

    // Adjust to search by "Enemy_Name"
    const enemyData = predefinedEnemies.find(enemy => enemy.Enemy_Name === type);
    if (!enemyData) {
        return { success: false, message: `Enemy type "${type}" not found.` };
    }

    // Generate a unique ID for the enemy
    const enemyID = `enemy_${Date.now()}`;

    const newEnemy = {
        id: generateUniqueEnemyID(enemyData.Enemy_Name),
        type: enemyData.Enemy_Name,
        position: {
            x: position.x,
            y: position.y
        },
        stats: {
            FS: enemyData.FS,
            Armor: enemyData.Armor,
            Speed: enemyData.Speed,
            Range: enemyData.Range,
            AP: enemyData.AP,
            Keywords: enemyData.Keywords
        }
    };

    // Load live enemies from the liveEnemies.json file
    const liveEnemies = loadEnemiesData();
    liveEnemies[newEnemy.id] = newEnemy;

    saveEnemiesData(liveEnemies);

    return { success: true, enemyData: newEnemy, enemyID: newEnemy.id };
}

// Get a list of all available enemy types
export function getEnemyTypes() {
    const predefinedEnemies = loadPredefinedEnemies();
    // Adjust to return "Enemy_Name"
    return predefinedEnemies.map(enemy => enemy.Enemy_Name);
}
// Generate unique enemy ID
function generateUniqueEnemyID(type) {
    // Use a combination of timestamp and a random number to ensure uniqueness
    return type+`_${Math.floor(Math.random() * 1000)}`;
}
// Example function to update an enemy's position
export function updateEnemyPosition(enemyID, newPosition) {
    const liveEnemies = loadEnemiesData();

    const enemy = liveEnemies[enemyID];
    if (!enemy) {
        return { success: false, message: `Enemy with ID "${enemyID}" not found.` };
    }

    // Get the enemy's current position and speed
    const currentPosition = enemy.position;
    const speed = enemy.stats.Speed;

    if (!speed) {
        return { success: false, message: `Enemy with ID ${enemyID} does not have a defined speed.` };
    }

    if (isWithinReach(currentPosition.x, currentPosition.y, newPosition.x, newPosition.y, speed)) {
        // Update enemy's position
        enemy.position = newPosition;
        saveEnemiesData(liveEnemies); // Save updated enemy positions
        return { success: true, newPosition: newPosition };
    } else {
        return { success: false, message: `Target position (${newPosition.x}, ${newPosition.y}) is too far. Enemy can only move ${speed} hexes.` };
    }
}

// Example function to update an enemy's stats (e.g., after taking damage)
export function updateEnemyStats(enemyID, updatedStats) {
    const liveEnemies = loadEnemiesData();

    if (!liveEnemies[enemyID]) {
        return { success: false, message: `Enemy with ID "${enemyID}" not found.` };
    }

    Object.assign(liveEnemies[enemyID].stats, updatedStats);
    saveEnemiesData(liveEnemies);

    return { success: true };
}

// Load map data from the file
function loadMapData() {
    try {
    return JSON.parse(fs.readFileSync('public/data/map.json', 'utf-8'));
  } catch (err) {
    console.error('Error loading map data:', err);
    return {};
  }
}

// Load terrain rules data
function loadTerrainRules() {
    try {
    return JSON.parse(fs.readFileSync('public/data/terrain_rules.json', 'utf-8'));
  } catch (err) {
    console.error('Error loading terrain_rules data:', err);
    return {};
  }
}

// Helper function: Get the terrain cost based on the unit and hex
function getHexTerrainCost(hex, unit, terrainRules) {
    const terrain = hex.terrain;
    const unitKeywords = unit.stats.Keywords;

    const terrainInfo = terrainRules.hex_terrain[terrain];

    if (!terrainInfo) {
        return 1; // Default movement cost if no terrain data is found
    }

    // Check if the terrain is ignored or blocked by the unit's keywords
    if (unitKeywords.some(keyword => terrainInfo.blocked_by.includes(keyword))) {
        return Infinity; // The unit is blocked by the terrain
    }

    if (unitKeywords.some(keyword => terrainInfo.ignored_by.includes(keyword))) {
        return 1; // The unit ignores the terrain cost
    }

    return 2; // Default extra movement cost for entering certain terrains
}

// Helper function: Get edge cost based on the unit and edge features
function getEdgeTerrainCost(edge, unit, terrainRules) {
    const feature = edge.feature;
    const unitKeywords = unit.stats.Keywords;

    const edgeInfo = terrainRules.edges[feature];

    if (!edgeInfo) {
        return 1; // Default movement cost if no edge data is found
    }

    // Check if the edge feature is ignored or blocked by the unit's keywords
    if (unitKeywords.some(keyword => edgeInfo.blocked_by.includes(keyword))) {
        return Infinity; // The unit is blocked by the edge
    }

    if (unitKeywords.some(keyword => edgeInfo.ignored_by.includes(keyword))) {
        return 1; // The unit ignores the edge cost
    }

    return 2; // Default extra movement cost for crossing certain edges
}

// Helper function to get neighboring hexes
function getNeighbors(hex, mapData) {
    const directions = [
        { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, // NE, E, SE
        { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }  // SW, W, NW
    ];

    return directions.map(dir => {
        const neighbor = mapData.hexes.find(h => h.q === hex.q + dir.q && h.r === hex.r + dir.r);
        return neighbor || null; // Return null if no neighbor found
    }).filter(Boolean); // Remove null neighbors
}

// Main pathfinding function for the hex grid
function calculatePath(startHex, targetHex, unit, mapData, terrainRules) {
    const visited = new Set();
    const queue = [{ hex: startHex, distance: 0 }];
    const maxSpeed = unit.stats.Speed;

    while (queue.length > 0) {
        const { hex, distance } = queue.shift();

        // If the target hex is reached within the speed limit, return true
        if (hex.q === targetHex.q && hex.r === targetHex.r) {
            return distance <= maxSpeed;
        }

        // Get neighboring hexes
        const neighbors = getNeighbors(hex, mapData);
        console.log(neighbors)
        neighbors.forEach(neighbor => {
            // Check for edge terrain costs
            const edge = mapData.edges.find(edge => edge.q === hex.q && edge.r === hex.r && edge.direction === getDirection(hex, neighbor));
            const terrainCost = getHexTerrainCost(neighbor, unit, terrainRules);
            const edgeCost = edge ? getEdgeTerrainCost(edge, unit, terrainRules) : 1;
            const totalCost = terrainCost + edgeCost;

            console.log(terrainCost, edgeCost)
            // Add to the queue if the distance is within the unit's speed
            const key = `${neighbor.q},${neighbor.r}`;
            if (!visited.has(key) && distance + totalCost <= maxSpeed) {
                visited.add(key);
                queue.push({ hex: neighbor, distance: distance + totalCost });
            }
        });
    }

    return false; // If no path found within speed, return false
}

// Helper function to determine direction between two hexes
function getDirection(fromHex, toHex) {
    const qDiff = toHex.q - fromHex.q;
    const rDiff = toHex.r - fromHex.r;

    if (qDiff === 1 && rDiff === 0) return 'NE';
    if (qDiff === 1 && rDiff === -1) return 'SE';
    if (qDiff === 0 && rDiff === -1) return 'S';
    if (qDiff === -1 && rDiff === 0) return 'SW';
    if (qDiff === -1 && rDiff === 1) return 'NW';
    if (qDiff === 0 && rDiff === 1) return 'N';
    return null;
}

// Function to check if the unit can move to the target hex
export function isWithinReach(unit, startHex, targetHex) {
    const mapData = loadMapData();
    const terrainRules = loadTerrainRules();
    return calculatePath(startHex, targetHex, unit, mapData, terrainRules);
}
