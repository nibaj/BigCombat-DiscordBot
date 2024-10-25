import fs from 'fs';
import path from 'path';

/* ==========================
   PLAYER AND UNIT MANAGEMENT
   ========================== */

/* Load player data from JSON file. */
export function loadPlayerData() {
  try {
    return JSON.parse(fs.readFileSync('public/data/players.json', 'utf-8'));
  } catch (err) {
    console.error('Error loading player data:', err);
    return {};
  }
}

/* Save player data to JSON file. */
function savePlayerData(players) {
  fs.writeFileSync('public/data/players.json', JSON.stringify(players, null, 4));
}

/* Load predefined units from units.json */
export function loadUnits() {
  try {
    return JSON.parse(fs.readFileSync('public/data/units.json'));
  } catch (e) {
    return [];
  }
}

/* Save units data to JSON */
function saveUnits(units) {
  fs.writeFileSync('public/data/units.json', JSON.stringify(units, null, 4));
}

/* Create a new unit for a player. */
export function createUnit(playerId, username, unitName, unitType) {
  const players = loadPlayerData();
  const units = loadUnits();

  const selectedUnit = units.find(unit => unit.Unit_Name === unitType);
  if (!selectedUnit) {
    return `Invalid unit type "${unitType}". Please choose a valid unit type.`;
  }

  if (!players[playerId]) {
    players[playerId] = { username, pay: 0, unitLimit: 2, units: [] };
  } else {
    players[playerId].username = username;
  }

  const playerUnits = players[playerId].units;
  if (playerUnits.length >= players[playerId].unitLimit) {
    return { success: false, message: `You have reached your unit limit of ${players[playerId].unitLimit}.` };
  }

  const newUnit = { name: unitName, type: unitType, position: { x: -1, y: -1 }, stats: selectedUnit };
  playerUnits.push(newUnit);
  savePlayerData(players);

  return { success: true };
}

/* Delete a unit by name from any player's units. */
export function deleteUnit(unitName) {
  const players = loadPlayerData();
  let unitFound = false;

  for (const playerId in players) {
    const player = players[playerId];
    const unitIndex = player.units.findIndex(unit => unit.name.toLowerCase() === unitName.toLowerCase());
    if (unitIndex !== -1) {
      player.units.splice(unitIndex, 1);
      unitFound = true;
      break;
    }
  }

  if (unitFound) savePlayerData(players);
  return { success: unitFound };
}

/* Retrieve information about a player's units based on userId. */
export function getUserInfo(userId) {
  const players = loadPlayerData();
  const player = players[userId];
  if (!player || !player.units || player.units.length === 0) return { success: false };

  const unitsInfo = player.units.map(unit =>
    `- **${unit.name}**: ${unit.type}, FS: ${unit.stats.FS}, Position: ${unit.position.x}, ${unit.position.y}`
  ).join('\n');

  return { success: true, units: unitsInfo };
}

/* Get details of a unit by name, including type and stats. */
export function getUnitInfo(unitName) {
  const players = loadPlayerData();

  for (const playerId in players) {
    const player = players[playerId];
    const unit = player.units.find(unit => unit.name.toLowerCase() === unitName.toLowerCase());
    if (unit) {
      const unitInfo = `- **Name**: ${unit.name}\n- **Type**: ${unit.type}\n- **Position**: (${unit.position.x}, ${unit.position.y})\n- **FS**: ${unit.stats.FS}\n- **Armor**: ${unit.stats.Armor}\n- **Speed**: ${unit.stats.Speed}\n- **Range**: ${unit.stats.Range}\n- **Upgrade Points**: ${unit.stats.Upgrade_Points}\n- **Special Rule**: ${unit.stats.Special_Rule}\n- **Equipped Equipment**: ${unit.stats.Equipped_Equipment.join(', ') || 'None'}`;
      return { success: true, unitInfo };
    }
  }

  return { success: false };
}

/* Get player's units by playerId */
export function getPlayerUnits(playerId) {
  const players = loadPlayerData();
  const player = players[playerId];
  return player && player.units ? player.units : [];
}

