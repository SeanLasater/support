// Server-side code for Cloudflare Worker handling Discord interactions for support workflows.
// This file defines the HTTP request handler, command processing logic, and Discord message routing.

// It uses the itty-router library for routing and discord-interactions for request verification and response formatting.

// ──────────────────────────────────────────────────────────────
// IMPORTS
// ──────────────────────────────────────────────────────────────
import { AutoRouter } from 'itty-router';

import {
  InteractionResponseType,
  InteractionType,
  InteractionResponseFlags,
  verifyKey,
} from 'discord-interactions';

import { 
  CONTACTSUPPORT_COMMAND,
  WRITEAREVIEW_COMMAND,
  FEATUREREQUEST_COMMAND,
  BRAND_COMMAND,
} from './commands.js';

import { BRAND_CHOICES } from './brandData.js';
import { JsonResponse } from './utils.js';

// ──────────────────────────────────────────────────────────────
// SUPPORT INTAKE PROCESSING
// ──────────────────────────────────────────────────────────────

async function sendDirectMessage(interaction, env, messagePayload) {
  const token = env.DISCORD_TOKEN;
  const userId = interaction?.member?.user?.id || interaction?.user?.id;

  if (!token || !userId) {
    return false;
  }

  const dmChannelResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${token}`,
    },
    body: JSON.stringify({ recipient_id: userId }),
  });

  if (!dmChannelResponse.ok) {
    const errorText = await dmChannelResponse.text().catch(() => '<no body>');
    console.error(`Failed to open DM channel: ${dmChannelResponse.status} ${dmChannelResponse.statusText}`, errorText);
    return false;
  }

  const dmChannel = await dmChannelResponse.json();
  const dmMessageResponse = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${token}`,
    },
    body: JSON.stringify(messagePayload),
  });

  if (!dmMessageResponse.ok) {
    const errorText = await dmMessageResponse.text().catch(() => '<no body>');
    console.error(`Failed to send DM: ${dmMessageResponse.status} ${dmMessageResponse.statusText}`, errorText);
    return false;
  }

  return true;
}

function getInteractionUsername(interaction) {
  return interaction?.member?.user?.global_name
    || interaction?.member?.user?.username
    || interaction?.user?.global_name
    || interaction?.user?.username
    || 'Unknown user';
}

function getOptionValue(interaction, optionName) {
  const options = interaction?.data?.options || [];
  const found = options.find(option => option.name === optionName);
  return found?.value;
}

function normalizeChannelId(value) {
  if (!value) return null;
  const normalized = String(value).replace(/[^0-9]/g, '');
  return normalized.length > 0 ? normalized : null;
}

async function findChannelIdByName(interaction, env, targetName) {
  const token = env.DISCORD_TOKEN;
  const guildId = interaction.guild_id;

  if (!token || !guildId) {
    return null;
  }

  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
    method: 'GET',
    headers: {
      Authorization: `Bot ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '<no body>');
    console.error(`Failed to fetch guild channels: ${response.status} ${response.statusText}`, errorText);
    return null;
  }

  const channels = await response.json();
  const targetChannel = channels.find(channel => channel?.name?.toLowerCase() === targetName.toLowerCase() && channel?.type === 0);
  return targetChannel?.id || null;
}

async function findAdminChannelId(interaction, env) {
  const configuredId = normalizeChannelId(env.DISCORD_ADMIN_CHANNEL_ID);
  if (configuredId) {
    return configuredId;
  }

  return findChannelIdByName(interaction, env, 'admin');
}

async function findSupportChannelId(interaction, env) {
  const configuredId = normalizeChannelId(env.DISCORD_SUPPORT_CHANNEL_ID);
  if (configuredId) {
    return configuredId;
  }

  return findChannelIdByName(interaction, env, 'support');
}

async function postMessageToChannel(channelId, token, message) {
  if (!channelId || !token) {
    return { ok: false, error: 'Missing channel id or token.' };
  }

  const payload = typeof message === 'string'
    ? { content: message }
    : message;

  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '<no body>');
    return {
      ok: false,
      error: `Failed to send message: ${response.status} ${response.statusText} ${errorText}`,
    };
  }

  return { ok: true };
}

async function sendAdminMessage(interaction, env, message) {
  const token = env.DISCORD_TOKEN;
  const configuredChannelId = normalizeChannelId(env.DISCORD_ADMIN_CHANNEL_ID);
  const channelId = configuredChannelId || await findAdminChannelId(interaction, env);

  if (!token || !channelId) {
    console.error('Missing bot token or #admin channel id; cannot send admin message.');
    return false;
  }

  const primarySend = await postMessageToChannel(channelId, token, message);
  if (primarySend.ok) {
    return true;
  }

  const fallbackChannelId = await findChannelIdByName(interaction, env, 'admin');
  if (!fallbackChannelId || fallbackChannelId === channelId) {
    console.error(`Failed to send admin message: ${primarySend.error}`);
    return false;
  }

  const fallbackSend = await postMessageToChannel(fallbackChannelId, token, message);
  if (!fallbackSend.ok) {
    console.error(`Failed to send admin message with configured and fallback channel ids: ${primarySend.error} | ${fallbackSend.error}`);
    return false;
  }

  return true;
}

async function deleteOriginalInteractionMessage(interaction, env) {
  const appId = env.DISCORD_APPLICATION_ID || interaction.application_id;
  const interactionToken = interaction.token;

  if (!appId || !interactionToken) {
    return;
  }

  const response = await fetch(`https://discord.com/api/v10/webhooks/${appId}/${interactionToken}/messages/@original`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text().catch(() => '<no body>');
    console.error(`Failed to delete original interaction message: ${response.status} ${response.statusText}`, errorText);
  }
}

