import { AztecAddress } from '@aztec/aztec.js/addresses';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { EmbeddedWallet } from './embedded-wallet';
import { TreasureHuntContract } from './artifacts/TreasureHunt';

// Game status constants (matching contract)
const STATUS_CREATED = 0n;
const STATUS_SETUP = 1n;
const STATUS_PLAYING = 2n;
const STATUS_AWAITING = 3n;
const STATUS_FINISHED = 4n;

// Pending action types
const ACTION_NONE = 0n;
const ACTION_DIG = 1n;
const ACTION_DETECTOR = 2n;
const ACTION_COMPASS = 3n;

// Grid size
const GRID_SIZE = 8;

// DOM Elements
const createAccountButton = document.querySelector<HTMLButtonElement>('#create-account')!;
const connectTestAccountButton = document.querySelector<HTMLButtonElement>('#connect-test-account')!;
const accountDisplay = document.querySelector<HTMLDivElement>('#account-display')!;
const statusMessage = document.querySelector<HTMLDivElement>('#status-message')!;
const testAccountNumber = document.querySelector<HTMLSelectElement>('#test-account-number')!;

// Lobby elements
const gameIdInput = document.querySelector<HTMLInputElement>('#game-id-input')!;
const createGameBtn = document.querySelector<HTMLButtonElement>('#create-game-btn')!;
const joinGameBtn = document.querySelector<HTMLButtonElement>('#join-game-btn')!;
const gameInfo = document.querySelector<HTMLDivElement>('#game-info')!;
const currentGameIdSpan = document.querySelector<HTMLSpanElement>('#current-game-id')!;
const gameStatusSpan = document.querySelector<HTMLSpanElement>('#game-status')!;
const turnIndicatorSpan = document.querySelector<HTMLSpanElement>('#turn-indicator')!;

// Section elements
const lobbySection = document.querySelector<HTMLDivElement>('#lobby-section')!;
const setupSection = document.querySelector<HTMLDivElement>('#setup-section')!;
const gameSection = document.querySelector<HTMLDivElement>('#game-section')!;
const responseSection = document.querySelector<HTMLDivElement>('#response-section')!;
const winnerSection = document.querySelector<HTMLDivElement>('#winner-section')!;

// Setup elements
const setupGrid = document.querySelector<HTMLDivElement>('#setup-grid')!;
const selectedCountSpan = document.querySelector<HTMLSpanElement>('#selected-count')!;
const confirmTreasuresBtn = document.querySelector<HTMLButtonElement>('#confirm-treasures-btn')!;

// Game elements
const yourGrid = document.querySelector<HTMLDivElement>('#your-grid')!;
const opponentGrid = document.querySelector<HTMLDivElement>('#opponent-grid')!;
const yourScoreSpan = document.querySelector<HTMLSpanElement>('#your-score')!;
const opponentScoreSpan = document.querySelector<HTMLSpanElement>('#opponent-score')!;
const actionHint = document.querySelector<HTMLParagraphElement>('#action-hint')!;

// Power buttons
const digBtn = document.querySelector<HTMLButtonElement>('#dig-btn')!;
const detectorBtn = document.querySelector<HTMLButtonElement>('#detector-btn')!;
const compassBtn = document.querySelector<HTMLButtonElement>('#compass-btn')!;
const shovelBtn = document.querySelector<HTMLButtonElement>('#shovel-btn')!;
const trapBtn = document.querySelector<HTMLButtonElement>('#trap-btn')!;

// Response elements
const responseMessage = document.querySelector<HTMLParagraphElement>('#response-message')!;
const respondBtn = document.querySelector<HTMLButtonElement>('#respond-btn')!;

// Winner elements
const winnerMessage = document.querySelector<HTMLHeadingElement>('#winner-message')!;
const newGameBtn = document.querySelector<HTMLButtonElement>('#new-game-btn')!;

// Refresh button
const refreshBtn = document.querySelector<HTMLButtonElement>('#refresh-btn')!;

