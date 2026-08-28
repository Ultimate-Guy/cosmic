# Cosmic

## Adding a game

Create a folder under `pages/lessons` containing the game. The
Pages workflow automatically scans each folder and generates
`pages/lessons/games.json` before deployment, so no lessons page edit is needed.

The registry stores the folder path, so the folder's `index.html` is opened
automatically while all nested files and assets remain available. Add an
optional `game.json` file to set a custom name or thumbnail:

```json
{
	"title": "My Game",
	"image": "thumbnail.png"
}
```

The `image` path is relative to the game folder. Without one, the game gets a
text placeholder card. Deleting a game folder removes it from the next generated
registry automatically.
