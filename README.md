Custom Discord Bot in dev.

## Slash Commands

### Support Commands
- `/contact-support`
- `/write-a-review`
- `/feature-request`
- `/brand`

Support commands (`/contact-support`, `/write-a-review`, `/feature-request`) require a `message` option and are intended for user input that should be routed to admins.

`/brand` requires a `manufacturer` option and returns a GT7 brand badge to the user.

## Support Command Behavior

- Support commands are restricted to `#support`.
- If used outside `#support`, the user is notified via DM and an admin log is posted.
- Valid support submissions are forwarded to `#admin`.
- Users receive a thank-you confirmation via DM.
- In-channel acknowledgements are not shown to users.

## Environment Variables

Required:
- `DISCORD_TOKEN`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_APPLICATION_ID`

Recommended channel overrides:
- `DISCORD_SUPPORT_CHANNEL_ID` (used instead of searching for `#support`)
- `DISCORD_ADMIN_CHANNEL_ID` (used instead of searching for `#admin`)

## Register Commands

Before running locally, copy the env template:

`cp .dev.vars.example .dev.vars`

After adding or changing slash commands, re-register them with:

`npm run register`