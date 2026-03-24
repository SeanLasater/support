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
  RACERESTRICTIONS_COMMAND,
  CONTACTSUPPORT_COMMAND,
  WRITEAREVIEW_COMMAND,
  FEATUREREQUEST_COMMAND,
  HOSTARACE_COMMAND,
} from './commands.js';

import { DAMAGE_CHOICES } from './damageData.js';
import { TRACK_CHOICES } from './transData.js';
import { TIRE_CHOICES } from './downforceData.js';
import { JsonResponse } from './utils.js';

// ──────────────────────────────────────────────────────────────
// RACE RESTRICTIONS COMMAND HANDLER
// This function processes the /race-restrictions command and returns a formatted restrictions message.
// ──────────────────────────────────────────────────────────────

function handleRaceRestrictionsCommand(interaction) {
  const { data } = interaction;
  const options = Object.fromEntries((data.options ?? []).map(opt => [opt.name, opt.value]));
  const name = options.name || '';
  const classOrCar = options.class || '';
  const tyreValue = options.tyre || '';
  const prohibited = options.prohibited || '';
  const damageValue = options.damage || '';
  const notes = options.notes || '';

  // Get current day of the month and add ordinal suffix
  const today = new Date();
  const dayOfMonth = today.getDate();
  
  // Function to add ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
  function getOrdinalDay(n) {
    if (n > 3 && n < 21) return `${n}th`;
    switch (n % 10) {
      case 1: return `${n}st`;
      case 2: return `${n}nd`;
      case 3: return `${n}rd`;
      default: return `${n}th`;
    }
  }
  
  const ordinalDay = getOrdinalDay(dayOfMonth);

  // Look up tire name from TIRE_CHOICES
  const tireChoice = TIRE_CHOICES.find(t => t.value === tyreValue);
  const tyreName = tireChoice ? tireChoice.name : tyreValue;

  // Look up damage name from DAMAGE_CHOICES
  const damageChoice = DAMAGE_CHOICES.find(d => d.value === damageValue);
  const damageName = damageChoice ? damageChoice.name : damageValue;

  // Build the description with proper formatting
  let description = `**${name}**\n\n*Livery Required!!*\n\n**Class :** ${classOrCar}\n\n**Tyre :** ${tyreName}\n\n**Prohibited :** ${prohibited}\n\n**Damage :** ${damageName}`;
  
  if (notes) {
    description += `\n\n${notes}`;
  }

  return {
    embeds: [{
      title: `Wednesday the ${ordinalDay} Restrictions :`,
      description: description,
      color: 0xff4500,
      timestamp: new Date().toISOString(),
    }],
  };
}

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

