import 'dotenv/config';
import express from 'express';
import { InteractionType, InteractionResponseType, verifyKeyMiddleware } from 'discord-interactions';
import {
  createUnit, deleteUnit, getUserInfo, getUnitInfo, getPlayerUnits, canExecuteCommand, startNewPeriod,
  getAvailableEquipment, upgradeUnitWithEquipment, updateUnitPosition, isWithinReach, getAvailableAction, action,
  createLiveEnemy, updateEnemyPosition, loadEnemiesData, updateEnemyStats, loadPlayerData, findAirportsWithinRange,
  getAvailableEmbark,
} from './game_controller.js';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const link = process.env.FORWARDING;
const app = express();
const PORT = process.env.PORT || 3000;

/* ==========================
   EXPRESS APP SETUP
   ========================== */

// Serve static files from the "public" directory
app.use(express.static('public'));

// Route to serve the interactive map
app.get('/map-view', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Set up JSON parsing for incoming POST requests
app.use(express.json({ limit: '10mb' }));

/* ==========================
   WEBSOCKET SERVER SETUP
   ========================== */

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

/* ==========================
   IMAGE HANDLING ROUTE
   ========================== */

app.post('/canvas-image', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).send({ error: 'Image URL is required.' });

    const base64Data = imageUrl.replace(/^data:image\/png;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync('temp.png', imageBuffer);

    return res.status(200).send({ message: 'Canvas image received successfully.' });
  } catch (error) {
    console.error('Error handling canvas image:', error);
    return res.status(500).send({ error: 'Failed to process canvas image.' });
  }
});

/* ==========================
   DISCORD INTERACTION HANDLING
   ========================== */

