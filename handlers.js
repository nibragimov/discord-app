import {
    InteractionType,
    InteractionResponseType,
    InteractionResponseFlags,
    MessageComponentTypes,
    ButtonStyleTypes,
  } from 'discord-interactions';

import { activeGames  } from './app.js';

import { getShuffledOptions, getResult } from './game.js';

import { 
    getRandomEmoji,
    DiscordRequest,
    buildMessageIdEndpoint
   } from './utils.js';


async function sendReplyMessageInChannel(res, str, flags={}) {
    try {
      await res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: str}
      });
    } catch (err) {
      console.error('Error sending message:', err);
    }
}
  
  function handleTestCommand(res, member) {
    return sendReplyMessageInChannel(res, 'Hello world, ' + member.user.global_name + ' ' + getRandomEmoji())
  }
  
  function handleChallengeCommand(req, id, res) {
    const userId = req.body.member.user.id;
    // User's object choice
    const objectName = req.body.data.options[0].value;
  
    // Create active game using message ID as the game ID
    activeGames[id] = {
      id: userId,
      objectName,
    };
    console.log(`In buttons ${req.body.id}`)
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `Rock papers scissors challenge from <@${userId}>`,
        components: [
          {
            type: MessageComponentTypes.ACTION_ROW,
            components: [
              {
                type: MessageComponentTypes.BUTTON,
                // Append the game ID to use later on
                custom_id: `accept_button_${req.body.id}`,
                label: 'Accept',
                style: ButtonStyleTypes.PRIMARY,
              },
              {
                type: MessageComponentTypes.BUTTON,
                // Append the game ID to use later on
                custom_id: `decline_button_${req.body.id}`,
                label: 'Decline',
                style: ButtonStyleTypes.PRIMARY,
              },
            ],
          },
        ],
      },
    });
  }
  
  async function handleAcceptButton(componentId, req, res) {
    const gameId = componentId.replace('accept_button_', '');
    console.log(gameId);
    console.log(`after clicking ${gameId}`);
    // Delete message with token in request body
    const endpoint = buildMessageIdEndpoint(req.body.token, req.body.message.id);
    try {
      await res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: 'What is your object of choice?',
          // Indicates it'll be an ephemeral message
          flags: InteractionResponseFlags.EPHEMERAL,
          components: [
            {
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  type: MessageComponentTypes.STRING_SELECT,
                  // Append game ID
                  custom_id: `select_choice_${gameId}`,
                  options: getShuffledOptions(),
                },
              ],
            },
          ],
        },
      });
      // Delete previous message
      await DiscordRequest(endpoint, { method: 'DELETE' });
    } catch (err) {
      console.error('Error sending message:', err);
    }
  }
  
  async function handleSelectChoice(componentId, req, data, res) {
    const gameId = componentId.replace('select_choice_', '');
  
    if (activeGames[gameId]) {
      // Get user ID and object choice for responding user
      const userId = req.body.member.user.id;
      const objectName = data.values[0];
      // Calculate result from helper function
      const resultStr = getResult(activeGames[gameId], {
        id: userId,
        objectName,
      });
  
      // Remove game from storage
      delete activeGames[gameId];
      // Update message with token in request body
      const endpoint = buildMessageIdEndpoint(req.body.token, req.body.message.id);
  
      try {
        // Send results
        await res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: resultStr },
        });
        // Update ephemeral message
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: {
            content: 'Nice choice ' + getRandomEmoji(),
            components: []
          }
        });
      } catch (err) {
        console.error('Error sending message:', err);
      }
    }
  }
  
  async function handleDeclineButton(req, res) {
    const endpoint = buildMessageIdEndpoint(req.body.token, req.body.message.id);
    await sendReplyMessageInChannel(res, "Game was declined", { flags: InteractionResponseFlags.EPHEMERAL });
    await DiscordRequest(endpoint, { method: 'DELETE' });
  }
  
 export async function handleInteractionRequest (req, res) {
    // Interaction type and data
    const { type, id, data, member } = req.body;
    console.log(data);
  
    /**
     * Handle verification requests
     */
    if (type === InteractionType.PING) {
      return res.send({ type: InteractionResponseType.PONG });
    }
    
    /**
     * Handle slash command requests
     * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
     */
    if (type === InteractionType.APPLICATION_COMMAND) {
      console.log("using app command")
      const { name } = data;
  
      // "test" command
      if (name === 'test') {
        // Send a message into the channel where command was triggered from
        return handleTestCommand(res, member);
      }
      // "challenge" command
      if (name === 'challenge' && id) {
        return handleChallengeCommand(req, id, res);
      }
    }
    if (type === InteractionType.MESSAGE_COMPONENT) {
      console.log("using message component")
      // custom_id set in payload when sending message component
      console.log(data)
      const componentId = data.custom_id;
      
      if (componentId.startsWith('accept_button_')) {
        // get the associated game ID
        await handleAcceptButton(componentId, req, res);
      }
      else if(componentId.startsWith('decline_button_')) {
        await handleDeclineButton(req, res);
      }
      else if (componentId.startsWith('select_choice_')) {
        // get the associated game ID
        await handleSelectChoice(componentId, req, data, res);
      }
    }
  }