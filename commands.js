import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';
import { loadUnits, loadPlayerData, loadEquipmentData, getPlayerUnits } from './game_controller.js';

// Test command (kept from the original file)
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic test command',
  type: 1,
};

// CREATE UNITS

// Load predefined units from units.json
const availableUnits = loadUnits();

// Define the create unit command with unitType and unitName
const CREATE_UNIT_COMMAND = {
  name: 'create',
  description: 'Create a new unit for the player',
  options: [
    {
      type: 3, // STRING type
      name: 'unit_type',
      description: 'The type of unit (from predefined units)',
      required: true,
      choices: availableUnits.map(unit => ({
        name: unit.Unit_Name,  // Unit names from units.json
        value: unit.Unit_Name,
      })),
    },
    {
      type: 3, // STRING type
      name: 'unit_name',
      description: 'The custom name of your new unit',
      required: true,
    },
  ],
  type: 1,
};

// UPGRADE

const UPGRADE_COMMAND = {
  name: 'upgrade',
  description: 'Upgrade a unit with available equipment',
  options: [
    {
      type: 3,  // STRING type
      name: 'unit_name',
      description: 'The name of the unit',
      required: true,
    }
  ],
  type: 1,
};

// MOVING

// Command for moving a unit
const MOVE_COMMAND = {
  name: 'move',
  description: 'Move a unit to a new position',
  options: [
    {
      type: 3, // STRING type
      name: 'unit',
      description: 'The name of the unit',
      required: true,
    },
    {
      type: 3, // STRING type
      name: 'position',
      description: 'The new position (e.g., "2,3")',
      required: true,
    },
  ],
  type: 1,
};

// Add all commands
const ALL_COMMANDS = [
  CREATE_UNIT_COMMAND,
  UPGRADE_COMMAND,
  TEST_COMMAND,
];
InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
