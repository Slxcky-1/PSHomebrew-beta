# Scripts Folder

Utility scripts for bot management.

## Available Scripts

- **deploy-commands.js** - Deploy slash commands to Discord
  ```bash
  node scripts/deploy-commands.js
  ```

- **clear-commands.js** - Remove all bot commands from Discord
  ```bash
  node scripts/clear-commands.js
  ```

- **encrypt-config.js** - Encrypt/decrypt config.json
  ```bash
  node scripts/encrypt-config.js encrypt  # Encrypt config.json → .secure-config
  node scripts/encrypt-config.js decrypt  # Decrypt .secure-config → config.json
  ```

- **remove-command.js** - Remove specific command by ID
  ```bash
  node scripts/remove-command.js
  ```
