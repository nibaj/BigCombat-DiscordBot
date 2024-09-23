import fs from 'fs';

// Load player data from JSON (or any database in the future)
export function loadPlayerData() {
  try {
    return JSON.parse(fs.readFileSync('data/players.json', 'utf-8'));
  } catch (err) {
    console.error('Error loading player data:', err);
    return {};
  }
}

// Save player data to JSON
function savePlayerData(players) {
  fs.writeFileSync('data/players.json', JSON.stringify(players, null, 4));
}

// Load predefined units from units.json
export function loadUnits() {
  try {
    return JSON.parse(fs.readFileSync('data/units.json'));
  } catch (e) {
    return [];
  }
}

// Create a new unit for a player
export function createUnit(playerId, unitType, unitName) {
  const players = loadPlayerData();
  const units = loadUnits();

  // Check if the unitType is valid
  const selectedUnit = units.find(unit => unit.Unit_Name === unitType);
  if (!selectedUnit) {
    return `Invalid unit type "${unitType}". Please choose a valid unit type.`;
  }

  // Check if the player already exists
  if (!players[playerId]) {
    players[playerId] = { units: [] };
  }

  const playerUnits = players[playerId].units;

  // Check if player already has 2 units
  if (playerUnits.length >= 2) {
    return `You already have the maximum number of units (2).`;
  }

  // Create the new unit and add it to the player's unit list
  const newUnit = {
    name: unitName,      // Custom name from the player
    type: unitType,      // Predefined type from units.json
    stats: selectedUnit, // Inherit stats from the predefined unit
    equippedItems: [],   // Can add more properties as needed
  };

  playerUnits.push(newUnit);
  savePlayerData(players);

  return `Your new unit "${unitName}" of type "${unitType}" has been created successfully!`;
}

// Save units data to JSON
function saveUnits(units) {
  fs.writeFileSync('data/units.json', JSON.stringify(units, null, 4));
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
    const data = JSON.parse(fs.readFileSync('data/equipment.json', 'utf-8'));
    return data;
  } catch (err) {
    console.error('Error loading equipment data:', err);
    return {};
  }
}

// Function to get available equipment for a unit
export function getAvailableEquipment(unit) {
  try {
    const allEquipment = JSON.parse(fs.readFileSync('data/equipment.json', 'utf-8'));

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
  const players = JSON.parse(fs.readFileSync('data/players.json', 'utf-8'));

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
  const equipmentData = JSON.parse(fs.readFileSync('data/equipment.json', 'utf-8'));
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
  fs.writeFileSync('data/players.json', JSON.stringify(players, null, 2));

  return `Successfully upgraded unit "${unitName}" with equipment "${equipmentName}".`;
}

// Move a unit to a new position
export function moveUnit(unitName, newPosition) {
  const units = loadUnits();
  const unit = units.find(u => u.Unit_Name === unitName);
  if (!unit) return `Unit ${unitName} not found.`;

  unit.Position = newPosition;  // Assuming you store positions as strings like "2,3"
  saveUnits(units);
  return `${unitName} moved to position ${newPosition}.`;
}
