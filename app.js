import 'dotenv/config';
import express from 'express';
import { InteractionType, InteractionResponseType, verifyKeyMiddleware } from 'discord-interactions';
import { createUnit, deleteUnit, getUserInfo, getUnitInfo, getPlayerUnits,
    getAvailableEquipment, upgradeUnitWithEquipment, updateUnitPosition, isWithinReach,
    createLiveEnemy, updateEnemyPosition, loadEnemiesData, updateEnemyStats, loadPlayerData
    } from './game_controller.js';  // Assuming game logic in game_controller.js
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const link = 'https://dc3e-2001-7e8-f606-fc01-5cc2-b0b1-89c9-9012.ngrok-free.app'

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// Serve static files from the "public" directory
app.use(express.static('public'));

// Route to serve the interactive map
app.get('/map-view', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Map to store the last execution timestamps for commands per user
const commandTimestamps = new Map();

// Setup the WebSocket server
const wss = new WebSocketServer({ port: 8080 });
wss.on('connection', (ws) => {
    console.log('WebSocket client connected.');

    ws.on('message', (message) => {
        console.log('Received message from client:', message);
    });

    ws.on('close', () => {
        console.log('WebSocket client disconnected.');
    });
});

app.use(express.json({ limit: '10mb' }));
app.post('/canvas-image', async (req, res) => {
    try {
        const { imageUrl } = req.body;

        if (!imageUrl) {
            return res.status(400).send({ error: 'Image URL is required.' });
        }

        // Decode the base64 image data and save it to a buffer
        const base64Data = imageUrl.replace(/^data:image\/png;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Save the image temporarily
        fs.writeFileSync('temp.png', imageBuffer);

        return res.status(200).send({ message: 'Canvas image received successfully.' });
    } catch (error) {
        console.error('Error handling canvas image:', error);
        return res.status(500).send({ error: 'Failed to process canvas image.' });
    }
});


app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  const { type, data, member, user } = req.body;

  try {
    // console.log('Received interaction:', JSON.stringify(req.body, null, 2));

    // Handle verification requests
    if (type === InteractionType.PING) {
      return res.send({ type: InteractionResponseType.PONG });
    }

    // Handle slash command requests
    if (type === InteractionType.APPLICATION_COMMAND) {
      const commandName = data.name;
      const playerId = member.user.id;
      const username = member.user.username;
      const { name } = data;

      const adminRoleId = '1240625898710106122'; // Replace with your server's admin role ID
      const isAdmin = member.roles && member.roles.includes(adminRoleId);

      // List of commands restricted to admins
      const adminCommands = ['test', 'delete', 'enemy'];

      // Restrict command to admins if it's in the adminCommands list
      if (adminCommands.includes(commandName) && !isAdmin) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ You do not have permission to use this command.`,
            flags: 64 // This makes the response visible only to the user who invoked the command
          },
        });
      }

      // Handle "test" command
      if (name === 'test') {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: 'Test Successful!',
            flags: 64
          },
        });
      }

      // Handle "create" command
      if (commandName === 'create') {
        const unitName = data.options.find(opt => opt.name === 'unit_name').value;
        const unitType = data.options.find(opt => opt.name === 'unit_type').value;

        // Attempt to create the unit
        const result = createUnit(playerId, username, unitName, unitType);

        if (result.success) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `✅ Unit "${unitName}" of type "${unitType}" has been created for ${username}.`,
            },
          });
        } else {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ Unable to create unit. You may already have the maximum number of units.`,
              flags: 64
            },
          });
        }
      }

      if (commandName === 'delete') {
        const unitName = data.options.find(opt => opt.name === 'unit_name').value;

        // Attempt to delete the unit
        const result = deleteUnit(unitName);

        if (result.success) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `✅ Unit "${unitName}" has been deleted.`,
              flags: 64
            },
          });
        } else {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ Unit "${unitName}" not found in any player's list.`,
              flags: 64
            },
          });
        }
      }

      if (commandName === 'enemy') {
        const subCommand = data.options[0].name; // Get the subcommand ('create', 'move', or 'attack')

        if (subCommand === 'create') {
          const type = data.options[0].options.find(opt => opt.name === 'type').value;
          const x = data.options[0].options.find(opt => opt.name === 'x').value;
          const y = data.options[0].options.find(opt => opt.name === 'y').value;

          // Call a function to create the enemy
          const result = createLiveEnemy(type, {x, y});

          if (result.success) {
            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `✅ Enemy ${type} created at (${x}, ${y}) with ID ${result.enemyID}.`,
              },
            });
          } else {
            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `❌ Failed to create enemy.`,
              },
            });
          }
        } else if (subCommand === 'move') {
          const enemyID = data.options[0].options.find(opt => opt.name === 'enemy_id').value;
          const x = data.options[0].options.find(opt => opt.name === 'x').value;
          const y = data.options[0].options.find(opt => opt.name === 'y').value;

          // Call a function to move the enemy
          const result = updateEnemyPosition(enemyID, {x, y});

          if (result.success) {
            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `✅ Enemy ${enemyID} moved to (${x}, ${y}).`,
              },
            });
          } else {
            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: result.message,
              },
            });
          }
        } else if (subCommand === 'attack') {
          const enemyID = data.options[0].options.find(opt => opt.name === 'enemy_id').value;
          const targetUnitID = data.options[0].options.find(opt => opt.name === 'target_unit').value;

          // Call a function to execute the attack
          const result = executeEnemyAttack(enemyID, targetUnitID);

          if (result.success) {
            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `⚔️ Enemy ${enemyID} attacked unit ${targetUnitID}. ${result.details}`,
              },
            });
          } else {
            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `❌ Failed to execute attack.`,
              },
            });
          }
        }
      }

      if (commandName === 'info') {
        const subCommand = data.options[0].name; // Get the subcommand (either 'user' or 'unit')

        if (subCommand === 'user') {
          const userId = data.options[0].options.find(opt => opt.name === 'user').value;

          // Fetch the units of the specified user
          const result = getUserInfo(userId);

          if (result.success) {
            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `📋 Units for <@${userId}>:\n${result.units}`,
                flags: 64
              },
            });
          } else {
            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `❌ User not found or has no units.`,
                flags: 64
              },
            });
          }
        } else if (subCommand === 'unit') {
          const unitName = data.options[0].options.find(opt => opt.name === 'unit_name').value;

          // Fetch the information for the specified unit name
          const result = getUnitInfo(unitName);

          if (result.success) {
            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `📋 Information for unit "${unitName}":\n${result.unitInfo}`,
                flags: 64
              },
            });
          } else {
            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `❌ Unit "${unitName}" not found.`,
                flags: 64
              },
            });
          }
        }
      }

      if (commandName === 'upgrade') {
        const unitName = data.options.find(opt => opt.name === 'unit_name').value;
        const playerUnits = getPlayerUnits(playerId);

        // Find the player's unit
        const unit = playerUnits.find(u => u.name.toLowerCase() === unitName.toLowerCase());

        if (!unit) {
          const unitList = playerUnits.map(u => u.name).join(', ');
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `Unit "${unitName}" not found. You have the following units: ${unitList}`,
              flags: 64
            },
          });
        }

        // Respond immediately to Discord, acknowledging the request
        res.send({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        });

        // Now process the request and fetch the available equipment asynchronously
        const availableEquipment = getAvailableEquipment(unit);

        // Create the select menu with available equipment, including the unitName in custom_id
        const equipmentOptions = availableEquipment.map(eq => ({
          label: eq.name,
          value: eq.name,  // You might want to use an ID if available
        }));

        // Send a follow-up message using Discord's follow-up message API
        await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bot ${process.env.BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: `Choose equipment for unit "${unitName}"`,
            components: [
              {
                type: 1,  // Action row
                components: [
                  {
                    type: 3,  // Select menu
                    custom_id: `select_equipment:${unitName}`,  // Include unitName in the custom_id
                    options: equipmentOptions.slice(0, 25),  // Discord allows up to 25 options
                    placeholder: 'Select equipment to upgrade',
                  },
                ],
              },
            ],
          }),
        });

        return;  // Prevent any further responses being sent after this point
      }

      if (commandName === 'map') {
        return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: '🌍 View the interactive map here: [Click to View]('+link+'/map-view)',
            }
        });
      }


      // Check if the command is one that requires limited use (e.g., /move, /action)
      if (['move', 'action'].includes(commandName)) {
        const unitName = data.options.find(opt => opt.name === 'unit_name').value;
        // Use the updated canExecuteCommand to check per unit
        const checkResult = canExecuteCommand(playerId, unitName, commandName);
        if (!checkResult.canExecute) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: checkResult.message,
              flags: 64, // Make the message ephemeral
            },
          });
        }
        let commandSuccess = false;

        // Handle "move" command
        if (commandName === 'move') {
          const unitName = data.options.find(opt => opt.name === 'unit_name').value;
          const coordinates = data.options.find(opt => opt.name === 'coordinates').value;

          // Parse coordinates in "q,r" format
          const [targetQ, targetR] = coordinates.split(',').map(Number);

          if (isNaN(targetQ) || isNaN(targetR)) {
            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `Invalid coordinates format. Please use q,r format.`,
                flags: 64
              },
            });
          }

          const playerUnits = getPlayerUnits(playerId);
          const unit = playerUnits.find(u => u.name.toLowerCase() === unitName.toLowerCase());

          if (!unit) {
            const unitList = playerUnits.map(u => u.name).join(', ');
            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `Unit "${unitName}" not found. You have the following units: ${unitList}`,
                flags: 64
              },
            });
          }

          // Get current position (assuming unit has a 'position' attribute with { q, r })
          const currentQ = unit.position.x;
          const currentR = unit.position.y;
          const speed = unit.stats.Speed;

          // Check if the unit can move to the target coordinates within its speed
          if (isWithinReach(currentQ, currentR, targetQ, targetR, speed)) {
            // Update unit position
            updateUnitPosition(playerId, unitName, targetQ, targetR);

            commandSuccess = true

            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `Unit "${unitName}" moved to coordinates (${targetQ}, ${targetR}).`,
              },
            });
          } else {
            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `Unit "${unitName}" cannot reach coordinates (${targetQ}, ${targetR}) with speed ${speed}.`,
                flags: 64
              },
            });
          }
        }

        if (commandName === 'action') {


        }
        // Update the timestamp only if the command was successful
        if (commandSuccess) {
          updateCommandTimestamp(userId, unitName, commandName);
        }
      }

      console.error(`Unknown command: ${name}`);
      return res.status(400).json({ error: 'unknown command' });
    }

    if (type === InteractionType.MESSAGE_COMPONENT && data.custom_id.startsWith('select_equipment')) {
      const selectedEquipment = data.values[0];  // Get selected equipment from the menu
      const playerId = member.user.id;

      // Extract unitName from custom_id (custom_id format: 'select_equipment:unitName')
      const customIdParts = data.custom_id.split(':');
      const unitName = customIdParts[1];

      // Apply the equipment to the unit
      const result = upgradeUnitWithEquipment(playerId, unitName, selectedEquipment);

      // Send a confirmation message to the player
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: result,  // This should confirm the upgrade
        },
      });
    }

    //console.error('unknown interaction type', type);
    return res.status(400).json({ error: 'unknown interaction type' });

  } catch (error) {
    console.error('Error handling interaction:', error);
    return res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});