/* Update the position of a specific unit */
export function updateUnitPosition(playerId, unitName, newQ, newR) {
  const players = loadPlayerData();
  const player = players[playerId];
  if (!player) throw new Error(`Player ${playerId} not found.`);

  const unit = player.units.find(u => u.name.toLowerCase() === unitName.toLowerCase());
  if (!unit) throw new Error(`Unit "${unitName}" not found.`);

  unit.position = { x: newQ, y: newR };
  savePlayerData(players);
}

/* ==========================
   EQUIPMENT MANAGEMENT
   ========================== */

/* Load available equipment data from equipment.json */
export function loadEquipmentData() {
  try {
    return JSON.parse(fs.readFileSync('public/data/equipment.json', 'utf-8'));
  } catch (err) {
    console.error('Error loading equipment data:', err);
    return {};
  }
}

/* Get available equipment for a unit type, filtered by Allowed_Units. */
export function getAvailableEquipment(unit) {
  const allEquipment = loadEquipmentData();
  const availableEquipment = [];

  for (const equipmentName in allEquipment) {
    const equipment = allEquipment[equipmentName];
    if (equipment.Allowed_Units?.includes(unit.type)) {
      availableEquipment.push({ name: equipmentName });
    }
  }

  return availableEquipment;
}

/* Upgrade a unit with specified equipment */
export function upgradeUnitWithEquipment(playerId, unitName, equipmentName) {
  const players = loadPlayerData();
  const player = players[playerId];
  if (!player) return `Player not found.`;

  const unit = player.units.find(u => u.name.toLowerCase() === unitName.toLowerCase());
  if (!unit) return `Unit "${unitName}" not found.`;

  const equipmentData = loadEquipmentData();
  const equipment = equipmentData[equipmentName];
  if (!equipment) return `Equipment "${equipmentName}" not found.`;

  if (!equipment.Allowed_Units.includes(unit.type)) return `Equipment "${equipmentName}" is not allowed for unit "${unitName}".`;

  if (unit.stats.Upgrade_Points < equipment.Cost && players[playerId].pay < (equipment.Cost * 10)) {
    return `Unit "${unitName}" does not have enough upgrade points or Pay to equip "${equipmentName}".`;
  }

  if (unit.stats.Upgrade_Points >= equipment.Cost) {
    unit.stats.Upgrade_Points -= equipment.Cost;
  } else {
    players[playerId].pay -= equipment.Cost * 10;
  }

  unit.stats.Equipped_Equipment = unit.stats.Equipped_Equipment || [];
  unit.stats.Equipped_Equipment.push(equipmentName);
  savePlayerData(players);

  return `Successfully upgraded unit "${unitName}" with equipment "${equipmentName}".`;
}

/* ==========================
   GAME PERIOD MANAGEMENT
   ========================== */

let currentPeriodActive = true;
let currentPeriodId = 1;
let periodEndTime = null;

/* Start a new game period manually */
export function startNewPeriod() {
  const now = new Date();
  const currentDay = now.getDay();
  const daysUntilSunday = (7 - currentDay) % 7;
  const daysUntilWednesday = (3 - currentDay + 7) % 7;

  const daysUntilNextPeriod = daysUntilSunday === 0 || (daysUntilWednesday !== 0 && daysUntilWednesday < daysUntilSunday)
      ? daysUntilWednesday
      : daysUntilSunday;

  periodEndTime = new Date(now.getTime() + (daysUntilNextPeriod * 24 * 60 * 60 * 1000));
  periodEndTime.setHours(0, 0, 0, 0);

  currentPeriodActive = true;
  currentPeriodId += 1;

  const unixTimestamp = Math.floor(periodEndTime.getTime() / 1000);
  return `New period started. Period will end at <t:${unixTimestamp}:F>`;
}

/* Get the current period ID */
function getCurrentPeriod() {
  const now = new Date();
  if (periodEndTime && now >= periodEndTime) currentPeriodActive = false;
  return currentPeriodActive ? currentPeriodId : null;
}

