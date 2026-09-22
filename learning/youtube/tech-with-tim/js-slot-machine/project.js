
// function deposit() {
    
//     return 1
// }

const prompt = require('prompt-sync')();

const ROWS = 3;
const COLS = 3;

const SYMBOLS_COUNT = {
    "A": 2,
    "B": 4,
    "C": 6,
    "D": 8,
}

const SYMBOL_VALUES = {
    "A": 5,
    "B": 4,
    "C": 3,
    "D": 2,
}

const deposit = () => {
    while(true)
    {
        const depositAmount = prompt('How much would you like to deposit? $');
        const numberDeposit = parseFloat(depositAmount);

        if (isNaN(numberDeposit) || numberDeposit <= 0) {
            console.log('Please enter a valid amount.');
        } else {
            return numberDeposit;
        }
    }
}


const getNumberOfLines = () => {
    while(true)
    {
        const lines = prompt('Enter the number of lines to bet on (1-3): ');
        const numLines = parseFloat(lines);

        if (isNaN(numLines) || numLines <= 0 || numLines > 3) {
            console.log('Please enter a valid number of lines');
        } else {
            return numLines;
        }
    }
}

const getBet = (balance, lines) => {
    while(true)
    {
        const bet = prompt('How much would you like to bet per line? $');
        const numBet = parseFloat(bet);

        if (isNaN(numBet) || numBet <= 0 || numBet > balance/lines) {
            console.log('Please enter a valid bet.');
        } else {
            return numBet;
        }
    }
}

const spin = () => {
    const symbols = [];
    for (const [symbol, count] of Object.entries(SYMBOLS_COUNT)) {
        for (let i = 0; i < count; i++) {
            symbols.push(symbol);
        }
    }
    const reels = [];
    for (let i = 0; i < COLS; i++) {
        reels.push([]);
        const reelSymbols = [...symbols];
        for (let j = 0; j < ROWS; j++) {
            const randomIndex = Math.floor(Math.random() * reelSymbols.length);
            reels[i].push(reelSymbols[randomIndex]);
            reelSymbols.splice(randomIndex, 1);
        }
    }
    // console.log(symbols);
    // console.log(reels);
    return reels;
}

const transpose = (reels) => {
    const rows = [];
    for (let i = 0; i < ROWS; i++) {
        rows.push([]);
        for (let j = 0; j < COLS; j++) {
            rows[i].push(reels[j][i]);
        }
    }

    return rows;
}

const printRows = (rows) => {
    for (const row of rows) {
        let rowString = "";
        for (const[i, symbol] of row.entries()) {
            rowString += symbol;
            if (i < row.length - 1) {
                rowString += " | ";
            }
        }
        console.log(rowString);
    }
}

const getWinnings = (rows, bet, lines) => {
    let winnings = 0;
    for (let row = 0; row < lines; row++) {
        const symbols = rows[row];
        let allSame = true;

        for (const symbol of symbols) {
            if (symbol !== symbols[0]) {
                allSame = false;
                break;
            }
        }

        if (allSame) {
            winnings += bet * SYMBOL_VALUES[symbols[0]];
        }
    }

    return winnings;
}

const game = () => {

    let balance = deposit();

    while(true){

        const numLines = getNumberOfLines();
        const bet = getBet(balance, numLines);
        balance -= bet * numLines;
        const reels = spin();
        const rows = transpose(reels);
        printRows(rows);
        const winnings = getWinnings(rows, bet, numLines);
        console.log(`You won $${winnings}`);
        //console.log(reels);
        //console.log(rows);
        balance += winnings;
        console.log(`Your balance is $${balance}`);

        if (balance <= 0) {
            console.log('You are out of money!');
            break;
        }

        const playAgain = prompt('Would you like to play again? (y/n) ');
        if (playAgain !== 'y') {
            break;
        }
    }
}

game();