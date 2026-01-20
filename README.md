# 🏔️ Mountain Goats

A strategic board game built with React where players climb mountains, collect tokens, and compete for the highest score!

## ✨ Features

- 🎮 Interactive web UI built with React
- 🎯 Strategic board game with numbered mountains (5-10)
- 🎲 Dice-based gameplay with 4 six-sided dice
- 🎨 Color-coded players (2-4 players: Black, White, Red, Yellow)
- 🪙 Point tokens and bonus tokens
- 📱 Responsive design with modern UI
- ♿ Full accessibility support (ARIA labels, keyboard navigation)
- 🌍 Internationalization (i18n) ready
- 🧪 Comprehensive test suite
- 💾 Game state persistence with localStorage
- ⌨️ Keyboard shortcuts for all actions

## 🚀 Getting Started

### Requirements

- **Node.js** 18+
- **pnpm** (install with `npm install -g pnpm`)

### Installation

Install dependencies:

```bash
pnpm install
```

### Development

Start the development server:

```bash
pnpm dev
```

The game will be available at `http://localhost:3000`

### Building for Production

Build the game:

```bash
pnpm build
```

Preview the production build:

```bash
pnpm preview
```

## 🧪 Testing

Run tests:

```bash
pnpm test
```

Run tests with UI:

```bash
pnpm test:ui
```

Run tests with coverage:

```bash
pnpm test:coverage
```

## 🔧 Code Quality

### Linting

Check for linting issues:

```bash
pnpm lint
```

Auto-fix linting issues:

```bash
pnpm lint:fix
```

### Formatting

Format code:

```bash
pnpm format
```

Check formatting:

```bash
pnpm format:check
```

### Full Check

Run linting, formatting, and type checking:

```bash
pnpm check
```

## 🎮 Gameplay

### Setup

1. Enter player names (2-4 players)
2. Each player starts with one goat at the foot of each mountain
3. Point tokens are placed above each mountain based on player count
4. 4 bonus tokens are available at the top

### Turn Structure

1. **Roll Dice**: 4 dice are automatically rolled at the start of your turn
2. **Multiple 1s Rule**: If more than one "1" is rolled, you can change all but one "1" to any value from 2-6
3. **Select Dice**: Click dice to select them (they turn blue). All selected dice form a grouping
4. **Move Goat**: If the sum of your selected dice equals a mountain number (5-10), click your goat on that mountain to move it up 1 cell
5. **Claim Tokens**: When your goat reaches the top of a mountain, you claim a point token from that mountain (if available)
6. **Continue or End**: You can make multiple moves per turn using different dice groupings, or end your turn with unused dice

### Special Rules

- **Multiple Goats**: Multiple goats can share the same space, except at the top of the mountain
- **Knocking**: If you move to the top and another player's goat is there, it gets knocked to the bottom
- **Already at Top**: If your goat is already at the top and you create a valid grouping, you claim a token instead of moving
- **Exact Match**: The dice sum must exactly equal the mountain number (e.g., sum of 7 can only move on mountain 7)

### Bonus Tokens

When you collect at least one point token from each of the 6 mountains (5-10), you automatically claim the highest-value bonus token still available. Additional complete sets claim additional bonus tokens.

### Game End

The game ends when:

- All bonus tokens have been claimed, OR
- 3 mountains have no more point tokens remaining

When either condition is met, continue playing until all players have had an equal number of turns. Then the game is over.

### Winning

The player with the most points wins! In case of a tie:

1. The tied player with the most goats on mountain tops wins
2. If still tied, the tied player with a goat on the higher numbered mountain wins

## ⌨️ Keyboard Shortcuts

- **Cmd+/** (or **Ctrl+/**): Open/Close shortcuts modal
- **Esc**: Close modal
- **N**: Next turn
- **E**: Edit editable dice
- **1-6**: Change editable dice or select dice with that value
- **C**: Clear dice selection
- **Enter**: Move goat on valid mountain
- **Cmd+Shift+R** (or **Ctrl+Shift+R**): Reset game and hard refresh

## 🛠️ Technologies Used

- **React**: UI framework
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **Vitest**: Fast unit test framework
- **Biome**: Fast formatter and linter
- **Testing Library**: Testing utilities

## ♿ Accessibility

The game includes comprehensive accessibility features:

- ARIA labels and roles throughout
- Keyboard navigation support
- Screen reader compatibility
- Semantic HTML structure
- Focus management
- Skip links

## 🌍 Internationalization

The game is fully internationalized with support for:

- English (default)
- Easy to add more languages by creating new locale files

## 🚀 Next Steps

Adding undo functionalities, and playing over multiple devices, rather than just pass and play on a single device.

## 📝 License

MIT

---

Enjoy the game! 🎲🎯