// Local state
let wallet: EmbeddedWallet;
let contractAddress = process.env.CONTRACT_ADDRESS;
let deployerAddress = process.env.DEPLOYER_ADDRESS;
let deploymentSalt = process.env.DEPLOYMENT_SALT;
let nodeUrl = process.env.AZTEC_NODE_URL;

let currentGameId: Fr | null = null;
let myAddress: AztecAddress | null = null;
let selectedAction: string = 'dig';
let selectedTreasures: { x: number; y: number }[] = [];
let myTreasurePositions: { x: number; y: number }[] = [];
let dugCells: { x: number; y: number; found: boolean }[] = [];
let isPlayer1: boolean = false;
let pendingActionData: { x: number; y: number } | null = null;

// On page load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (!contractAddress) {
      throw new Error('Missing required environment variables');
    }

    displayStatusMessage('Connecting to node and initializing wallet...');
    wallet = await EmbeddedWallet.initialize(nodeUrl!);

    displayStatusMessage('Registering contracts...');
    const instance = await getContractInstanceFromInstantiationParams(
      TreasureHuntContract.artifact,
      {
        deployer: AztecAddress.fromString(deployerAddress!),
        salt: Fr.fromString(deploymentSalt!),
        constructorArgs: [AztecAddress.fromString(deployerAddress!)],
      }
    );
    await wallet.registerContract(instance, TreasureHuntContract.artifact);

    displayStatusMessage('Checking for existing account...');
    const account = await wallet.connectExistingAccount();
    await displayAccount();

    if (account) {
      myAddress = account;
      displayStatusMessage('Ready to play!');
    } else {
      displayStatusMessage('Create a new account to play.');
    }
  } catch (error) {
    console.error(error);
    displayError(error instanceof Error ? error.message : 'An unknown error occurred');
  }
});

// Create a new account
createAccountButton.addEventListener('click', async (e) => {
  e.preventDefault();
  const button = e.target as HTMLButtonElement;
  button.disabled = true;
  button.textContent = 'Creating account...';

  try {
    displayStatusMessage('Creating account...');
    const account = await wallet.createAccountAndConnect();
    myAddress = account;
    displayAccount();
    displayStatusMessage('Account created! Ready to play.');
  } catch (error) {
    console.error(error);
    displayError(error instanceof Error ? error.message : 'An unknown error occurred');
  } finally {
    button.disabled = false;
    button.textContent = 'Create Account';
  }
});

// Connect a test account
connectTestAccountButton.addEventListener('click', async (e) => {
  e.preventDefault();
  const button = e.target as HTMLButtonElement;
  button.disabled = true;
  button.textContent = 'Connecting test account...';

  try {
    const index = Number(testAccountNumber.value) - 1;
    const testAccount = await wallet.connectTestAccount(index);
    myAddress = testAccount;
    displayAccount();
    displayStatusMessage('Test account connected! Ready to play.');
  } catch (error) {
    console.error(error);
    displayError(error instanceof Error ? error.message : 'An unknown error occurred');
  } finally {
    button.disabled = false;
    button.textContent = 'Connect Test Account';
  }
});

// Create Game
createGameBtn.addEventListener('click', async () => {
  const gameId = Number(gameIdInput.value);
  if (isNaN(gameId) || gameId < 1) {
    displayError('Please enter a valid Game ID');
    return;
  }

  createGameBtn.disabled = true;
  createGameBtn.textContent = 'Creating...';

  try {
    displayStatusMessage('Creating game...');
    const contract = TreasureHuntContract.at(
      AztecAddress.fromString(contractAddress!),
      wallet
    );

    await contract.methods
      .create_game(new Fr(gameId))
      .send({ from: myAddress! })
      .wait();

    currentGameId = new Fr(gameId);
    isPlayer1 = true;
    displayStatusMessage('Game created! Waiting for player 2 to join...');
    await refreshGameState();
  } catch (error) {
    console.error(error);
    displayError(error instanceof Error ? error.message : 'Failed to create game');
  } finally {
    createGameBtn.disabled = false;
    createGameBtn.textContent = 'Create Game';
  }
});

