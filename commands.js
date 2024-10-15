import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';
import { loadUnits, loadPlayerData, loadEquipmentData, getPlayerUnits, getEnemyTypes } from './game_controller.js';

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
  description: 'Move a unit to specified coordinates.',
  options: [
    {
      type: 3,  // STRING
      name: 'unit_name',
      description: 'The name of the unit to move.',
      required: true,
    },
    {
      type: 3,  // STRING
      name: 'coordinates',
      description: 'The coordinates to move to in the format x,y.',
      required: true,
    }
  ],
  type: 1,
};

const DELETE_UNIT_COMMAND = {
  name: 'delete',
  description: 'Delete a unit from your list.',
  options: [
    {
      type: 3, // STRING
      name: 'unit_name',
      description: 'The name of the unit to delete.',
      required: true,
    },
  ],
  type: 1,
};

const INFO_COMMAND = {
  name: 'info',
  description: 'Get information about a user or unit.',
  options: [
    {
      type: 1, // Subcommand
      name: 'user',
      description: 'Get information about all units of a specified user.',
      options: [
        {
          type: 6, // USER type
          name: 'user',
          description: 'The user to get information about.',
          required: true,
        },
      ],
    },
    {
      type: 1, // Subcommand
      name: 'unit',
      description: 'Get information about a specific unit by its name.',
      options: [
        {
          type: 3, // STRING type
          name: 'unit_name',
          description: 'The name of the unit to get information about.',
          required: true,
        },
      ],
    },
  ],
  type: 1,
};

const enemyTypes = getEnemyTypes()
const ENEMY_COMMAND = {
    name: 'enemy',
    description: 'Admin command to manage enemies (create, move, attack)',
    type: 1, // Slash command
    options: [
        {
            name: 'create',
            description: 'Create a new enemy',
            type: 1, // Subcommand
            options: [
                {
                    name: 'type',
                    description: 'The type of enemy to create',
                    type: 3, // String
                    required: true,
                    choices: enemyTypes.map(type => ({
                                name: type,
                                value: type
                            }))
                },
                {
                    name: 'x',
                    description: 'X coordinate for the enemy',
                    type: 4, // Integer
                    required: true
                },
                {
                    name: 'y',
                    description: 'Y coordinate for the enemy',
                    type: 4, // Integer
                    required: true
                }
            ]
        },
        {
            name: 'move',
            description: 'Move an enemy to a new location',
            type: 1, // Subcommand
            options: [
                {
                    name: 'enemy_id',
                    description: 'The ID of the enemy to move',
                    type: 3, // String
                    required: true
                },
                {
                    name: 'x',
                    description: 'X coordinate for the new position',
                    type: 4, // Integer
                    required: true
                },
                {
                    name: 'y',
                    description: 'Y coordinate for the new position',
                    type: 4, // Integer
                    required: true
                }
            ]
        },
        {
            name: 'attack',
            description: 'Perform an attack with an enemy',
            type: 1, // Subcommand
            options: [
                {
                    name: 'enemy_id',
                    description: 'The ID of the enemy attacking',
                    type: 3, // String
                    required: true
                },
                {
                    name: 'target_unit',
                    description: 'The ID of the player unit being attacked',
                    type: 3, // String
                    required: true
                }
            ]
        }
    ]
};


const MAP_COMMAND = {
  name: 'map',
  description: 'Get a snapshot of the current map.',
  type: 1,
};

// Add all commands
const ALL_COMMANDS = [
  CREATE_UNIT_COMMAND,
  UPGRADE_COMMAND,
  TEST_COMMAND,
  MOVE_COMMAND,
  DELETE_UNIT_COMMAND,
  INFO_COMMAND,
  ENEMY_COMMAND,
  MAP_COMMAND,
];
InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
