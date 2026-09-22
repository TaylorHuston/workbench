import { useState } from "react";

// This example introduces immutable updates. Instead of changing an existing
// array in place, each move creates a new board array. Keeping old arrays around
// makes features like move history possible.

function Square({ value, onSquareClick }) {
  return (
    <button className="square" type="button" onClick={onSquareClick}>
      {value}
    </button>
  );
}

function Board({ xIsNext, squares, onPlay }) {
  function handleClick(i) {
    // Ignore clicks after a square is filled or after the game has a winner.
    if (squares[i] || calculateWinner(squares)) {
      return;
    }

    // Do not mutate squares directly. Creating a new array lets React compare
    // old and new state reliably, and it preserves old board snapshots.
    const nextSquares = [...squares];
    nextSquares[i] = xIsNext ? "X" : "O";
    onPlay(nextSquares);
  }

  // winner and status are derived from props during render. They do not need
  // their own state because React can calculate them from squares and xIsNext.
  const winner = calculateWinner(squares);
  const status = winner ? `Winner: ${winner}` : `Next player: ${xIsNext ? "X" : "O"}`;

  return (
    <>
      <div className="status">{status}</div>
      <div className="board-row">
        <Square value={squares[0]} onSquareClick={() => handleClick(0)} />
        <Square value={squares[1]} onSquareClick={() => handleClick(1)} />
        <Square value={squares[2]} onSquareClick={() => handleClick(2)} />
      </div>
      <div className="board-row">
        <Square value={squares[3]} onSquareClick={() => handleClick(3)} />
        <Square value={squares[4]} onSquareClick={() => handleClick(4)} />
        <Square value={squares[5]} onSquareClick={() => handleClick(5)} />
      </div>
      <div className="board-row">
        <Square value={squares[6]} onSquareClick={() => handleClick(6)} />
        <Square value={squares[7]} onSquareClick={() => handleClick(7)} />
        <Square value={squares[8]} onSquareClick={() => handleClick(8)} />
      </div>
    </>
  );
}

export default function ImmutableUpdates() {
  // history is an array of board snapshots. Each board is an array of 9 values.
  // The first snapshot is an empty board.
  const [history, setHistory] = useState([Array(9).fill(null)]);

  // currentMove is an index into history. It decides which snapshot is shown.
  const [currentMove, setCurrentMove] = useState(0);

  // These values are derived from state. Storing them separately would create
  // duplicate state that could get out of sync.
  const xIsNext = currentMove % 2 === 0;
  const currentSquares = history[currentMove];

  function handlePlay(nextSquares) {
    // If the user jumped back in time and then plays, discard the future moves
    // before appending the new board snapshot.
    const nextHistory = [...history.slice(0, currentMove + 1), nextSquares];
    setHistory(nextHistory);
    setCurrentMove(nextHistory.length - 1);
  }

  function jumpTo(nextMove) {
    setCurrentMove(nextMove);
  }

  const moves = history.map((squares, move) => {
    const description = move > 0 ? `Go to move #${move}` : "Go to game start";

    return (
      <li key={move}>
        <button type="button" onClick={() => jumpTo(move)}>{description}</button>
      </li>
    );
  });

  return (
    <div className="game">
      <div className="game-board">
        <Board xIsNext={xIsNext} squares={currentSquares} onPlay={handlePlay} />
      </div>
      <div className="game-info">
        <ol>{moves}</ol>
      </div>
    </div>
  );
}

// Pure helper functions are easy to test because they depend only on arguments.
function calculateWinner(squares) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const line of lines) {
    const [a, b, c] = line;
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  return null;
}
