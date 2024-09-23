import 'dotenv/config';
import express from 'express';
import { InteractionType, InteractionResponseType, verifyKeyMiddleware } from 'discord-interactions';
import { createUnit, getPlayerUnits, moveUnit, getAvailableEquipment, upgradeUnitWithEquipment } from './game_controller.js';  // Assuming game logic in game_controller.js

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;

app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  const { type, data, member, user } = req.body;

  // Handle verification requests
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  // Handle slash command requests
  if (type === InteractionType.APPLICATION_COMMAND) {
    const playerId = member.user.id;

    const { name } = data;

    // Handle "test" command
    if (name === 'test') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'Test Successful!' },
      });
    }

    // Handle "create" command
    if (name === 'create') {
      const unitType = options.find(opt => opt.name === 'unit_type').value;
      const unitName = options.find(opt => opt.name === 'unit_name').value;
      const playerId = member.user.id;  // Use the player's ID to track their units

      const result = createUnit(playerId, unitType, unitName);  // Create unit logic with type and name
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: result },
      });
    }
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

    // Handle application command execution
  if (type === InteractionType.APPLICATION_COMMAND) {
    const playerId = member.user.id;  // Get player ID dynamically from Discord

    const { name } = data;

    if (name === 'upgrade') {
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

    // Handle "move" command
    if (name === 'move') {
      const unitName = options.find(opt => opt.name === 'unit').value;
      const position = options.find(opt => opt.name === 'position').value;

      const result = moveUnit(unitName, position);
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: result },
      });
    }

    console.error(`Unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