/* Check if a unit can execute a command based on its move history and the active period */
export function canExecuteCommand(playerId, unitName, commandName) {
  const players = loadPlayerData();
  const player = players[playerId];
  const unit = player.units.find(u => u.name.toLowerCase() === unitName.toLowerCase());
  if (!unit) throw new Error(`Unit "${unitName}" not found.`);

  const currentPeriod = getCurrentPeriod();
  const allowedMoves = unit.stats.Keywords.includes("SplitMove") ? 2 : 1;

  unit.commandHistory = unit.commandHistory || {};
  unit.commandHistory[commandName] = unit.commandHistory[commandName] || { period: currentPeriod, uses: 0 };

  const history = unit.commandHistory[commandName];
  if (history.period === currentPeriod) {
    if (history.uses >= allowedMoves) {
      return { canExecute: false, message: `⏳ This unit has already used ${commandName} ${allowedMoves} times during this period.` };
    } else {
      history.uses++;
    }
  } else {
    unit.commandHistory[commandName] = { period: currentPeriod, uses: 1 };
  }

  savePlayerData(players);
  return { canExecute: true };
}

/* ==========================
   ENEMY MANAGEMENT
   ========================== */

// Paths to enemy data files
const enemiesFilePath = 'public/data/liveEnemies.json';
const predefinedEnemiesPath = 'public/data/enemies.json';

/* Load live enemies data from file */
export function loadEnemiesData() {
  return fs.existsSync(enemiesFilePath) ? JSON.parse(fs.readFileSync(enemiesFilePath, 'utf8')) : {};
}

/* Save live enemies data to file */
export function saveEnemiesData(data) {
  fs.writeFileSync(enemiesFilePath, JSON.stringify(data, null, 2));
}

/* Load predefined enemies from enemies.json */
function loadPredefinedEnemies() {
  try {
    return JSON.parse(fs.readFileSync(predefinedEnemiesPath, 'utf8'));
  } catch (err) {
    console.error('Error loading predefined enemies:', err);
    return {};
  }
}

/* Create a live enemy based on predefined enemy types and specified position */
export function createLiveEnemy(type, position) {
  const predefinedEnemies = loadPredefinedEnemies();
  const enemyData = predefinedEnemies.find(enemy => enemy.Enemy_Name === type);
  if (!enemyData) return { success: false, message: `Enemy type "${type}" not found.` };

  const newEnemy = {
    id: generateUniqueEnemyID(enemyData.Enemy_Name),
    type: enemyData.Enemy_Name,
    position,
    stats: {
      FS: enemyData.FS,
      Armor: enemyData.Armor,
      Speed: enemyData.Speed,
      Range: enemyData.Range,
      AP: enemyData.AP,
      Keywords: enemyData.Keywords,
    }
  };

  const liveEnemies = loadEnemiesData();
  liveEnemies[newEnemy.id] = newEnemy;
  saveEnemiesData(liveEnemies);

  return { success: true, enemyData: newEnemy, enemyID: newEnemy.id };
}

/* Generate unique enemy ID based on type and a random number */
function generateUniqueEnemyID(type) {
  return `${type}_${Math.floor(Math.random() * 1000)}`;
}

/* ==========================
   HEX MAP UTILITIES
   ========================== */

/* Load map data from the file */
function loadMapData() {
  try {
    return JSON.parse(fs.readFileSync('public/data/map.json', 'utf-8'));
  } catch (err) {
    console.error('Error loading map data:', err);
    return {};
  }
}

/* Load terrain rules data */
function loadTerrainRules() {
  try {
    return JSON.parse(fs.readFileSync('public/data/terrain_rules.json', 'utf-8'));
  } catch (err) {
    console.error('Error loading terrain_rules data:', err);
    return {};
  }
}

/* Calculate the movement path considering hex edges (rivers, elevation) and unit's speed */
function calculatePath(unit, startHex, targetHex) {
  const openList = [{ hex: startHex, cost: 0 }];
  const closedList = new Set();
  const maxSpeed = unit.stats.Speed;

  while (openList.length > 0) {
    const { hex, cost } = openList.shift();
    if (hex.q === targetHex.q && hex.r === targetHex.r) return cost <= maxSpeed;

    closedList.add(`${hex.q},${hex.r}`);
    for (let i = 0; i < 6; i++) {
      const neighbor = getNeighbor(hex, i);
      if (!closedList.has(`${neighbor.q},${neighbor.r}`)) {
        const terrainCost = getEdgeMovementCost(hex, neighbor, unit);
        if (terrainCost !== -1 && cost + terrainCost <= maxSpeed) {
          openList.push({ hex: neighbor, cost: cost + terrainCost });
        }
      }
    }
  }
  return false;
}