app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async (req, res) => {
  const { type, data, member } = req.body;
  const playerId = member.user.id;
  const username = member.user.username;
  const commandName = data?.name;
  const adminRoleId = process.env.ADMIN_ID;
  const isAdmin = member.roles && member.roles.includes(adminRoleId);
  const adminCommands = ['test', 'delete', 'enemy', 'newperiod'];

  try {
    if (type === InteractionType.PING) return res.send({ type: InteractionResponseType.PONG });

    if (type === InteractionType.APPLICATION_COMMAND) {
      if (adminCommands.includes(commandName) && !isAdmin) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ You do not have permission to use this command.`,
            flags: 64
          },
        });
      }

      switch (commandName) {
        case 'test':
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: 'Test Successful!', flags: 64 }
          });

        case 'newperiod':
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: startNewPeriod() }
          });

        case 'create':
          return handleCreateCommand(data, playerId, username, res);

        case 'delete':
          return handleDeleteCommand(data, res);

        case 'enemy':
          return handleEnemyCommand(data, res);

        case 'info':
          return handleInfoCommand(data, res);

        case 'upgrade':
          return handleUpgradeCommand(data, playerId, res);

        case 'map':
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: `🌍 View the interactive map here: [Click to View](${link}/map-view)` }
          });

        case 'move':
        case 'action':
          return handleLimitedCommands(data, commandName, playerId, res);

        default:
          console.error(`Unknown command: ${commandName}`);
          return res.status(400).json({ error: 'Unknown command' });
      }
    }

    if (type === InteractionType.MESSAGE_COMPONENT && data.custom_id.startsWith('select_equipment')) {
      const selectedEquipment = data.values[0];
      const unitName = data.custom_id.split(':')[1];
      const result = upgradeUnitWithEquipment(playerId, unitName, selectedEquipment);

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: result }
      });
    }



    if (type === InteractionType.MESSAGE_COMPONENT && data.custom_id.startsWith('select_embark')) {
      const embarkUnit = data.values[0];
      const unitName = data.custom_id.split(':')[1];
      updateUnitPosition(playerId,unitName,embarkUnit, embarkUnit);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `Unit "${unitName}" embarked ${embarkUnit}.` }
      });
    }

    // Handle follow-up for action selection
    if (data.custom_id && data.custom_id.startsWith('select_action')) {
      const selectedAction = data.values[0];
      const unitName = data.custom_id.split(':')[1];

      // Check if the selected action is "embark"
      if (selectedAction === 'Embark') {
        const availableTransports = getAvailableEmbark(playerId, unitName);

        if (!availableTransports.success) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {content: availableTransports.message, flags: 64}
          });
        }

        // List transports for the user to select
        const transportOptions = availableTransports.transports.map(transport => ({
          label: `${transport.name}`,
          value: transport.name,
        }));

        // Send a follow-up with a select menu of available transports
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Choose a transport to embark:`,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 3,
                    custom_id: `select_embark:${unitName}`,
                    options: transportOptions.slice(0, 25),
                    placeholder: 'Select a transport',
                  },
                ],
              },
            ],
          },
        });
      }

      if (selectedAction === 'Attack') {
        const playerUnits = getPlayerUnits(playerId);
        const unit = playerUnits.find(u => u.name.toLowerCase() === unitName.toLowerCase());

        if (!unit) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {content: `Unit "${unitName}" not found.`, flags: 64}
          });
        }

        const weapons = unit.stats.Weapons || [];
        const isMech = unit.stats.Keywords.includes("mech");
        const isArty = unit.stats.Keywords.includes("arty");

        if (weapons.length === 0) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {content: `❌ No weapons available for unit "${unitName}".`, flags: 64}
          });
        }

        console.log(weapons);

        // Build weapon selection options
        var weaponOptions = Object.keys(weapons).map(weaponName => ({
          label: weaponName,
          value: weaponName,
        }));


        // If "mech", allow multiple weapon selection
        const placeholderText = isMech ? 'Select one or more weapons to attack' : 'Select a weapon to attack';
        const maxValues = isMech ? weapons.length : 1;

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Choose weapon(s) for unit "${unitName}" to attack.`,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 3,
                    custom_id: `select_weapon:${unitName}`,
                    options: weaponOptions.slice(0, 25),
                    placeholder: placeholderText,
                    min_values: 1,
                    max_values: maxValues,
                  },
                ],
              },
            ],
          },
        });
      }
    }
    // Handle follow-up for weapon selection
    if (type === InteractionType.MESSAGE_COMPONENT && data.custom_id.startsWith('select_weapon')) {
      console.log("Selected Weapon");
      const selectedWeapons = data.values;
      const unitName = data.custom_id.split(':')[1];
      const playerUnits = getPlayerUnits(playerId);
      const unit = playerUnits.find(u => u.name.toLowerCase() === unitName.toLowerCase());

      if (unit.stats.Keywords.includes("arty")) {
        // If "arty", prompt for two hex targets
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Choose two hexes to attack for "${unitName}":`,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 3,
                    custom_id: `select_hexes:${unitName}:${selectedWeapons.join(',')}`,
                    placeholder: 'Enter two hexes, e.g., q1,r1 and q2,r2',
                    min_values: 2,
                    max_values: 2,
                  },
                ],
              },
            ],
          },
        });
      } else {
        console.log("Non arty");
        // For non-arty units, prompt for single target selection
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Choose a target for "${unitName}" using weapon(s) "${selectedWeapons.join(', ')}".`,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 1,
                    label: "Enter Target",
                    custom_id: `open_target_modal:${unitName}:${selectedWeapons.join(',')}`,
                  },
                ],
              },
            ],
          },
        });
      }
    }
    if (data.custom_id && data.custom_id.startsWith('open_target_modal')) {
      const [_, unitName, weaponNames] = data.custom_id.split(':');
      const selectedWeapons = weaponNames.split(',');

      return res.send({
        type: InteractionResponseType.MODAL,
        data: {
          custom_id: `submit_target:${unitName}:${selectedWeapons.join(',')}`,
          title: "Specify Target",
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,  // Text input component
                  custom_id: 'target_input',
                  style: 1, // Short input (single line)
                  label: "Enter the target's name or ID",
                  placeholder: "Type the target name or coordinates",
                  required: true,
                },
              ],
            },
          ],
        },
      });
    }

    if (data.custom_id && data.custom_id.startsWith('submit_target')) {
      const [_, unitName, weaponNames] = data.custom_id.split(':');
      const selectedWeapons = weaponNames.split(',');
      const targetId = data.components[0].components[0].value;  // Retrieve the text entered in the modal

      const liveEnemies = loadEnemiesData();
      const targetEnemy = liveEnemies[targetId];
      if (!liveEnemies[targetId]) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ Target "${targetId}" does not exist in the current enemies list.`,
            flags: 64
          }
        });
      }

      // Calculate distance between the attacking unit and the target
      const playerUnits = getPlayerUnits(playerId);
      const unit = playerUnits.find(u => u.name.toLowerCase() === unitName.toLowerCase());
      const unitPosition = unit.position;
      const targetPosition = targetEnemy.position;
      const distanceToTarget = hexDistance(unitPosition, targetPosition);
      console.log(distanceToTarget);

      // Check if the target is within range of each selected weapon
      const outOfRangeWeapons = selectedWeapons.filter(weaponName => {
        const weapon = unit.stats.Weapons[weaponName];
        return weapon && distanceToTarget > weapon.range;
      });

      if (outOfRangeWeapons.length > 0) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ Target "${targetId}" is out of range for the following weapons: ${outOfRangeWeapons.join(', ')}.`,
            flags: 64
          }
        });
      }

      // Execute the attack with the provided target
      const attackResult = executeTargetAttack(playerId, unitName, selectedWeapons, targetId);

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: attackResult.success
            ? `🎯 Unit "${unitName}" attacked target "${targetId}" with weapons ${selectedWeapons.join(', ')}.`
            : attackResult.message,
          flags: attackResult.success ? 0 : 64
        },
      });
    }
    // Handle hex or target selection for the attack
    if (data.custom_id && (data.custom_id.startsWith('select_hexes') || data.custom_id.startsWith('select_target'))) {
      const [unitName, weaponNames] = data.custom_id.split(':').slice(1);
      const selectedWeapons = weaponNames.split(',');
      let attackResult;

      if (data.custom_id.startsWith('select_hexes')) {
        const selectedHexes = data.values;

        attackResult = executeAreaAttack(playerId, unitName, selectedWeapons, selectedHexes);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: attackResult.success
              ? `🎯 Unit "${unitName}" has attacked hexes ${selectedHexes.join(' and ')} with weapons ${selectedWeapons.join(', ')}.`
              : attackResult.message,
            flags: attackResult.success ? 0 : 64
          }
        });
      } else if (data.custom_id.startsWith('select_target')) {
        const selectedTarget = data.values[0];

        attackResult = executeTargetAttack(playerId, unitName, selectedWeapons, selectedTarget);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: attackResult.success
              ? `🎯 Unit "${unitName}" has attacked target ${selectedTarget} with weapons ${selectedWeapons.join(', ')}.`
              : attackResult.message,
            flags: attackResult.success ? 0 : 64
          }
        });
      }
    }




    return res.status(400).json({ error: 'Unknown interaction type' });

  } catch (error) {
    console.error('Error handling interaction:', error);
    return res.status(500).send('Internal Server Error');
  }
});

/* ==========================
   COMMAND HANDLING FUNCTIONS
   ========================== */

/* Handle the "create" command */
function handleCreateCommand(data, playerId, username, res) {
  const unitName = data.options.find(opt => opt.name === 'unit_name').value;
  const unitType = data.options.find(opt => opt.name === 'unit_type').value;
  const result = createUnit(playerId, username, unitName, unitType);

  if (result.success) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `✅ Unit "${unitName}" of type "${unitType}" has been created for ${username}.` }
    });
  } else {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `❌ Unable to create unit. You may already have the maximum number of units.`,
        flags: 64
      }
    });
  }
}

/* Handle the "delete" command */
function handleDeleteCommand(data, res) {
  const unitName = data.options.find(opt => opt.name === 'unit_name').value;
  const result = deleteUnit(unitName);

  if (result.success) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `✅ Unit "${unitName}" has been deleted.`, flags: 64 }
    });
  } else {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `❌ Unit "${unitName}" not found in any player's list.`, flags: 64 }
    });
  }
}

