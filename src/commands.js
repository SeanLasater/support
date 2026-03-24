// race-restrictions
export const RACERESTRICTIONS_COMMAND = {
  name: 'race-restrictions',
  description: 'Post race restrictions for Wednesday events.',
  options: [
    {
      name: 'name',
      description: 'Race name',
      type: 3, // string
      required: true,
    },
    {
      name: 'class',
      description: 'Car class or specific car',
      type: 3, // string
      required: true,
    },
    {
      name: 'tyre',
      description: 'Tyre restrictions',
      type: 3, // string
      required: true,
      autocomplete: true,
    },
    {
      name: 'prohibited',
      description: 'Prohibited items',
      type: 3, // string
      required: true,
    },
    {
      name: 'damage',
      description: 'Damage settings',
      type: 3, // string
      required: true,
      autocomplete: true,
    },
    {
      name: 'notes',
      description: 'Additional notes (optional)',
      type: 3, // string
      required: false,
    },
  ],
};

export const CONTACTSUPPORT_COMMAND = {
  name: 'contact-support',
  description: 'Send a support message to the admin team.',
  options: [
    {
      name: 'message',
      description: 'Describe the issue or support request',
      type: 3,
      required: true,
    },
  ],
};

export const WRITEAREVIEW_COMMAND = {
  name: 'write-a-review',
  description: 'Share feedback about the bot and its functionality.',
  options: [
    {
      name: 'message',
      description: 'Share your review or thoughts',
      type: 3,
      required: true,
    },
  ],
};

export const FEATUREREQUEST_COMMAND = {
  name: 'feature-request',
  description: 'Request a new bot feature.',
  options: [
    {
      name: 'message',
      description: 'Describe the feature you would like to see',
      type: 3,
      required: true,
    },
  ],
};

export const HOSTARACE_COMMAND = {
  name: 'host-a-race',
  description: 'Create a race lobby post in #host-a-race.',
  options: [
    {
      name: 'lobby_title',
      description: 'Lobby title',
      type: 3,
      required: true,
    },
    {
      name: 'type',
      description: 'Event type',
      type: 3,
      required: true,
      choices: [
        { name: 'Race', value: 'Race' },
        { name: 'Funzies', value: 'Funzies' },
        { name: 'Drift', value: 'Drift' },
      ],
    },
    {
      name: 'track',
      description: 'Track name',
      type: 3,
      required: true,
      autocomplete: true,
    },
    {
      name: 'time_pst',
      description: 'Start time in PST',
      type: 3,
      required: true,
    },
    {
      name: 'psn_name',
      description: 'PSN name',
      type: 3,
      required: false,
    },
    {
      name: 'class',
      description: 'Class',
      type: 3,
      required: false,
    },
    {
      name: 'tyre',
      description: 'Tyre',
      type: 3,
      required: false,
      autocomplete: true,
    },
    {
      name: 'damage',
      description: 'Damage setting',
      type: 3,
      required: false,
      autocomplete: true,
    },
    {
      name: 'prohibited',
      description: 'Prohibited items',
      type: 3,
      required: false,
    },
    {
      name: 'notes',
      description: 'Additional notes',
      type: 3,
      required: false,
    },
  ],
};