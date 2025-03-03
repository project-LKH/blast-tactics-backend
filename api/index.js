const express = require("express")
const cors = require("cors")

const app = express()
app.use(cors())
app.use(cors({ origin: "https://project-lkh.github.io" }));


app.use(express.json())

let games = {}
app.get("/", (req, res) => {
    res.json({ message: "API is working!" });
});

app.post("/create-game", (req, res) => {
    const gameId = Math.random().toString(36).substr(2, 6)
    games[gameId] = {
        grid: Array(6).fill(null).map(() => Array(6).fill({ value: 0, owner: null })),
        currentPlayer: 1,
        gameOver: false,
        winner: null,
    }
    res.json({ gameId })
})

app.get("/game-state/:gameId", (req, res) => {
    const game = games[req.params.gameId]
    if (game) res.json({ gameState: game })
    else res.status(404).json({ error: "Game not found" })
})

app.post("/move", (req, res) => {
    const { gameId, row, col, player } = req.body
    if (!games[gameId]) return res.status(404).json({ error: "Game not found" })

    const game = games[gameId]
    game.grid[row][col] = { value: game.grid[row][col].value + 1, owner: player }
    game.currentPlayer = player === 1 ? 2 : 1
    res.json({ gameState: game })
})


module.exports = app
