use dep::aztec::protocol_types::{
    address::AztecAddress,
    traits::{Deserialize, Serialize, Packable},
};

// Game status
pub global STATUS_CREATED: u8 = 0;      // Game created, waiting for player2
pub global STATUS_SETUP: u8 = 1;        // Both players placing treasures
pub global STATUS_PLAYING: u8 = 2;      // Game in progress
pub global STATUS_AWAITING: u8 = 3;     // Waiting for opponent response
pub global STATUS_FINISHED: u8 = 4;     // Game over

// Pending action types (when status = AWAITING)
pub global ACTION_NONE: u8 = 0;
pub global ACTION_DIG: u8 = 1;
pub global ACTION_DETECTOR: u8 = 2;
pub global ACTION_COMPASS: u8 = 3;

/// Public game state visible to everyone
#[derive(Deserialize, Serialize, Eq, Packable)]
pub struct Game {
    pub player1: AztecAddress,
    pub player2: AztecAddress,
    pub player1_setup_done: bool,
    pub player2_setup_done: bool,
    pub player1_found: u8,          // Treasures found by player1
    pub player2_found: u8,          // Treasures found by player2
    pub current_turn: AztecAddress, // Whose turn is it
    pub pending_action: u8,         // What action is awaiting response
    pub pending_x: u8,              // X coordinate for pending action
    pub pending_y: u8,              // Y coordinate for pending action
    pub status: u8,
    pub winner: AztecAddress,
    pub skip_turn: AztecAddress,    // Player who must skip next turn (due to trap)
    pub last_detector_count: u8,    // Result of last detector scan (treasures in 3x3 area)
}

impl Game {
    pub fn new(player1: AztecAddress) -> Self {
        Self {
            player1,
            player2: AztecAddress::zero(),
            player1_setup_done: false,
            player2_setup_done: false,
            player1_found: 0,
            player2_found: 0,
            current_turn: AztecAddress::zero(),
            pending_action: ACTION_NONE,
            pending_x: 0,
            pending_y: 0,
            status: STATUS_CREATED,
            winner: AztecAddress::zero(),
            skip_turn: AztecAddress::zero(),
            last_detector_count: 0,
        }
    }

    pub fn join(self, player2: AztecAddress) -> Self {
        assert(!self.player1.eq(AztecAddress::zero()));
        assert(self.player2.eq(AztecAddress::zero()));
        assert(!self.player1.eq(player2));

        Self {
            player1: self.player1,
            player2,
            player1_setup_done: self.player1_setup_done,
            player2_setup_done: self.player2_setup_done,
            player1_found: self.player1_found,
            player2_found: self.player2_found,
            current_turn: self.current_turn,
            pending_action: self.pending_action,
            pending_x: self.pending_x,
            pending_y: self.pending_y,
            status: STATUS_SETUP,
            winner: self.winner,
            skip_turn: self.skip_turn,
            last_detector_count: self.last_detector_count,
        }
    }

    pub fn mark_setup_done(self, player: AztecAddress) -> Self {
        let (p1_done, p2_done) = if player.eq(self.player1) {
            (true, self.player2_setup_done)
        } else {
            (self.player1_setup_done, true)
        };

        let (new_status, first_turn) = if p1_done & p2_done {
            (STATUS_PLAYING, self.player1)
        } else {
            (STATUS_SETUP, AztecAddress::zero())
        };

        Self {
            player1: self.player1,
            player2: self.player2,
            player1_setup_done: p1_done,
            player2_setup_done: p2_done,
            player1_found: self.player1_found,
            player2_found: self.player2_found,
            current_turn: first_turn,
            pending_action: ACTION_NONE,
            pending_x: 0,
            pending_y: 0,
            status: new_status,
            winner: self.winner,
            skip_turn: self.skip_turn,
            last_detector_count: self.last_detector_count,
        }
    }

    pub fn set_pending_action(self, action: u8, x: u8, y: u8) -> Self {
        Self {
            player1: self.player1,
            player2: self.player2,
            player1_setup_done: self.player1_setup_done,
            player2_setup_done: self.player2_setup_done,
            player1_found: self.player1_found,
            player2_found: self.player2_found,
            current_turn: self.current_turn,
            pending_action: action,
            pending_x: x,
            pending_y: y,
            status: STATUS_AWAITING,
            winner: self.winner,
            skip_turn: self.skip_turn,
            last_detector_count: self.last_detector_count,
        }
    }