// Join Game
joinGameBtn.addEventListener('click', async () => {
  const gameId = Number(gameIdInput.value);
  if (isNaN(gameId) || gameId < 1) {
    displayError('Please enter a valid Game ID');
    return;
  }

  joinGameBtn.disabled = true;
  joinGameBtn.textContent = 'Joining...';

  try {
    displayStatusMessage('Joining game...');
    const contract = TreasureHuntContract.at(
      AztecAddress.fromString(contractAddress!),
      wallet
    );

    await contract.methods
      .join_game(new Fr(gameId))
      .send({ from: myAddress! })
      .wait();

    currentGameId = new Fr(gameId);
    isPlayer1 = false;
    displayStatusMessage('Joined game! Place your treasures.');
    await refreshGameState();
  } catch (error) {
    console.error(error);
    displayError(error instanceof Error ? error.message : 'Failed to join game');
  } finally {
    joinGameBtn.disabled = false;
    joinGameBtn.textContent = 'Join Game';
  }
});

// Confirm Treasures
confirmTreasuresBtn.addEventListener('click', async () => {
  if (selectedTreasures.length !== 3) {
    displayError('Please select exactly 3 treasure positions');
    return;
  }

  confirmTreasuresBtn.disabled = true;
  confirmTreasuresBtn.textContent = 'Placing treasures...';

  try {
    displayStatusMessage('Placing treasures on blockchain...');
    const contract = TreasureHuntContract.at(
      AztecAddress.fromString(contractAddress!),
      wallet
    );

    const [t1, t2, t3] = selectedTreasures;
    await contract.methods
      .place_treasures(
        currentGameId!,
        t1.x,
        t1.y,
        t2.x,
        t2.y,
        t3.x,
        t3.y
      )
      .send({ from: myAddress! })
      .wait();

    myTreasurePositions = [...selectedTreasures];
    displayStatusMessage('Treasures placed! Waiting for game to start...');
    await refreshGameState();
  } catch (error) {
    console.error(error);
    displayError(error instanceof Error ? error.message : 'Failed to place treasures');
  } finally {
    confirmTreasuresBtn.disabled = false;
    confirmTreasuresBtn.textContent = 'Confirm Treasures';
  }
});

// Power button handlers
const powerButtons = [digBtn, detectorBtn, compassBtn, shovelBtn, trapBtn];
powerButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    powerButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedAction = btn.id.replace('-btn', '');
    updateActionHint();
  });
});

function updateActionHint() {
  const hints: { [key: string]: string } = {
    dig: 'Click on opponent\'s grid to dig',
    detector: 'Click center of 3x3 area to scan',
    compass: 'Click to get direction to nearest treasure',
    shovel: 'Select your treasure, then new position',
    trap: 'Click on your grid to place a trap',
  };
  actionHint.textContent = hints[selectedAction] || '';
}

// Respond button
respondBtn.addEventListener('click', async () => {
  respondBtn.disabled = true;
  respondBtn.textContent = 'Responding...';

  try {
    displayStatusMessage('Sending response...');
    const contract = TreasureHuntContract.at(
      AztecAddress.fromString(contractAddress!),
      wallet
    );

    const pendingAction = await contract.methods
      .get_pending_action(currentGameId!)
      .simulate({ from: myAddress! });

    if (pendingAction === ACTION_DIG) {
      await contract.methods
        .respond_dig(currentGameId!)
        .send({ from: myAddress! })
        .wait();
    } else if (pendingAction === ACTION_DETECTOR && pendingActionData) {
      await contract.methods
        .respond_detector(currentGameId!, pendingActionData.x, pendingActionData.y)
        .send({ from: myAddress! })
        .wait();
    } else if (pendingAction === ACTION_COMPASS && pendingActionData) {
      await contract.methods
        .respond_compass(currentGameId!, pendingActionData.x, pendingActionData.y)
        .send({ from: myAddress! })
        .wait();
    }

    displayStatusMessage('Response sent!');
    await refreshGameState();
  } catch (error) {
    console.error(error);
    displayError(error instanceof Error ? error.message : 'Failed to respond');
  } finally {
    respondBtn.disabled = false;
    respondBtn.textContent = 'Respond';
  }
});