function buildSupportForwardMessage(interaction, commandName, messageBody, requestKind) {
  const username = getInteractionUsername(interaction);
  const userId = interaction?.member?.user?.id || interaction?.user?.id || 'unknown-user-id';
  const sanitizedMessage = String(messageBody || '').trim();

  return [
    `📨 ${requestKind}`,
    `User: ${username} (${userId})`,
    `Command: /${commandName}`,
    'Message:',
    sanitizedMessage,
  ].join('\n');
}

function buildBrandBadgePayload(interaction) {
  const manufacturer = String(getOptionValue(interaction, 'manufacturer') || '').trim();
  const selectedBrand = BRAND_CHOICES.find(choice => choice.value === manufacturer);
  const brandName = selectedBrand ? selectedBrand.name : manufacturer;
  const safeBrandName = brandName || 'Unknown Brand';
  const badgeUrl = `https://img.shields.io/badge/Favorite%20GT7%20Brand-${encodeURIComponent(safeBrandName)}-e10600?style=for-the-badge`;

  return {
    embeds: [
      {
        title: 'Your Favorite GT7 Brand Badge',
        description: `🏁 **${safeBrandName}**`,
        image: { url: badgeUrl },
        color: 0xe10600,
        footer: { text: 'Built with /brand' },
      },
    ],
  };
}

function handleAutocomplete(interaction) {
  const commandName = String(interaction?.data?.name || '').toLowerCase();

  if (commandName !== BRAND_COMMAND.name.toLowerCase()) {
    return new JsonResponse({
      type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
      data: { choices: [] },
    });
  }

  const options = interaction?.data?.options || [];
  const focusedOption = options.find(option => option.focused);

  if (!focusedOption || focusedOption.name !== 'manufacturer') {
    return new JsonResponse({
      type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
      data: { choices: [] },
    });
  }

  const focusedValue = String(focusedOption.value || '').toLowerCase();
  const filteredChoices = BRAND_CHOICES
    .filter(choice => choice.name.toLowerCase().includes(focusedValue))
    .slice(0, 25);

  return new JsonResponse({
    type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
    data: {
      choices: filteredChoices,
    },
  });
}

async function processSupportIntake(interaction, env, commandName, requestKind) {
  const username = getInteractionUsername(interaction);
  const supportChannelId = await findSupportChannelId(interaction, env);
  const invokedChannelId = interaction?.channel_id;

  if (!supportChannelId || !invokedChannelId || supportChannelId !== invokedChannelId) {
    await sendDirectMessage(interaction, env, {
      content: 'Please use this command in #support so your message gets routed correctly.',
    });
    await sendAdminMessage(interaction, env, `⚠️ ${username} tried /${commandName} outside #support.`);
    return;
  }

  const messageBody = getOptionValue(interaction, 'message');
  const adminMessage = buildSupportForwardMessage(interaction, commandName, messageBody, requestKind);
  const sentToAdmin = await sendAdminMessage(interaction, env, adminMessage);

  if (sentToAdmin) {
    const confirmation = [
      `Thanks for the ${requestKind.toLowerCase()}!`,
      'Your message was sent! The admin team will review it as soon as possible.',
      'We are a one-man operation working hard to deliver great functionality at the lowest price possible, and we truly appreciate your support.',
    ].join(' ');
    const dmSent = await sendDirectMessage(interaction, env, { content: confirmation });
    if (!dmSent) {
      await sendAdminMessage(interaction, env, `⚠️ Failed to send confirmation DM to ${username} for /${commandName}.`);
    }
    return;
  }

  await sendDirectMessage(interaction, env, {
    content: 'Thanks for reaching out. I could not forward your message to #admin right now, please try again shortly.',
  });
}