/* Get a neighboring hex based on the specified direction. */
function getNeighbor(hex, direction) {
  const directions = [
    { dq: 0, dr: -1 }, { dq: 1, dr: -1 }, { dq: 1, dr: 0 },
    { dq: 0, dr: 1 }, { dq: -1, dr: 1 }, { dq: -1, dr: 0 }
  ];
  const dir = directions[direction];
  return { q: hex.q + dir.dq, r: hex.r + dir.dr };
}

/* Determine the direction between two neighboring hexes */
function getDirection(fromHex, toHex) {
  const dq = toHex.q - fromHex.q;
  const dr = toHex.r - fromHex.r;
  if (dq === 0 && dr === -1) return 'N';
  if (dq === 1 && dr === -1) return 'NE';
  if (dq === 1 && dr === 0) return 'SE';
  if (dq === 0 && dr === 1) return 'S';
  if (dq === -1 && dr === 1) return 'SW';
  if (dq === -1 && dr === 0) return 'NW';
  return null;
}

/* Calculate movement cost between hexes based on terrain and unit capabilities */
function getEdgeMovementCost(fromHex, toHex, unit) {
  const mapData = loadMapData();
  const hex = mapData.hexes.find(hex => `${hex.q},${hex.r}` === `${toHex.q},${toHex.r}`);
  if (hex && hex.terrain === 'water') return -1;
  if (hex && hex.terrain === 'forest') return unit.stats.Keywords.includes('Infantry') ? 1 : 2;

  const edge = mapData.edges.find(edge =>
    `${edge.q},${edge.r}-${edge.direction}` === `${fromHex.q},${fromHex.r}`
  );

  return edge ? (edge.feature === 'river' ? (unit.stats.Keywords.includes('JetPack') ? 1 : 2) : 1) : 1;
}

/* Calculate the offset distance between two hexes in a hex grid */
function offsetDistance(a, b) {
  const ac = evenqToCube(a);
  const bc = evenqToCube(b);
  return cubeDistance(ac, bc);
}

/* Calculate distance between two points in cube coordinates */
function cubeDistance(cube1, cube2) {
  return Math.max(
    Math.abs(cube1.x - cube2.x),
    Math.abs(cube1.y - cube2.y),
    Math.abs(cube1.z - cube2.z)
  );
}

/* Convert even-q offset coordinates to cube coordinates */
function evenqToCube(hex) {
  const x = hex.col;
  const z = hex.row - Math.floor((hex.col + (hex.col & 1)) / 2);
  const y = -x - z;
  return { x, y, z };
}

/* Check if a target hex is within reach based on unit speed and terrain */
export function isWithinReach(unit, startHex, targetHex) {
  return calculatePath(unit, startHex, targetHex);
}

/* ==========================
   ENEMY POSITION UPDATES
   ========================== */

/* Update an enemy's position if within movement range */
export function updateEnemyPosition(enemyID, newPosition) {
  const liveEnemies = loadEnemiesData();
  const enemy = liveEnemies[enemyID];
  if (!enemy) return { success: false, message: `Enemy with ID "${enemyID}" not found.` };

  const currentPosition = enemy.position;
  const speed = enemy.stats.Speed;

  if (!speed) return { success: false, message: `Enemy with ID ${enemyID} does not have a defined speed.` };

  if (isWithinReach(enemy, currentPosition, newPosition)) {
    enemy.position = newPosition;
    saveEnemiesData(liveEnemies);
    return { success: true, newPosition };
  } else {
    return { success: false, message: `Target position (${newPosition.x}, ${newPosition.y}) is too far. Enemy can only move ${speed} hexes.` };
  }
}

/* Update an enemy's stats, for example after taking damage */
export function updateEnemyStats(enemyID, updatedStats) {
  const liveEnemies = loadEnemiesData();
  if (!liveEnemies[enemyID]) return { success: false, message: `Enemy with ID "${enemyID}" not found.` };

  Object.assign(liveEnemies[enemyID].stats, updatedStats);
  saveEnemiesData(liveEnemies);
  return { success: true };
}

/* Get a list of all available enemy types */
export function getEnemyTypes() {
  const predefinedEnemies = loadPredefinedEnemies();
  return predefinedEnemies.map(enemy => enemy.Enemy_Name);
}