// Refresh button
refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  await refreshGameState();
  refreshBtn.disabled = false;
});

// New Game button
newGameBtn.addEventListener('click', () => {
  currentGameId = null;
  selectedTreasures = [];
  myTreasurePositions = [];
  dugCells = [];
  pendingActionData = null;
  showSection('lobby');
  gameInfo.style.display = 'none';
  refreshBtn.style.display = 'none';
});

// Handle opponent grid clicks
function handleOpponentGridClick(x: number, y: number) {
  switch (selectedAction) {
    case 'dig':
      performDig(x, y);
      break;
    case 'detector':
      performDetector(x, y);
      break;
    case 'compass':
      performCompass(x, y);
      break;
  }
}

// Handle your grid clicks (for shovel and trap)
function handleYourGridClick(x: number, y: number) {
  switch (selectedAction) {
    case 'trap':
      performTrap(x, y);
      break;
    case 'shovel':
      // For shovel, first click selects treasure, second click selects new position
      // Simplified: just prompt for new position
      break;
  }
}

async function performDig(x: number, y: number) {
  try {
    displayStatusMessage('Digging...');
    const contract = TreasureHuntContract.at(
      AztecAddress.fromString(contractAddress!),
      wallet
    );

    await contract.methods
      .dig(currentGameId!, x, y)
      .send({ from: myAddress! })
      .wait();

    displayStatusMessage('Dig action sent! Waiting for opponent to respond...');
    await refreshGameState();
  } catch (error) {
    console.error(error);
    displayError(error instanceof Error ? error.message : 'Failed to dig');
  }
}

async function performDetector(x: number, y: number) {
  try {
    displayStatusMessage('Using detector...');
    const contract = TreasureHuntContract.at(
      AztecAddress.fromString(contractAddress!),
      wallet
    );

    await contract.methods
      .use_detector(currentGameId!, x, y)
      .send({ from: myAddress! })
      .wait();

    pendingActionData = { x, y };
    displayStatusMessage('Detector used! Waiting for opponent to respond...');
    await refreshGameState();
  } catch (error) {
    console.error(error);
    displayError(error instanceof Error ? error.message : 'Failed to use detector');
  }
}

async function performCompass(x: number, y: number) {
  try {
    displayStatusMessage('Using compass...');
    const contract = TreasureHuntContract.at(
      AztecAddress.fromString(contractAddress!),
      wallet
    );

    await contract.methods
      .use_compass(currentGameId!, x, y)
      .send({ from: myAddress! })
      .wait();

    pendingActionData = { x, y };
    displayStatusMessage('Compass used! Waiting for opponent to respond...');
    await refreshGameState();
  } catch (error) {
    console.error(error);
    displayError(error instanceof Error ? error.message : 'Failed to use compass');
  }
}

async function performTrap(x: number, y: number) {
  try {
    displayStatusMessage('Placing trap...');
    const contract = TreasureHuntContract.at(
      AztecAddress.fromString(contractAddress!),
      wallet
    );

    await contract.methods
      .use_trap(currentGameId!, x, y)
      .send({ from: myAddress! })
      .wait();

    displayStatusMessage('Trap placed!');
    await refreshGameState();
  } catch (error) {
    console.error(error);
    displayError(error instanceof Error ? error.message : 'Failed to place trap');
  }
}

