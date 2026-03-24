import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import {
  InteractionResponseType,
  InteractionType,
  InteractionResponseFlags,
} from 'discord-interactions';
import {
  CONTACTSUPPORT_COMMAND,
  WRITEAREVIEW_COMMAND,
  FEATUREREQUEST_COMMAND,
  HOSTARACE_COMMAND,
} from '../src/commands.js';
import sinon from 'sinon';
import server from '../src/server.js';

describe('Server', () => {
  describe('GET /', () => {
    it('should return a greeting message with the Discord application ID', async () => {
      const request = {
        method: 'GET',
        url: new URL('/', 'http://discordo.example'),
      };
      const env = { DISCORD_APPLICATION_ID: '123456789' };

      const response = await server.fetch(request, env);
      const body = await response.text();

      expect(body).to.equal('👋 123456789');
    });
  });

  describe('POST /', () => {
    let verifyDiscordRequestStub;

    beforeEach(() => {
      verifyDiscordRequestStub = sinon.stub(server, 'verifyDiscordRequest');
    });

    afterEach(() => {
      verifyDiscordRequestStub.restore();
    });

    it('should handle a PING interaction', async () => {
      const interaction = {
        type: InteractionType.PING,
      };

      const request = {
        method: 'POST',
        url: new URL('/', 'http://discordo.example'),
      };

      const env = {};

      verifyDiscordRequestStub.resolves({
        isValid: true,
        interaction: interaction,
      });

      const response = await server.fetch(request, env);
      const body = await response.json();
      expect(body.type).to.equal(InteractionResponseType.PONG);
    });

    it('should handle an unknown command interaction', async () => {
      const interaction = {
        type: InteractionType.APPLICATION_COMMAND,
        data: {
          name: 'unknown',
        },
      };

      const request = {
        method: 'POST',
        url: new URL('/', 'http://discordo.example'),
      };

      verifyDiscordRequestStub.resolves({
        isValid: true,
        interaction: interaction,
      });

      const response = await server.fetch(request, {});
      const body = await response.json();
      expect(response.status).to.equal(400);
      expect(body.error).to.equal('Unknown Type');
    });

    it('should handle a CONTACTSUPPORT command interaction', async () => {
      const interaction = {
        type: InteractionType.APPLICATION_COMMAND,
        data: {
          name: CONTACTSUPPORT_COMMAND.name,
          options: [
            { name: 'message', value: 'Need help with setup' },
          ],
        },
      };

      const request = {
        method: 'POST',
        url: new URL('/', 'http://discordo.example'),
      };

      verifyDiscordRequestStub.resolves({
        isValid: true,
        interaction: interaction,
      });

      const response = await server.fetch(request, {});
      const body = await response.json();
      expect(body.type).to.equal(
        InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      );
      expect(body.data.flags).to.equal(InteractionResponseFlags.EPHEMERAL);
    });

    it('should handle a WRITEAREVIEW command interaction', async () => {
      const interaction = {
        type: InteractionType.APPLICATION_COMMAND,
        data: {
          name: WRITEAREVIEW_COMMAND.name,
          options: [
            { name: 'message', value: 'Great command set, really useful' },
          ],
        },
      };

      const request = {
        method: 'POST',
        url: new URL('/', 'http://discordo.example'),
      };

      verifyDiscordRequestStub.resolves({
        isValid: true,
        interaction: interaction,
      });

      const response = await server.fetch(request, {});
      const body = await response.json();
      expect(body.type).to.equal(
        InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      );
      expect(body.data.flags).to.equal(InteractionResponseFlags.EPHEMERAL);
    });

    it('should handle a FEATUREREQUEST command interaction', async () => {
      const interaction = {
        type: InteractionType.APPLICATION_COMMAND,
        data: {
          name: FEATUREREQUEST_COMMAND.name,
          options: [
            { name: 'message', value: 'Please add setup presets' },
          ],
        },
      };

      const request = {
        method: 'POST',
        url: new URL('/', 'http://discordo.example'),
      };

      verifyDiscordRequestStub.resolves({
        isValid: true,
        interaction: interaction,
      });

      const response = await server.fetch(request, {});
      const body = await response.json();
      expect(body.type).to.equal(
        InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      );
      expect(body.data.flags).to.equal(InteractionResponseFlags.EPHEMERAL);
    });

    it('should handle a HOSTARACE command interaction', async () => {
      const interaction = {
        type: InteractionType.APPLICATION_COMMAND,
        data: {
          name: HOSTARACE_COMMAND.name,
          options: [
            { name: 'lobby_title', value: 'Friday Night Sprint' },
            { name: 'type', value: 'Race' },
            { name: 'track', value: 'Trial Mountain' },
            { name: 'time_pst', value: '8:30 PM PST' },
          ],
        },
      };

      const request = {
        method: 'POST',
        url: new URL('/', 'http://discordo.example'),
      };

      verifyDiscordRequestStub.resolves({
        isValid: true,
        interaction: interaction,
      });

      const response = await server.fetch(request, {});
      const body = await response.json();
      expect(body.type).to.equal(
        InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      );
      expect(body.data.flags).to.equal(InteractionResponseFlags.EPHEMERAL);
    });

    it('should post host-a-race message and admin log when used in #host-a-race', async () => {
      const interaction = {
        type: InteractionType.APPLICATION_COMMAND,
        channel_id: '111',
        member: { user: { username: 'tester', id: 'u1' } },
        data: {
          name: HOSTARACE_COMMAND.name,
          options: [
            { name: 'lobby_title', value: 'Friday Night Sprint' },
            { name: 'type', value: 'Race' },
            { name: 'track', value: 'Trial Mountain' },
            { name: 'time_pst', value: '8:30 PM PST' },
          ],
        },
      };

      const request = {
        method: 'POST',
        url: new URL('/', 'http://discordo.example'),
      };

      const env = {
        DISCORD_TOKEN: 'bot-token',
        DISCORD_HOST_A_RACE_CHANNEL_ID: '111',
        DISCORD_ADMIN_CHANNEL_ID: '222',
      };

      verifyDiscordRequestStub.resolves({
        isValid: true,
        interaction,
      });

      const fetchStub = sinon.stub(global, 'fetch');
      fetchStub.callsFake((url) => {
        if (url === 'https://discord.com/api/v10/channels/111/messages') {
          return Promise.resolve({ ok: true, status: 200, statusText: 'OK', text: async () => '' });
        }
        if (url === 'https://discord.com/api/v10/channels/222/messages') {
          return Promise.resolve({ ok: true, status: 200, statusText: 'OK', text: async () => '' });
        }
        return Promise.resolve({ ok: true, status: 200, statusText: 'OK', text: async () => '' });
      });

      let waited;
      const ctx = { waitUntil: (p) => { waited = p; } };

      const response = await server.fetch(request, env, ctx);
      const body = await response.json();
      expect(body.type).to.equal(
        InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      );
      expect(body.data.flags).to.equal(InteractionResponseFlags.EPHEMERAL);

      await waited;

      expect(fetchStub.withArgs('https://discord.com/api/v10/channels/111/messages', sinon.match.any).calledOnce).to.be.true;
      expect(fetchStub.withArgs('https://discord.com/api/v10/channels/222/messages', sinon.match.any).calledOnce).to.be.true;
      fetchStub.restore();
    });

    it('should DM user and log admin error when host-a-race posting fails', async () => {
      const interaction = {
        type: InteractionType.APPLICATION_COMMAND,
        channel_id: '111',
        member: { user: { username: 'tester', id: 'u1' } },
        data: {
          name: HOSTARACE_COMMAND.name,
          options: [
            { name: 'lobby_title', value: 'Friday Night Sprint' },
            { name: 'type', value: 'Race' },
            { name: 'track', value: 'Trial Mountain' },
            { name: 'time_pst', value: '8:30 PM PST' },
          ],
        },
      };

      const request = {
        method: 'POST',
        url: new URL('/', 'http://discordo.example'),
      };

      const env = {
        DISCORD_TOKEN: 'bot-token',
        DISCORD_HOST_A_RACE_CHANNEL_ID: '111',
        DISCORD_ADMIN_CHANNEL_ID: '222',
      };

      verifyDiscordRequestStub.resolves({
        isValid: true,
        interaction,
      });

      const fetchStub = sinon.stub(global, 'fetch');
      fetchStub.callsFake((url) => {
        if (url === 'https://discord.com/api/v10/channels/111/messages') {
          return Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error', text: async () => 'host channel failure' });
        }
        if (url === 'https://discord.com/api/v10/channels/222/messages') {
          return Promise.resolve({ ok: true, status: 200, statusText: 'OK', text: async () => '' });
        }
        if (url === 'https://discord.com/api/v10/users/@me/channels') {
          return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: async () => ({ id: 'dm1' }), text: async () => '' });
        }
        if (url === 'https://discord.com/api/v10/channels/dm1/messages') {
          return Promise.resolve({ ok: true, status: 200, statusText: 'OK', text: async () => '' });
        }
        return Promise.resolve({ ok: true, status: 200, statusText: 'OK', text: async () => '' });
      });

      let waited;
      const ctx = { waitUntil: (p) => { waited = p; } };

      const response = await server.fetch(request, env, ctx);
      const body = await response.json();
      expect(body.type).to.equal(
        InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      );
      expect(body.data.flags).to.equal(InteractionResponseFlags.EPHEMERAL);

      await waited;

      expect(fetchStub.withArgs('https://discord.com/api/v10/channels/111/messages', sinon.match.any).calledOnce).to.be.true;
      expect(fetchStub.withArgs('https://discord.com/api/v10/channels/222/messages', sinon.match.any).calledOnce).to.be.true;
      expect(fetchStub.withArgs('https://discord.com/api/v10/users/@me/channels', sinon.match.any).calledOnce).to.be.true;
      expect(fetchStub.withArgs('https://discord.com/api/v10/channels/dm1/messages', sinon.match.any).calledOnce).to.be.true;
      fetchStub.restore();
    });
  });

  describe('All other routes', () => {
    it('should return a "Not Found" response', async () => {
      const request = {
        method: 'GET',
        url: new URL('/unknown', 'http://discordo.example'),
      };
      const response = await server.fetch(request, {});
      expect(response.status).to.equal(404);
      const body = await response.text();
      expect(body).to.equal('Not Found.');
    });
  });
});
