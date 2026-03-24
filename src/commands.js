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

export const BRAND_COMMAND = {
  name: 'brand',
  description: 'Get a GT7 favorite brand badge.',
  options: [
    {
      name: 'manufacturer',
      description: 'Select your favorite GT7 manufacturer',
      type: 3,
      required: true,
      autocomplete: true,
    },
  ],
};