// Refresh game state from contract
async function refreshGameState() {
  if (!currentGameId) return;

  try {
    displayStatusMessage('Refreshing game state...');
    const contract = TreasureHuntContract.at(
      AztecAddress.fromString(contractAddress!),
      wallet
    );

    const status = await contract.methods
      .get_game_status(currentGameId)
      .simulate({ from: myAddress! });

    const player1 = await contract.methods
      .get_player1(currentGameId)
      .simulate({ from: myAddress! });

    const player2 = await contract.methods
      .get_player2(currentGameId)
      .simulate({ from: myAddress! });

    isPlayer1 = player1.toString() === myAddress!.toString();

    // Update game info display
    currentGameIdSpan.textContent = currentGameId.toString();
    gameStatusSpan.textContent = getStatusText(status);
    gameInfo.style.display = 'block';
    refreshBtn.style.display = 'block';

    // Update turn indicator
    const currentTurn = await contract.methods
      .get_current_turn(currentGameId)
      .simulate({ from: myAddress! });

    const isMyTurn = (currentTurn === 1n && isPlayer1) || (currentTurn === 2n && !isPlayer1);
    turnIndicatorSpan.textContent = isMyTurn ? 'Your turn' : 'Opponent\'s turn';

    // Update scores
    const p1Score = await contract.methods
      .get_player1_treasures_found(currentGameId)
      .simulate({ from: myAddress! });
    const p2Score = await contract.methods
      .get_player2_treasures_found(currentGameId)
      .simulate({ from: myAddress! });

    if (isPlayer1) {
      yourScoreSpan.textContent = p1Score.toString();
      opponentScoreSpan.textContent = p2Score.toString();
    } else {
      yourScoreSpan.textContent = p2Score.toString();
      opponentScoreSpan.textContent = p1Score.toString();
    }

    // Determine which section to show based on game status
    if (status === STATUS_CREATED) {
      showSection('lobby');
      displayStatusMessage('Waiting for player 2 to join...');
    } else if (status === STATUS_SETUP) {
      // Check if we need to place treasures
      const gameReady = await contract.methods
        .is_game_ready(currentGameId)
        .simulate({ from: myAddress! });

      if (!gameReady) {
        showSection('setup');
        renderSetupGrid();
        displayStatusMessage('Place your 3 treasures on the grid');
      } else {
        displayStatusMessage('Waiting for both players to place treasures...');
      }
    } else if (status === STATUS_PLAYING) {
      showSection('game');
      renderYourGrid();
      renderOpponentGrid();

      if (isMyTurn) {
        displayStatusMessage('Your turn! Select an action and click on the grid.');
        enableGameActions(true);
      } else {
        displayStatusMessage('Waiting for opponent\'s move...');
        enableGameActions(false);
      }
    } else if (status === STATUS_AWAITING) {
      // Check if we need to respond
      const pendingAction = await contract.methods
        .get_pending_action(currentGameId)
        .simulate({ from: myAddress! });

      if (pendingAction !== ACTION_NONE) {
        // The non-current player needs to respond
        if (!isMyTurn) {
          showSection('response');
          responseMessage.textContent = getResponseMessage(pendingAction);
        } else {
          showSection('game');
          renderYourGrid();
          renderOpponentGrid();
          displayStatusMessage('Waiting for opponent to respond...');
          enableGameActions(false);
        }
      }
    } else if (status === STATUS_FINISHED) {
      showSection('winner');
      const winner = await contract.methods
        .get_winner(currentGameId)
        .simulate({ from: myAddress! });

      const isWinner = winner.toString() === myAddress!.toString();
      winnerMessage.textContent = isWinner ? 'You Win!' : 'You Lose!';
      winnerMessage.style.color = isWinner ? '#27ae60' : '#e74c3c';
    }

    displayStatusMessage('');
  } catch (error) {
    console.error(error);
    displayError(error instanceof Error ? error.message : 'Failed to refresh game state');
  }
}

function getStatusText(status: bigint): string {
  switch (status) {
    case STATUS_CREATED:
      return 'Waiting for players';
    case STATUS_SETUP:
      return 'Setup phase';
    case STATUS_PLAYING:
      return 'Playing';
    case STATUS_AWAITING:
      return 'Awaiting response';
    case STATUS_FINISHED:
      return 'Finished';
    default:
      return 'Unknown';
  }
}

