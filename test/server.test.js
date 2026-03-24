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
