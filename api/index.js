const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "https://project-lkh.github.io" }));
app.use(express.json());

let games = {};

app.get("/", (req, res) => {
    res.json({ message: "API is working!" });
});

// Create a new game
app.post("/create-game", (req, res) => {
    const gameId = Math.random().toString(36).slice(2, 8);
    games[gameId] = {
        grid: Array(6).fill(null).map(() => Array(6).fill({ value: 0, owner: null })),
        players: [],
        currentPlayer: 1,
        gameOver: false,
        winner: null,
        lastUpdated: Date.now(),
    };
    res.json({ gameId });
});

// Join a game
app.post("/join-game", (req, res) => {
    const { gameId } = req.body;
    if (!games[gameId]) {
        return res.status(404).json({ error: "Game not found" });
    }
    if (games[gameId].players.length >= 2) {
        return res.status(400).json({ error: "Game is full" });
    }

    const playerId = games[gameId].players.length + 1;
    games[gameId].players.push(playerId);

    res.json({ playerId, gameState: games[gameId] });
});

// Get game state
app.get("/game-state/:gameId", (req, res) => {
    const game = games[req.params.gameId];
    if (game) {
        console.log(`Game ${req.params.gameId} has ${game.players.length} players`);
        res.json({ gameState: game });
    } else {
        console.log(games)
        res.status(404).json({ error: "Game not found" });
    }
});

// Make a move
app.post("/move", (req, res) => {
    const { gameId, row, col, player } = req.body;
    if (!games[gameId]) return res.status(404).json({ error: "Game not found" });

    const game = games[gameId];
    if (game.currentPlayer !== player) {
        return res.status(400).json({ error: "Not your turn!" });
    }

    const newGrid = structuredClone(game.grid);

    if (newGrid[row][col].owner !== null && newGrid[row][col].owner !== player) {
        return res.status(400).json({ error: "Invalid move on opponent's cell" });
    }

    newGrid[row][col].value++;
    newGrid[row][col].owner = player;

    checkForExplosions(game, player);

    if (checkForWin(newGrid, player)) {
        game.gameOver = true;
        game.winner = player;
    } else {
        game.currentPlayer = player === 1 ? 2 : 1;
    }

    game.grid = newGrid;
    game.lastUpdated = Date.now();

    res.json({ gameState: game });
});

// Long polling for real-time updates
app.get("/wait-for-update/:gameId", async (req, res) => {
    const { gameId } = req.params;
    if (!games[gameId]) return res.status(404).json({ error: "Game not found" });

    const lastCheck = Date.now();
    while (Date.now() - lastCheck < 30000) {
        if (Date.now() - games[gameId].lastUpdated < 1000) {
            return res.json({ gameState: games[gameId] });
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    res.status(204).end();
});

// Reset Game
app.post("/reset-game", (req, res) => {
    const { gameId } = req.body;
    if (!games[gameId]) {
        return res.status(404).json({ error: "Game not found" });
    }

    games[gameId] = {
        grid: Array(6).fill(null).map(() => Array(6).fill({ value: 0, owner: null })),
        players: games[gameId].players,
        currentPlayer: 1,
        gameOver: false,
        winner: null,
        lastUpdated: Date.now(),
    };

    res.json({ message: "Game reset", gameState: games[gameId] });
});


// Check for explosions
function checkForExplosions(game, player) {
    const grid = game.grid;
    let queue = [];

    // First, find all overfilled cells
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 6; col++) {
            if (shouldExplode(grid, row, col)) {
                queue.push({ row, col });
            }
        }
    }

    // Process the queue (BFS)
    while (queue.length > 0) {
        let { row, col } = queue.shift();
        let cell = grid[row][col];

        // Reset the current cell
        cell.value = 0;
        cell.owner = null;

        // Distribute to neighbors
        let neighbors = [
            [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]
        ];

        for (let [r, c] of neighbors) {
            if (r >= 0 && r < 6 && c >= 0 && c < 6) {
                grid[r][c].value++;
                grid[r][c].owner = player;

                // If this cell now needs to explode, add it to the queue
                if (shouldExplode(grid, r, c)) {
                    queue.push({ row: r, col: c });
                }
            }
        }
    }
}

// Helper function to check explosion threshold
function shouldExplode(grid, row, col) {
    let neighbors = 0;
    if (row > 0) neighbors++; // Top
    if (row < 5) neighbors++; // Bottom
    if (col > 0) neighbors++; // Left
    if (col < 5) neighbors++; // Right

    return grid[row][col].value >= neighbors;
}


// Check for a win
function checkForWin(grid, player) {
    return grid.flat().every(cell => cell.owner !== (player === 1 ? 2 : 1));
}

module.exports = app;