function getResponseMessage(action: bigint): string {
  switch (action) {
    case ACTION_DIG:
      return 'Opponent is digging! Click Respond to reveal if they found treasure.';
    case ACTION_DETECTOR:
      return 'Opponent used detector! Click Respond to reveal treasure count.';
    case ACTION_COMPASS:
      return 'Opponent used compass! Click Respond to reveal direction.';
    default:
      return 'Action required';
  }
}

function showSection(section: string) {
  lobbySection.style.display = section === 'lobby' ? 'block' : 'none';
  setupSection.style.display = section === 'setup' ? 'block' : 'none';
  gameSection.style.display = section === 'game' ? 'flex' : 'none';
  responseSection.style.display = section === 'response' ? 'block' : 'none';
  winnerSection.style.display = section === 'winner' ? 'block' : 'none';
}

function enableGameActions(enabled: boolean) {
  opponentGrid.classList.toggle('clickable', enabled);
  powerButtons.forEach((btn) => (btn.disabled = !enabled));
}

// Render setup grid for placing treasures
function renderSetupGrid() {
  setupGrid.innerHTML = '';
  setupGrid.classList.add('clickable');

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.x = x.toString();
      cell.dataset.y = y.toString();

      // Check if this cell is selected
      const isSelected = selectedTreasures.some((t) => t.x === x && t.y === y);
      if (isSelected) {
        cell.classList.add('selected');
      }

      cell.addEventListener('click', () => {
        const idx = selectedTreasures.findIndex((t) => t.x === x && t.y === y);
        if (idx >= 0) {
          selectedTreasures.splice(idx, 1);
        } else if (selectedTreasures.length < 3) {
          selectedTreasures.push({ x, y });
        }
        selectedCountSpan.textContent = selectedTreasures.length.toString();
        confirmTreasuresBtn.disabled = selectedTreasures.length !== 3;
        renderSetupGrid();
      });

      setupGrid.appendChild(cell);
    }
  }
}

// Render your grid showing your treasures
function renderYourGrid() {
  yourGrid.innerHTML = '';

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.x = x.toString();
      cell.dataset.y = y.toString();

      // Check if this is a treasure position
      const isTreasure = myTreasurePositions.some((t) => t.x === x && t.y === y);
      if (isTreasure) {
        cell.classList.add('treasure');
      }

      cell.addEventListener('click', () => {
        handleYourGridClick(x, y);
      });

      yourGrid.appendChild(cell);
    }
  }
}

// Render opponent's grid for gameplay
function renderOpponentGrid() {
  opponentGrid.innerHTML = '';

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.x = x.toString();
      cell.dataset.y = y.toString();

      // Check if this cell was dug
      const dugCell = dugCells.find((d) => d.x === x && d.y === y);
      if (dugCell) {
        cell.classList.add(dugCell.found ? 'dug-found' : 'dug-empty');
      }

      cell.addEventListener('click', () => {
        handleOpponentGridClick(x, y);
      });

      opponentGrid.appendChild(cell);
    }
  }
}

// UI functions
function displayError(message: string) {
  statusMessage.textContent = message;
  statusMessage.classList.add('error');
  statusMessage.classList.remove('success');
  statusMessage.style.display = 'block';
}

function displayStatusMessage(message: string) {
  statusMessage.textContent = message;
  statusMessage.classList.remove('error');
  statusMessage.classList.remove('success');
  statusMessage.style.display = message ? 'block' : 'none';
}

function displayAccount() {
  const connectedAccount = wallet.getConnectedAccount();
  if (!connectedAccount) {
    createAccountButton.style.display = 'block';
    testAccountNumber.style.display = 'block';
    connectTestAccountButton.style.display = 'block';
    createGameBtn.disabled = true;
    joinGameBtn.disabled = true;
    return;
  }

  const address = connectedAccount.toString();
  const content = `Account: ${address.slice(0, 6)}...${address.slice(-4)}`;
  accountDisplay.textContent = content;
  createAccountButton.style.display = 'none';
  connectTestAccountButton.style.display = 'none';
  testAccountNumber.style.display = 'none';
  createGameBtn.disabled = false;
  joinGameBtn.disabled = false;
}