/* Handle the "enemy" command */
function handleEnemyCommand(data, res) {
  const subCommand = data.options[0].name;

  if (subCommand === 'create') {
    const type = data.options[0].options.find(opt => opt.name === 'type').value;
    const x = data.options[0].options.find(opt => opt.name === 'x').value;
    const y = data.options[0].options.find(opt => opt.name === 'y').value;
    const result = createLiveEnemy(type, { x, y });

    if (result.success) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `✅ Enemy ${type} created at (${x}, ${y}) with ID ${result.enemyID}.` }
      });
    } else {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `❌ Failed to create enemy.` }
      });
    }
  }

  if (subCommand === 'move') {
    const enemyID = data.options[0].options.find(opt => opt.name === 'enemy_id').value;
    const x = data.options[0].options.find(opt => opt.name === 'x').value;
    const y = data.options[0].options.find(opt => opt.name === 'y').value;
    const result = updateEnemyPosition(enemyID, { x, y });

    if (result.success) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `✅ Enemy ${enemyID} moved to (${x}, ${y}).` }
      });
    } else {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: result.message }
      });
    }
  }

  if (subCommand === 'attack') {
    const enemyID = data.options[0].options.find(opt => opt.name === 'enemy_id').value;
    const targetUnitID = data.options[0].options.find(opt => opt.name === 'target_unit').value;
    const result = executeEnemyAttack(enemyID, targetUnitID);

    if (result.success) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `⚔️ Enemy ${enemyID} attacked unit ${targetUnitID}. ${result.details}` }
      });
    } else {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `❌ Failed to execute attack.` }
      });
    }
  }
}

