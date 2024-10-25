import 'dotenv/config';
import express from 'express';
import { InteractionType, InteractionResponseType, verifyKeyMiddleware } from 'discord-interactions';
import {
  createUnit, deleteUnit, getUserInfo, getUnitInfo, getPlayerUnits, canExecuteCommand, startNewPeriod,
  getAvailableEquipment, upgradeUnitWithEquipment, updateUnitPosition, isWithinReach,
  createLiveEnemy, updateEnemyPosition, loadEnemiesData, updateEnemyStats, loadPlayerData
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
  const adminRoleId = '1240625898710106122';  // Replace with your server's admin role ID
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
function handleLimitedCommands(data, commandName, playerId, res) {
  const unitName = data.options.find(opt => opt.name === 'unit_name').value;
  const checkResult = canExecuteCommand(playerId, unitName, commandName);

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

    const currentQ = unit.position.x;
    const currentR = unit.position.y;
    if (currentQ === targetQ && currentR === targetR) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Unit "${unitName}" is already at (${targetQ}, ${targetR}).`,
          flags: 64
        }
      });
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

  if (commandName === 'action') {
    // Placeholder for handling the action command if necessary
  }
}

/* ==========================
   APP LISTENER
   ========================== */

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});