    pub fn get_opponent(self, player: AztecAddress) -> AztecAddress {
        if player.eq(self.player1) {
            self.player2
        } else {
            self.player1
        }
    }

    pub fn switch_turn(self) -> Self {
        let next_player = if self.current_turn.eq(self.player1) {
            self.player2
        } else {
            self.player1
        };

        Self {
            player1: self.player1,
            player2: self.player2,
            player1_setup_done: self.player1_setup_done,
            player2_setup_done: self.player2_setup_done,
            player1_found: self.player1_found,
            player2_found: self.player2_found,
            current_turn: next_player,
            pending_action: ACTION_NONE,
            pending_x: 0,
            pending_y: 0,
            status: STATUS_PLAYING,
            winner: self.winner,
            skip_turn: self.skip_turn,
            last_detector_count: self.last_detector_count,
        }
    }

    pub fn switch_turn_with_detector_result(self, count: u8) -> Self {
        let next_player = if self.current_turn.eq(self.player1) {
            self.player2
        } else {
            self.player1
        };

        Self {
            player1: self.player1,
            player2: self.player2,
            player1_setup_done: self.player1_setup_done,
            player2_setup_done: self.player2_setup_done,
            player1_found: self.player1_found,
            player2_found: self.player2_found,
            current_turn: next_player,
            pending_action: ACTION_NONE,
            pending_x: 0,
            pending_y: 0,
            status: STATUS_PLAYING,
            winner: self.winner,
            skip_turn: self.skip_turn,
            last_detector_count: count,
        }
    }

    pub fn record_treasure_found(self, finder: AztecAddress) -> Self {
        let (p1_found, p2_found) = if finder.eq(self.player1) {
            (self.player1_found + 1, self.player2_found)
        } else {
            (self.player1_found, self.player2_found + 1)
        };

        let (new_status, new_winner) = if p1_found >= 2 {
            (STATUS_FINISHED, self.player1)
        } else if p2_found >= 2 {
            (STATUS_FINISHED, self.player2)
        } else {
            (STATUS_PLAYING, AztecAddress::zero())
        };

        let next_turn = if new_status == STATUS_FINISHED {
            AztecAddress::zero()
        } else if self.current_turn.eq(self.player1) {
            self.player2
        } else {
            self.player1
        };

        Self {
            player1: self.player1,
            player2: self.player2,
            player1_setup_done: self.player1_setup_done,
            player2_setup_done: self.player2_setup_done,
            player1_found: p1_found,
            player2_found: p2_found,
            current_turn: next_turn,
            pending_action: ACTION_NONE,
            pending_x: 0,
            pending_y: 0,
            status: new_status,
            winner: new_winner,
            skip_turn: self.skip_turn,
            last_detector_count: self.last_detector_count,
        }
    }

    pub fn set_skip_turn(self, player_to_skip: AztecAddress) -> Self {
        let next_turn = if self.current_turn.eq(self.player1) {
            self.player2
        } else {
            self.player1
        };

        Self {
            player1: self.player1,
            player2: self.player2,
            player1_setup_done: self.player1_setup_done,
            player2_setup_done: self.player2_setup_done,
            player1_found: self.player1_found,
            player2_found: self.player2_found,
            current_turn: next_turn,
            pending_action: ACTION_NONE,
            pending_x: 0,
            pending_y: 0,
            status: STATUS_PLAYING,
            winner: self.winner,
            skip_turn: player_to_skip,
            last_detector_count: self.last_detector_count,
        }
    }

    pub fn clear_skip_turn(self) -> Self {
        Self {
            player1: self.player1,
            player2: self.player2,
            player1_setup_done: self.player1_setup_done,
            player2_setup_done: self.player2_setup_done,
            player1_found: self.player1_found,
            player2_found: self.player2_found,
            current_turn: self.current_turn,
            pending_action: self.pending_action,
            pending_x: self.pending_x,
            pending_y: self.pending_y,
            status: self.status,
            winner: self.winner,
            skip_turn: AztecAddress::zero(),
            last_detector_count: self.last_detector_count,
        }
    }
}
