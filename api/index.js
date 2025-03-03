const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(cors({ origin: "https://project-lkh.github.io" }));

app.use(express.json());

let games = {};

app.get("/", (req, res) => {
    res.json({ message: "API is working!" });
});

// Create a new game
app.post("/create-game", (req, res) => {
    const gameId = Math.random().toString(36).substr(2, 6);
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
    
    res.json({ playerId });
});

// Get game state
app.get("/game-state/:gameId", (req, res) => {
    const game = games[req.params.gameId];
    if (game) {
        res.json({ gameState: game });
    } else {
        res.status(404).json({ error: "Game not found" });
    }
});

// Make a move
app.post("/move", (req, res) => {
    const { gameId, row, col, player } = req.body;
    if (!games[gameId]) return res.status(404).json({ error: "Game not found" });

    const game = games[gameId];

    // Ensure it's the player's turn
    if (game.currentPlayer !== player) {
        return res.status(400).json({ error: "Not your turn!" });
    }

    // Clone the grid to avoid mutation
    const newGrid = JSON.parse(JSON.stringify(game.grid));

    // Ensure valid move
    if (newGrid[row][col].owner !== null && newGrid[row][col].owner !== player) {
        return res.status(400).json({ error: "Invalid move on opponent's cell" });
    }

    newGrid[row][col].value++;
    newGrid[row][col].owner = player;

    // Check for explosions
    checkForExplosions(newGrid, player);

    // Check for win condition
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
    while (Date.now() - lastCheck < 30000) { // 30 sec timeout
        if (Date.now() - games[gameId].lastUpdated < 1000) { // Check if game updated
            return res.json({ gameState: games[gameId] });
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 sec
    }
    res.status(204).end(); // No updates
});

// Check for explosions
function checkForExplosions(grid, player) {
    let changed = false;
    do {
        changed = false;
        const newGrid = JSON.parse(JSON.stringify(grid));

        grid.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                const maxCapacity =
                    (rowIndex === 0 || rowIndex === 5 ? 1 : 2) +
                    (colIndex === 0 || colIndex === 5 ? 1 : 2);

                if (cell.value >= maxCapacity) {
                    newGrid[rowIndex][colIndex].value = 0;
                    newGrid[rowIndex][colIndex].owner = null;

                    const neighbors = [
                        [rowIndex - 1, colIndex],
                        [rowIndex + 1, colIndex],
                        [rowIndex, colIndex - 1],
                        [rowIndex, colIndex + 1],
                    ];

                    neighbors.forEach(([r, c]) => {
                        if (r >= 0 && r < 6 && c >= 0 && c < 6) {
                            newGrid[r][c].value++;
                            newGrid[r][c].owner = player;
                        }
                    });

                    changed = true;
                }
            });
        });

        grid = JSON.parse(JSON.stringify(newGrid));
    } while (changed);
}

// Check for a win
function checkForWin(grid, player) {
    const opponent = player === 1 ? 2 : 1;
    let opponentCells = 0;

    grid.forEach(row => {
        row.forEach(cell => {
            if (cell.owner === opponent) {
                opponentCells++;
            }
        });
    });

    return opponentCells === 0;
}

module.exports = app;