async function findHostARaceChannelId(interaction, env) {
  const configuredId = normalizeChannelId(env.DISCORD_HOST_A_RACE_CHANNEL_ID);
  if (configuredId) {
    return configuredId;
  }

  return findChannelIdByName(interaction, env, 'host-a-race');
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

function buildHostRacePost(interaction) {
  const options = Object.fromEntries((interaction?.data?.options ?? []).map(opt => [opt.name, opt.value]));
  const tyreChoice = TIRE_CHOICES.find(t => t.value === options.tyre);
  const tyreValue = tyreChoice ? tyreChoice.name : options.tyre;
  const damageChoice = DAMAGE_CHOICES.find(d => d.value === options.damage);
  const damageValue = damageChoice ? damageChoice.name : options.damage;

  const details = [
    { name: 'Type', value: options.type, inline: true },
    { name: 'Track', value: options.track, inline: true },
    { name: 'Time (PST)', value: options.time_pst, inline: true },
  ];

  if (options.psn_name) details.push({ name: 'PSN Name', value: options.psn_name, inline: true });
  if (options.class) details.push({ name: 'Class', value: options.class, inline: true });
  if (tyreValue) details.push({ name: 'Tyre', value: tyreValue, inline: true });
  if (damageValue) details.push({ name: 'Damage', value: damageValue, inline: true });
  if (options.prohibited) details.push({ name: 'Prohibited', value: options.prohibited, inline: false });
  if (options.notes) details.push({ name: 'Notes', value: options.notes, inline: false });

  return {
    content: '🏁 New lobby is up!',
    embeds: [
      {
        title: `🎮 ${options.lobby_title}`,
        color: 0x00b894,
        description: 'React to this post to let us know you are joining!',
        fields: details,
        footer: { text: 'Hosted with /host-a-race' },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

async function processHostRaceCommand(interaction, env) {
  const username = getInteractionUsername(interaction);
  const token = env.DISCORD_TOKEN;
  const hostRaceChannelId = await findHostARaceChannelId(interaction, env);
  const invokedChannelId = normalizeChannelId(interaction?.channel_id);

  if (!hostRaceChannelId || !invokedChannelId || hostRaceChannelId !== invokedChannelId) {
    await sendDirectMessage(interaction, env, {
      content: 'Please use /host-a-race in #host-a-race so the lobby post goes to the correct channel.',
    });
    await sendAdminMessage(interaction, env, `⚠️ ${username} tried /${HOSTARACE_COMMAND.name} outside #host-a-race.`);
    return;
  }

  const postContent = buildHostRacePost(interaction);
  const posted = await postMessageToChannel(hostRaceChannelId, token, postContent);

  if (posted.ok) {
    await sendAdminMessage(interaction, env, `${username} posted /${HOSTARACE_COMMAND.name} in #host-a-race.`);
    return;
  }

  await sendAdminMessage(interaction, env, `⚠️ Failed to post /${HOSTARACE_COMMAND.name} for ${username}: ${posted.error}`);
  await sendDirectMessage(interaction, env, {
    content: 'I could not post your race lobby to #host-a-race right now. Please try again shortly.',
  });
}

// ──────────────────────────────────────────────────────────────
// AUTOCOMPLETE INTERACTION HANDLER
// ──────────────────────────────────────────────────────────────

function handleAutocomplete(interaction) {
  const { data } = interaction;
  const focusedOption = data.options?.find(opt => opt.focused);

  if (!focusedOption) {
    return new JsonResponse({
      type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
      data: { choices: [] },
    });
  }

  if (focusedOption.name === 'track') {
    const focusedValue = focusedOption.value.toLowerCase();
    const filtered = TRACK_CHOICES
      .filter(track => track.name.toLowerCase().includes(focusedValue))
      .slice(0, 25);

    return new JsonResponse({
      type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
      data: {
        choices: filtered.map(track => ({
          name: track.name,
          value: track.value,
        })),
      },
    });
  }

  if (focusedOption.name === 'tyre') {
    const focusedValue = String(focusedOption.value || '').toLowerCase();
    const filtered = TIRE_CHOICES
      .filter(tyre => tyre.name.toLowerCase().includes(focusedValue))
      .slice(0, 25);

    return new JsonResponse({
      type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
      data: {
        choices: filtered.map(tyre => ({
          name: tyre.name,
          value: tyre.value,
        })),
      },
    });
  }

  if (focusedOption.name === 'damage') {
    const focusedValue = String(focusedOption.value || '').toLowerCase();
    const filtered = DAMAGE_CHOICES
      .filter(damage => damage.name.toLowerCase().includes(focusedValue))
      .slice(0, 25);

    return new JsonResponse({
      type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
      data: {
        choices: filtered.map(damage => ({
          name: damage.name,
          value: damage.value,
        })),
      },
    });
  }

  return new JsonResponse({
    type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
    data: { choices: [] },
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
      case RACERESTRICTIONS_COMMAND.name.toLowerCase(): {
        messagePayload = handleRaceRestrictionsCommand(interaction);
        break;
      }

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

      case HOSTARACE_COMMAND.name.toLowerCase(): {
        supportIntakeCommand = {
          commandName: HOSTARACE_COMMAND.name,
          requestKind: 'Host A Race',
        };
        break;
      }

      default:
        return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
    }

    const sendPromise = (async () => {
      if (supportIntakeCommand) {
        if (supportIntakeCommand.commandName === HOSTARACE_COMMAND.name) {
          await processHostRaceCommand(interaction, env);
          await deleteOriginalInteractionMessage(interaction, env);
          return;
        }

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