// ──────────────────────────────────────────────────────────────
// ROUTER AND SERVER SETUP
// ──────────────────────────────────────────────────────────────

const router = AutoRouter();

router.get('/', (request, env) => {
  return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

router.post('/', async (request, env, ctx) => {
  const { isValid, interaction } = await server.verifyDiscordRequest(
    request,
    env,
  );

  if (!isValid || !interaction) {
    return new Response('Bad request signature.', { status: 401 });
  }

  if (interaction.type === InteractionType.PING) {
    return new JsonResponse({
      type: InteractionResponseType.PONG,
    });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE) {
    return handleAutocomplete(interaction);
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    let messagePayload;
    let supportIntakeCommand = null;

    switch (interaction.data.name.toLowerCase()) {
      case CONTACTSUPPORT_COMMAND.name.toLowerCase(): {
        supportIntakeCommand = {
          commandName: CONTACTSUPPORT_COMMAND.name,
          requestKind: 'Support Request',
        };
        break;
      }

      case WRITEAREVIEW_COMMAND.name.toLowerCase(): {
        supportIntakeCommand = {
          commandName: WRITEAREVIEW_COMMAND.name,
          requestKind: 'Review',
        };
        break;
      }

      case FEATUREREQUEST_COMMAND.name.toLowerCase(): {
        supportIntakeCommand = {
          commandName: FEATUREREQUEST_COMMAND.name,
          requestKind: 'Feature Request',
        };
        break;
      }

      case BRAND_COMMAND.name.toLowerCase(): {
        messagePayload = buildBrandBadgePayload(interaction);
        break;
      }

      default:
        return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
    }

    const sendPromise = (async () => {
      if (supportIntakeCommand) {
        await processSupportIntake(
          interaction,
          env,
          supportIntakeCommand.commandName,
          supportIntakeCommand.requestKind,
        );
        await deleteOriginalInteractionMessage(interaction, env);
        return;
      }

      const sent = await sendDirectMessage(interaction, env, messagePayload).catch((error) => {
        console.error('Error sending direct message:', error);
        return false;
      });

      const username = getInteractionUsername(interaction);
      const slashCommandName = interaction?.data?.name || 'unknown-command';

      await sendAdminMessage(interaction, env, `${username} ran /${slashCommandName}`);

      if (!sent) {
        await sendAdminMessage(
          interaction,
          env,
          `⚠️ Failed to DM ${username} for /${slashCommandName}.`,
        );
      }

      await deleteOriginalInteractionMessage(interaction, env);
    })();

    if (ctx?.waitUntil) {
      ctx.waitUntil(sendPromise);
    }

    return new JsonResponse({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  }

  console.error('Unknown Type');
  return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
});

// Catch-all route for unmatched paths
router.all('*', () => new Response('Not Found.', { status: 404 }));

// Verify request authenticity using Discord's public key (prevents request spoofing)
async function verifyDiscordRequest(request, env) {
  // Extract signature and timestamp from request headers
  const signature = request.headers.get('x-signature-ed25519');            // Ed25519 signature
  const timestamp = request.headers.get('x-signature-timestamp');          // Request timestamp
  // Read entire request body as text
  const body = await request.text();
  // Verify signature is valid using Discord's verifyKey function
  const isValidRequest =
    signature &&
    timestamp &&
    (await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));
  // Return early if verification failed (prevents processing invalid requests)
  if (!isValidRequest) {
    return { isValid: false };
  }

  // Signature valid; parse body and return interaction object
  return { interaction: JSON.parse(body), isValid: true };
}

// Export server object containing request verification function and HTTP router
const server = {
  verifyDiscordRequest,          // Utility function for signature verification
  fetch: router.fetch,           // Main HTTP request handler (passed to Cloudflare Workers)
};

// Export server as default export for Cloudflare Workers runtime
export default server;