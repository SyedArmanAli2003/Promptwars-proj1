const cells = document.querySelectorAll('.cell');
const statusText = document.getElementById('turn-indicator');
const btnReset = document.getElementById('btn-reset');
const btnPvP = document.getElementById('btn-pvp');
const btnPvC = document.getElementById('btn-pvc');
const modal = document.getElementById('modal');
const modalText = document.getElementById('winner-text');
const btnModalClose = document.getElementById('btn-modal-close');

let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let gameActive = false;
let gameMode = 'pvp'; // 'pvp' or 'pvc'
let humanPlayer = 'X';
let aiPlayer = 'O';

const winConditions = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];

initGame();

function initGame() {
    cells.forEach(cell => cell.addEventListener('click', cellClicked));
    btnReset.addEventListener('click', restartGame);
    btnPvP.addEventListener('click', () => setMode('pvp'));
    btnPvC.addEventListener('click', () => setMode('pvc'));
    btnModalClose.addEventListener('click', closeModal);
    gameActive = true;
    updateStatus();
}

function setMode(mode) {
    if (gameMode === mode) return;
    gameMode = mode;
    
    if (mode === 'pvp') {
        btnPvP.classList.add('active');
        btnPvC.classList.remove('active');
    } else {
        btnPvC.classList.add('active');
        btnPvP.classList.remove('active');
    }
    
    restartGame();
}

function cellClicked() {
    const cellIndex = this.getAttribute('data-index');

    if (board[cellIndex] !== '' || !gameActive) {
        return;
    }

    if (gameMode === 'pvc' && currentPlayer !== humanPlayer) {
        return; // Prevent clicking during AI turn
    }

    updateCell(this, cellIndex);
    checkWinner();

    if (gameActive && gameMode === 'pvc' && currentPlayer === aiPlayer) {
        setTimeout(aiMove, 400); // Thinking delay
    }
}

function updateCell(cell, index) {
    board[index] = currentPlayer;
    const span = document.createElement('span');
    span.textContent = currentPlayer;
    
    cell.classList.add('occupied');
    if (currentPlayer === 'X') {
        cell.classList.add('x-mark');
    } else {
        cell.classList.add('o-mark');
    }
    
    cell.appendChild(span);
}

function changePlayer() {
    currentPlayer = (currentPlayer === 'X') ? 'O' : 'X';
    updateStatus();
}

function updateStatus() {
    if (gameMode === 'pvc') {
        if (currentPlayer === humanPlayer) {
            statusText.textContent = `P1 TURN [${currentPlayer}]`;
        } else {
            statusText.textContent = `COM TURN [${currentPlayer}]`;
        }
    } else {
        const pStr = currentPlayer === 'X' ? 'P1' : 'P2';
        statusText.textContent = `${pStr} TURN [${currentPlayer}]`;
    }
}

function checkWinner() {
    let roundWon = false;
    let winningPlayer = null;

    for (let i = 0; i < winConditions.length; i++) {
        const condition = winConditions[i];
        const cellA = board[condition[0]];
        const cellB = board[condition[1]];
        const cellC = board[condition[2]];

        if (cellA === '' || cellB === '' || cellC === '') {
            continue;
        }
        if (cellA === cellB && cellB === cellC) {
            roundWon = true;
            winningPlayer = cellA;
            break;
        }
    }

    if (roundWon) {
        let winStr = "";
        if (gameMode === 'pvc') {
            winStr = winningPlayer === humanPlayer ? "P1 WINS!" : "COM WINS!";
        } else {
            winStr = winningPlayer === 'X' ? "P1 WINS!" : "P2 WINS!";
        }
        showModal(winStr);
        gameActive = false;
    } else if (!board.includes('')) {
        showModal("DRAW!");
        gameActive = false;
    } else {
        changePlayer();
    }
}

function showModal(message) {
    modalText.textContent = message;
    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
    restartGame();
}

function restartGame() {
    board = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = 'X';
    gameActive = true;
    updateStatus();
    cells.forEach(cell => {
        cell.innerHTML = '';
        cell.classList.remove('occupied', 'x-mark', 'o-mark');
    });
}

/* --- Minimax AI --- */
function aiMove() {
    if (!gameActive) return;

    let bestScore = -Infinity;
    let move;

    // Small randomization for the very first move to add variety if AI goes first 
    // (though in this implementation, Player X always goes first)
    
    for (let i = 0; i < board.length; i++) {
        if (board[i] === '') {
            board[i] = aiPlayer;
            let score = minimax(board, 0, false);
            board[i] = '';
            if (score > bestScore) {
                bestScore = score;
                move = i;
            }
        }
    }

    if (move !== undefined) {
        const cell = document.querySelector(`.cell[data-index='${move}']`);
        updateCell(cell, move);
        checkWinner();
    }
}

function checkWinTemp(b) {
    for (let i = 0; i < winConditions.length; i++) {
        const condition = winConditions[i];
        if (b[condition[0]] !== '' && 
            b[condition[0]] === b[condition[1]] && 
            b[condition[1]] === b[condition[2]]) {
            return b[condition[0]];
        }
    }
    if (!b.includes('')) return 'tie';
    return null;
}

function minimax(b, depth, isMaximizing) {
    let result = checkWinTemp(b);
    if (result !== null) {
        if (result === 'tie') return 0;
        return result === aiPlayer ? 10 - depth : depth - 10;
    }

    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < b.length; i++) {
            if (b[i] === '') {
                b[i] = aiPlayer;
                let score = minimax(b, depth + 1, false);
                b[i] = '';
                bestScore = Math.max(score, bestScore);
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < b.length; i++) {
            if (b[i] === '') {
                b[i] = humanPlayer;
                let score = minimax(b, depth + 1, true);
                b[i] = '';
                bestScore = Math.min(score, bestScore);
            }
        }
        return bestScore;
    }
}