// https://www.redblobgames.com/grids/hexagons-v1/

// Converts cube coordinates back to even-q offset coordinates
function cubeToEvenq(cube) {
  const col = cube.x;
  const row = cube.z + Math.floor((cube.x + (cube.x & 1)) / 2);
  return { col, row };
}
// Six possible cube directions
const cubeDirections = [
  { x: +1, y: -1, z: 0 }, { x: +1, y: 0, z: -1 }, { x: 0, y: +1, z: -1 },
  { x: -1, y: +1, z: 0 }, { x: -1, y: 0, z: +1 }, { x: 0, y: -1, z: +1 }
];

// Get the cube direction based on index
function cubeDirection(direction) {
  return cubeDirections[direction];
}

// Get the neighboring cube by adding direction
function cubeNeighbor(cube, direction) {
  const dir = cubeDirection(direction);
  return {
    x: cube.x + dir.x,
    y: cube.y + dir.y,
    z: cube.z + dir.z
  };
}
// Direction arrays for even-q hex grids
const evenqDirections = [
  [ { col: +1, row: +1 }, { col: +1, row: 0 }, { col: 0, row: -1 },
    { col: -1, row: 0 }, { col: -1, row: +1 }, { col: 0, row: +1 } ],
  [ { col: +1, row: 0 }, { col: +1, row: -1 }, { col: 0, row: -1 },
    { col: -1, row: -1 }, { col: -1, row: 0 }, { col: 0, row: +1 } ]
];