/* Handle the "info" command */
function handleInfoCommand(data, res) {
  const subCommand = data.options[0].name;

  if (subCommand === 'user') {
    const userId = data.options[0].options.find(opt => opt.name === 'user').value;
    const result = getUserInfo(userId);

    if (result.success) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `📋 Units for <@${userId}>:\n${result.units}`,
          flags: 64
        }
      });
    } else {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `❌ User not found or has no units.`,
          flags: 64
        }
      });
    }
  }

  if (subCommand === 'unit') {
    const unitName = data.options[0].options.find(opt => opt.name === 'unit_name').value;
    const result = getUnitInfo(unitName);

    if (result.success) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `📋 Information for unit "${unitName}":\n${result.unitInfo}`,
          flags: 64
        }
      });
    } else {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `❌ Unit "${unitName}" not found.`,
          flags: 64
        }
      });
    }
  }
}

/* Handle the "upgrade" command */
async function handleUpgradeCommand(data, playerId, res) {
  const unitName = data.options.find(opt => opt.name === 'unit_name').value;
  const playerUnits = getPlayerUnits(playerId);
  const unit = playerUnits.find(u => u.name.toLowerCase() === unitName.toLowerCase());

  if (!unit) {
    const unitList = playerUnits.map(u => u.name).join(', ');
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `Unit "${unitName}" not found. You have the following units: ${unitList}`,
        flags: 64
      }
    });
  }

  res.send({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
  });

  const availableEquipment = getAvailableEquipment(unit);
  const equipmentOptions = availableEquipment.map(eq => ({
    label: eq.name,
    value: eq.name,
  }));

  await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${res.req.body.token}/messages/@original`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bot ${process.env.BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: `Choose equipment for unit "${unitName}"`,
      components: [
        {
          type: 1,
          components: [
            {
              type: 3,
              custom_id: `select_equipment:${unitName}`,
              options: equipmentOptions.slice(0, 25),
              placeholder: 'Select equipment to upgrade',
            },
          ],
        },
      ],
    }),
  });
}

/* Handle limited-use commands like "move" and "action" */
async function handleLimitedCommands(data, commandName, playerId, res) {
  const unitName = data.options.find(opt => opt.name === 'unit_name').value;
  const checkResult = canExecuteCommand(playerId, unitName, commandName);
  checkResult.canExecute = true;

  const playerUnits = getPlayerUnits(playerId);
  const unit = playerUnits.find(u => u.name.toLowerCase() === unitName.toLowerCase());
  if (!unit) {
    const unitList = playerUnits.map(u => u.name).join(', ');
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `Unit "${unitName}" not found. You have the following units: ${unitList}`,
        flags: 64
      }
    });
  }

  if (!checkResult.canExecute) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: checkResult.message,
        flags: 64
      }
    });
  }

  if (commandName === 'move') {
    const coordinates = data.options.find(opt => opt.name === 'coordinates').value;
    const [targetQ, targetR] = coordinates.split(',').map(Number);
    if (isNaN(targetQ) || isNaN(targetR)) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Invalid coordinates format. Please use q,r format.`,
          flags: 64
        }
      });
    }

    var currentQ = unit.position.x;
    var currentR = unit.position.y;
    if (currentQ === targetQ && currentR === targetR) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Unit "${unitName}" is already at (${targetQ}, ${targetR}).`,
          flags: 64
        }
      });
    }

    if (currentQ === "orbit") {
      if (unit.stats.Keywords.includes("DropPod") || unit.stats.Keywords.includes("Orbital")) {
        updateUnitPosition(playerId, unitName, targetQ, targetR);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Unit "${unitName}" moved to coordinates (${targetQ}, ${targetR}).`
          }
        });
      }
      if(findAirportsWithinRange(targetQ, targetR, unit.stats.Speed)){
        updateUnitPosition(playerId, unitName, targetQ, targetR);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Unit "${unitName}" moved to coordinates (${targetQ}, ${targetR}).`
          }
        });
      }else{
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ Unit "${unitName}" can not drop from orbit.`,
            flags: 64
          }
        });
      }
    }

    // Check if currentQ is a string, indicating it's another unit's name
    if (typeof currentQ === 'string') {
      // Look up the specified unit by name
      const allPlayers = loadPlayerData(); // Load all player data to search for the unit
      let otherUnit = null;

      for (const playerId in allPlayers) {
        otherUnit = allPlayers[playerId].units.find(u => u.name.toLowerCase() === currentQ.toLowerCase());
        if (otherUnit) break; // Stop searching once we find the unit
      }

      if (!otherUnit) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ Referenced unit "${currentQ}" not found.`,
            flags: 64
          }
        });
      }

      // Set currentQ and currentR to the coordinates of the referenced unit
      currentQ = otherUnit.position.x;
      currentR = otherUnit.position.y;
    }

    if (isWithinReach(unit, { q: currentQ, r: currentR }, { q: targetQ, r: targetR })) {
      updateUnitPosition(playerId, unitName, targetQ, targetR);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Unit "${unitName}" moved to coordinates (${targetQ}, ${targetR}).`
        }
      });
    } else {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Unit "${unitName}" cannot reach coordinates (${targetQ}, ${targetR}).`,
          flags: 64
        }
      });
    }
  }

  // Handle action command
  if (commandName === 'action') {
    const playerUnits = getPlayerUnits(playerId);
    const unit = playerUnits.find(u => u.name.toLowerCase() === unitName.toLowerCase());

    if (!unit) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `Unit "${unitName}" not found.`, flags: 64 }
      });
    }

    // Get available actions for the unit
    const availableAction = getAvailableAction(unit);
    const actionOptions = availableAction.map(action => ({
      label: action.name,
      value: action.name,
    }));

    res.send({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    });

    // Prompt the user to select an action
    await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${res.req.body.token}/messages/@original`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bot ${process.env.BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: `Choose action for unit "${unitName}"`,
        components: [
          {
            type: 1, // Action row
            components: [
              {
                type: 3, // Select menu
                custom_id: `select_action:${unitName}`,
                options: actionOptions.slice(0, 25),
                placeholder: 'Select action',
              },
            ],
          },
        ],
      }),
    });
  }
}

/* ==========================
   APP LISTENER
   ========================== */

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});

function hexDistance(a, b) {
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(-a.x - a.y - (-b.x - b.y))
  );
}