// Find the neighboring hex in an even-q grid
function evenqOffsetNeighbor(hex, direction) {
  const parity = hex.col & 1; // 0 for even, 1 for odd columns
  const dir = evenqDirections[parity][direction];
  return { col: hex.col + dir.col, row: hex.row + dir.row };
}

// Function to check if a user’s unit can execute a command and update its timestamp
function canExecuteCommand(userId, unitName, commandName) {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 (Sunday) to 6 (Saturday)

    // Define the two timeframes
    const isSaturdayToWednesday = dayOfWeek >= 6 || dayOfWeek <= 3; // Saturday (6) to Wednesday (3)
    const isWednesdayToSaturday = dayOfWeek >= 3 && dayOfWeek <= 6; // Wednesday (3) to Saturday (6)

    // Determine the current period
    let currentPeriod = '';
    if (isSaturdayToWednesday) {
        currentPeriod = 'Saturday-Wednesday';
    } else if (isWednesdayToSaturday) {
        currentPeriod = 'Wednesday-Saturday';
    }

    // Initialize user data in the map if it doesn't exist
    if (!commandTimestamps.has(userId)) {
        commandTimestamps.set(userId, {});
    }

    // Get the user's units from the map
    const userUnits = commandTimestamps.get(userId);

    // Initialize the unit's command data if it doesn't exist
    if (!userUnits[unitName]) {
        userUnits[unitName] = {};
    }

    // Get the unit's command data
    const unitCommands = userUnits[unitName];

    // Check if the unit has already executed the command in the current period
    if (unitCommands[commandName] && unitCommands[commandName].period === currentPeriod) {
        return { canExecute: false, message: `⏳ Unit "${unitName}" has already used the ${commandName} command during the ${currentPeriod} period.` };
    }

    // Update the command's timestamp and period for the unit
    unitCommands[commandName] = { timestamp: now, period: currentPeriod };
    userUnits[unitName] = unitCommands;
    commandTimestamps.set(userId, userUnits);

    return { canExecute: true };
}