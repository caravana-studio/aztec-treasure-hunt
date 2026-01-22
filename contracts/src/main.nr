// Treasure Hunt Game Contract
//
// A two-player treasure hunt game on an 8x8 grid where players:
// 1. Hide 3 treasures privately
// 2. Use powers to find opponent's treasures
// 3. First to find 2 of opponent's 3 treasures wins
//
// Powers (per player):
// - 3x Metal Detector: Scan 3x3 area, returns treasure count
// - 2x Compass: Returns distance to nearest opponent treasure
// - 1x Golden Shovel: Relocate one of your treasures
// - 2x Trap: Place hidden trap, opponent loses turn if they dig there
//
// Key Aztec features demonstrated:
// - Private state that changes (relocate treasures)
// - Private inventory (powers consumed over time)
// - Hidden traps (private state revealed on trigger)

mod treasure_note;
mod trap_note;
mod power_note;
mod game;
mod test;

use dep::aztec::macros::aztec;

#[aztec]
pub contract TreasureHunt {
    use dep::aztec::{
        macros::{functions::{external, initializer, only_self}, storage::storage},
        messages::message_delivery::MessageDelivery,
        note::note_getter_options::NoteGetterOptions,
        note::note_viewer_options::NoteViewerOptions,
        note::note_interface::NoteProperties,
        utils::comparison::Comparator,
    };
    use dep::aztec::protocol_types::address::AztecAddress;
    use dep::aztec::state_vars::{Map, Owned, PrivateSet, PublicMutable};

    use crate::treasure_note::TreasureNote;
    use crate::trap_note::TrapNote;
    use crate::power_note::{PowerNote, POWER_DETECTOR, POWER_COMPASS, POWER_SHOVEL, POWER_TRAP};
    use crate::game::{Game, STATUS_PLAYING, STATUS_AWAITING, ACTION_DIG, ACTION_DETECTOR, ACTION_COMPASS};

    global MAP_SIZE: u8 = 8;

    // Dig result values - encodes both result and who dug
    // Format: (digger * 4) + result, where digger: 1=player1, 2=player2, result: 1=empty, 2=treasure, 3=trap
    // Player 1 results: 5, 6, 7 (1*4 + 1, 1*4 + 2, 1*4 + 3)
    global DIG_P1_EMPTY: u8 = 5;
    global DIG_P1_TREASURE: u8 = 6;
    global DIG_P1_TRAP: u8 = 7;
    // Player 2 results: 9, 10, 11 (2*4 + 1, 2*4 + 2, 2*4 + 3)
    global DIG_P2_EMPTY: u8 = 9;
    global DIG_P2_TREASURE: u8 = 10;
    global DIG_P2_TRAP: u8 = 11;

    #[storage]
    struct Storage<Context> {
        admin: PublicMutable<AztecAddress, Context>,
        next_game_id: PublicMutable<Field, Context>,
        games: Map<Field, PublicMutable<Game, Context>, Context>,
        treasures: Map<Field, Owned<PrivateSet<TreasureNote, Context>, Context>, Context>,
        traps: Map<Field, Owned<PrivateSet<TrapNote, Context>, Context>, Context>,
        powers: Map<Field, Owned<PrivateSet<PowerNote, Context>, Context>, Context>,
        // Dig results: game_id -> position (y*8+x) -> result (0=not dug, 1=empty, 2=treasure, 3=trap)
        dig_results: Map<Field, Map<Field, PublicMutable<u8, Context>, Context>, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(admin: AztecAddress) {
        self.storage.admin.write(admin);
        self.storage.next_game_id.write(1);
    }

    // ============ SETUP FUNCTIONS ============

    #[external("public")]
    fn create_game() {
        // Get and increment game ID
        let game_id = self.storage.next_game_id.read();
        self.storage.next_game_id.write(game_id + 1);

        let game = Game::new(self.context.msg_sender().unwrap());
        self.storage.games.at(game_id).write(game);
    }

    #[external("public")]
    fn join_game(game_id: Field) {
        let game = self.storage.games.at(game_id).read();
        let joined = game.join(self.context.msg_sender().unwrap());
        self.storage.games.at(game_id).write(joined);
    }

    /// Place 3 treasures and initialize 8 powers
    /// Positions must be within 8x8 grid and unique
    #[external("private")]
    fn place_treasures(
        game_id: Field,
        x1: u8, y1: u8,
        x2: u8, y2: u8,
        x3: u8, y3: u8,
    ) {
        let player = self.context.msg_sender().unwrap();

        // Validate positions are within bounds
        assert(x1 < MAP_SIZE & y1 < MAP_SIZE);
        assert(x2 < MAP_SIZE & y2 < MAP_SIZE);
        assert(x3 < MAP_SIZE & y3 < MAP_SIZE);

        // Validate positions are unique
        assert(!((x1 == x2) & (y1 == y2)));
        assert(!((x1 == x3) & (y1 == y3)));
        assert(!((x2 == x3) & (y2 == y3)));

        // Create treasure notes
        self.storage.treasures.at(game_id).at(player)
            .insert(TreasureNote::new(x1, y1, player))
            .deliver(MessageDelivery.CONSTRAINED_ONCHAIN);
        self.storage.treasures.at(game_id).at(player)
            .insert(TreasureNote::new(x2, y2, player))
            .deliver(MessageDelivery.CONSTRAINED_ONCHAIN);
        self.storage.treasures.at(game_id).at(player)
            .insert(TreasureNote::new(x3, y3, player))
            .deliver(MessageDelivery.CONSTRAINED_ONCHAIN);

        // Create power notes: 3 detectors, 2 compasses, 1 shovel, 2 traps
        for _ in 0..3 {
            self.storage.powers.at(game_id).at(player)
                .insert(PowerNote::new(POWER_DETECTOR, player))
                .deliver(MessageDelivery.CONSTRAINED_ONCHAIN);
        }
        for _ in 0..2 {
            self.storage.powers.at(game_id).at(player)
                .insert(PowerNote::new(POWER_COMPASS, player))
                .deliver(MessageDelivery.CONSTRAINED_ONCHAIN);
        }
        self.storage.powers.at(game_id).at(player)
            .insert(PowerNote::new(POWER_SHOVEL, player))
            .deliver(MessageDelivery.CONSTRAINED_ONCHAIN);
        for _ in 0..2 {
            self.storage.powers.at(game_id).at(player)
                .insert(PowerNote::new(POWER_TRAP, player))
                .deliver(MessageDelivery.CONSTRAINED_ONCHAIN);
        }

        self.enqueue(TreasureHunt::at(self.context.this_address()).confirm_setup(player, game_id));
    }

    #[external("public")]
    #[only_self]
    fn confirm_setup(player: AztecAddress, game_id: Field) {
        let game = self.storage.games.at(game_id).read();
        let updated = game.mark_setup_done(player);
        self.storage.games.at(game_id).write(updated);
    }

    // ============ CORE ACTIONS ============

    /// Dig at a location to find treasure
    #[external("public")]
    fn dig(game_id: Field, x: u8, y: u8) {
        assert(x < MAP_SIZE & y < MAP_SIZE);

        let game = self.storage.games.at(game_id).read();
        let player = self.context.msg_sender().unwrap();

        assert(game.status == STATUS_PLAYING);
        assert(game.current_turn.eq(player));

        // Handle skip turn from trap
        if game.skip_turn.eq(player) {
            let cleared = game.clear_skip_turn().switch_turn();
            self.storage.games.at(game_id).write(cleared);
        } else {
            let updated = game.set_pending_action(ACTION_DIG, x, y);
            self.storage.games.at(game_id).write(updated);
        }
    }

    /// Check if dig hit a trap or treasure (called by responder privately)
    #[external("private")]
    fn check_dig_result(game_id: Field, dig_x: u8, dig_y: u8) {
        let player = self.context.msg_sender().unwrap();

        // Check traps
        let trap_notes = self.storage.traps.at(game_id).at(player).get_notes(NoteGetterOptions::new());
        let mut hit_trap = false;

        for i in 0..2 {
            if i < trap_notes.len() {
                let trap = trap_notes.get(i);
                if (trap.note.x == dig_x) & (trap.note.y == dig_y) {
                    hit_trap = true;
                }
            }
        }

        // Check treasures
        let treasure_notes = self.storage.treasures.at(game_id).at(player).get_notes(NoteGetterOptions::new());
        let mut hit_treasure = false;

        for i in 0..3 {
            if i < treasure_notes.len() {
                let treasure = treasure_notes.get(i);
                if (treasure.note.x == dig_x) & (treasure.note.y == dig_y) {
                    hit_treasure = true;
                }
            }
        }

        self.enqueue(TreasureHunt::at(self.context.this_address()).record_dig_result(
            player,
            game_id,
            dig_x,
            dig_y,
            hit_trap,
            hit_treasure,
        ));
    }

    #[external("public")]
    #[only_self]
    fn record_dig_result(
        responder: AztecAddress,
        game_id: Field,
        dig_x: u8,
        dig_y: u8,
        hit_trap: bool,
        hit_treasure: bool,
    ) {
        let game = self.storage.games.at(game_id).read();

        // Validate game state
        assert(game.status == STATUS_AWAITING);
        assert(game.pending_action == ACTION_DIG);

        // Validate coordinates match pending action
        assert(dig_x == game.pending_x);
        assert(dig_y == game.pending_y);

        // Validate responder is a valid player and is the opponent of current turn
        let is_player1 = responder.eq(game.player1);
        let is_player2 = responder.eq(game.player2);
        assert(is_player1 | is_player2);

        let digger = game.get_opponent(responder);
        assert(game.current_turn.eq(digger));

        // Store dig result at the pending position
        let position = (game.pending_y as Field) * 8 + (game.pending_x as Field);
        let result = if digger.eq(game.player1) {
            // Player 1 dug
            if hit_trap {
                DIG_P1_TRAP
            } else if hit_treasure {
                DIG_P1_TREASURE
            } else {
                DIG_P1_EMPTY
            }
        } else {
            // Player 2 dug
            if hit_trap {
                DIG_P2_TRAP
            } else if hit_treasure {
                DIG_P2_TREASURE
            } else {
                DIG_P2_EMPTY
            }
        };
        self.storage.dig_results.at(game_id).at(position).write(result);

        let updated = if hit_trap {
            game.set_skip_turn(digger)
        } else if hit_treasure {
            game.record_treasure_found(digger)
        } else {
            game.switch_turn()
        };

        self.storage.games.at(game_id).write(updated);
    }

    // ============ POWER: METAL DETECTOR ============

    /// Use metal detector to scan 3x3 area
    #[external("private")]
    fn use_detector(game_id: Field, center_x: u8, center_y: u8) {
        let player = self.context.msg_sender().unwrap();

        // Find and consume a detector power using pop_notes (nullifies the note)
        let options = NoteGetterOptions::new()
            .select(PowerNote::properties().power_type, Comparator.EQ, POWER_DETECTOR as Field)
            .set_limit(1);
        let power_notes = self.storage.powers.at(game_id).at(player).pop_notes(options);

        // Ensure we had a detector to use
        assert(power_notes.len() == 1);

        self.enqueue(TreasureHunt::at(self.context.this_address()).set_detector_pending(
            player,
            game_id,
            center_x,
            center_y,
        ));
    }

    #[external("public")]
    #[only_self]
    fn set_detector_pending(player: AztecAddress, game_id: Field, x: u8, y: u8) {
        let game = self.storage.games.at(game_id).read();
        assert(game.status == STATUS_PLAYING);
        assert(game.current_turn.eq(player));

        // Handle skip turn
        if game.skip_turn.eq(player) {
            let cleared = game.clear_skip_turn().switch_turn();
            self.storage.games.at(game_id).write(cleared);
        } else {
            let updated = game.set_pending_action(ACTION_DETECTOR, x, y);
            self.storage.games.at(game_id).write(updated);
        }
    }

    /// Opponent responds with treasure count in 3x3 area
    #[external("private")]
    fn respond_detector(game_id: Field, center_x: u8, center_y: u8) {
        let player = self.context.msg_sender().unwrap();

        let treasure_notes = self.storage.treasures.at(game_id).at(player).get_notes(NoteGetterOptions::new());
        let mut count: u8 = 0;

        for i in 0..3 {
            if i < treasure_notes.len() {
                let treasure = treasure_notes.get(i);
                let tx = treasure.note.x;
                let ty = treasure.note.y;

                // Check if treasure is within 3x3 area centered at (center_x, center_y)
                let in_x = (tx + 1 >= center_x) & (tx <= center_x + 1);
                let in_y = (ty + 1 >= center_y) & (ty <= center_y + 1);

                if in_x & in_y {
                    count += 1;
                }
            }
        }

        self.enqueue(TreasureHunt::at(self.context.this_address()).record_detector_result(
            player,
            game_id,
            center_x,
            center_y,
            count,
        ));
    }

    #[external("public")]
    #[only_self]
    fn record_detector_result(
        responder: AztecAddress,
        game_id: Field,
        center_x: u8,
        center_y: u8,
        count: u8,
    ) {
        let game = self.storage.games.at(game_id).read();

        // Validate game state
        assert(game.status == STATUS_AWAITING);
        assert(game.pending_action == ACTION_DETECTOR);

        // Validate coordinates match pending action
        assert(center_x == game.pending_x);
        assert(center_y == game.pending_y);

        // Validate responder is a valid player and is the opponent of current turn
        let is_player1 = responder.eq(game.player1);
        let is_player2 = responder.eq(game.player2);
        assert(is_player1 | is_player2);

        let detector_user = game.get_opponent(responder);
        assert(game.current_turn.eq(detector_user));

        // Store detector result and switch turn
        let updated = game.switch_turn_with_detector_result(count);
        self.storage.games.at(game_id).write(updated);
    }

    // ============ POWER: COMPASS ============

    /// Use compass to get distance to nearest opponent treasure
    #[external("private")]
    fn use_compass(game_id: Field, from_x: u8, from_y: u8) {
        let player = self.context.msg_sender().unwrap();

        // Find and consume a compass power using pop_notes (nullifies the note)
        let options = NoteGetterOptions::new()
            .select(PowerNote::properties().power_type, Comparator.EQ, POWER_COMPASS as Field)
            .set_limit(1);
        let power_notes = self.storage.powers.at(game_id).at(player).pop_notes(options);

        // Ensure we had a compass to use
        assert(power_notes.len() == 1);

        self.enqueue(TreasureHunt::at(self.context.this_address()).set_compass_pending(
            player,
            game_id,
            from_x,
            from_y,
        ));
    }

    #[external("public")]
    #[only_self]
    fn set_compass_pending(player: AztecAddress, game_id: Field, x: u8, y: u8) {
        let game = self.storage.games.at(game_id).read();
        assert(game.status == STATUS_PLAYING);
        assert(game.current_turn.eq(player));

        if game.skip_turn.eq(player) {
            let cleared = game.clear_skip_turn().switch_turn();
            self.storage.games.at(game_id).write(cleared);
        } else {
            let updated = game.set_pending_action(ACTION_COMPASS, x, y);
            self.storage.games.at(game_id).write(updated);
        }
    }

    /// Opponent responds with minimum distance
    #[external("private")]
    fn respond_compass(game_id: Field, from_x: u8, from_y: u8) {
        let player = self.context.msg_sender().unwrap();

        let treasure_notes = self.storage.treasures.at(game_id).at(player).get_notes(NoteGetterOptions::new());
        let mut min_distance: u8 = 255;

        for i in 0..3 {
            if i < treasure_notes.len() {
                let treasure = treasure_notes.get(i);
                let tx = treasure.note.x;
                let ty = treasure.note.y;

                // Manhattan distance
                let dx = if tx > from_x { tx - from_x } else { from_x - tx };
                let dy = if ty > from_y { ty - from_y } else { from_y - ty };
                let distance = dx + dy;

                if distance < min_distance {
                    min_distance = distance;
                }
            }
        }

        self.enqueue(TreasureHunt::at(self.context.this_address()).record_compass_result(
            player,
            game_id,
            from_x,
            from_y,
            min_distance,
        ));
    }

    #[external("public")]
    #[only_self]
    fn record_compass_result(
        responder: AztecAddress,
        game_id: Field,
        from_x: u8,
        from_y: u8,
        distance: u8,
    ) {
        let game = self.storage.games.at(game_id).read();

        // Validate game state
        assert(game.status == STATUS_AWAITING);
        assert(game.pending_action == ACTION_COMPASS);

        // Validate coordinates match pending action
        assert(from_x == game.pending_x);
        assert(from_y == game.pending_y);

        // Validate responder is a valid player and is the opponent of current turn
        let is_player1 = responder.eq(game.player1);
        let is_player2 = responder.eq(game.player2);
        assert(is_player1 | is_player2);

        let compass_user = game.get_opponent(responder);
        assert(game.current_turn.eq(compass_user));

        let updated = game.switch_turn();
        self.storage.games.at(game_id).write(updated);
    }

    // ============ POWER: GOLDEN SHOVEL (RELOCATE) ============

    /// Relocate one of your treasures - THIS is what makes Aztec special!
    /// Private state that CHANGES without revealing anything
    #[external("private")]
    fn use_shovel(
        game_id: Field,
        old_x: u8, old_y: u8,
        new_x: u8, new_y: u8,
    ) {
        let player = self.context.msg_sender().unwrap();

        assert(new_x < MAP_SIZE & new_y < MAP_SIZE);

        // Find and consume shovel power using pop_notes (nullifies the note)
        let power_options = NoteGetterOptions::new()
            .select(PowerNote::properties().power_type, Comparator.EQ, POWER_SHOVEL as Field)
            .set_limit(1);
        let power_notes = self.storage.powers.at(game_id).at(player).pop_notes(power_options);

        // Ensure we had a shovel to use
        assert(power_notes.len() == 1);

        // Find and consume the treasure at old position using pop_notes (nullifies the note)
        let treasure_options = NoteGetterOptions::new()
            .select(TreasureNote::properties().x, Comparator.EQ, old_x as Field)
            .select(TreasureNote::properties().y, Comparator.EQ, old_y as Field)
            .set_limit(1);
        let treasure_notes = self.storage.treasures.at(game_id).at(player).pop_notes(treasure_options);

        // Ensure we found the treasure at the old position
        assert(treasure_notes.len() == 1);

        // Create new treasure at new position
        self.storage.treasures.at(game_id).at(player)
            .insert(TreasureNote::new(new_x, new_y, player))
            .deliver(MessageDelivery.CONSTRAINED_ONCHAIN);

        self.enqueue(TreasureHunt::at(self.context.this_address()).confirm_shovel_used(player, game_id));
    }

    #[external("public")]
    #[only_self]
    fn confirm_shovel_used(player: AztecAddress, game_id: Field) {
        let game = self.storage.games.at(game_id).read();
        assert(game.status == STATUS_PLAYING);
        assert(game.current_turn.eq(player));

        if game.skip_turn.eq(player) {
            let cleared = game.clear_skip_turn().switch_turn();
            self.storage.games.at(game_id).write(cleared);
        } else {
            let updated = game.switch_turn();
            self.storage.games.at(game_id).write(updated);
        }
    }

    // ============ POWER: TRAP ============

    /// Place a trap at a location
    #[external("private")]
    fn use_trap(game_id: Field, trap_x: u8, trap_y: u8) {
        let player = self.context.msg_sender().unwrap();

        assert(trap_x < MAP_SIZE & trap_y < MAP_SIZE);

        // Find and consume trap power using pop_notes (nullifies the note)
        let options = NoteGetterOptions::new()
            .select(PowerNote::properties().power_type, Comparator.EQ, POWER_TRAP as Field)
            .set_limit(1);
        let power_notes = self.storage.powers.at(game_id).at(player).pop_notes(options);

        // Ensure we had a trap to use
        assert(power_notes.len() == 1);

        // Create trap note
        self.storage.traps.at(game_id).at(player)
            .insert(TrapNote::new(trap_x, trap_y, player))
            .deliver(MessageDelivery.CONSTRAINED_ONCHAIN);

        self.enqueue(TreasureHunt::at(self.context.this_address()).confirm_trap_placed(player, game_id));
    }

    #[external("public")]
    #[only_self]
    fn confirm_trap_placed(player: AztecAddress, game_id: Field) {
        let game = self.storage.games.at(game_id).read();
        assert(game.status == STATUS_PLAYING);
        assert(game.current_turn.eq(player));

        if game.skip_turn.eq(player) {
            let cleared = game.clear_skip_turn().switch_turn();
            self.storage.games.at(game_id).write(cleared);
        } else {
            let updated = game.switch_turn();
            self.storage.games.at(game_id).write(updated);
        }
    }

    // ============ UTILITY FUNCTIONS (READ-ONLY) ============

    /// Get the admin address
    #[external("utility")]
    unconstrained fn get_admin() -> pub AztecAddress {
        self.storage.admin.read()
    }

    /// Get the next game ID that will be assigned
    #[external("utility")]
    unconstrained fn get_next_game_id() -> pub Field {
        self.storage.next_game_id.read()
    }

    /// Get the complete game state
    #[external("utility")]
    unconstrained fn get_game(game_id: Field) -> pub Game {
        self.storage.games.at(game_id).read()
    }

    /// Get player1 address for a game
    #[external("utility")]
    unconstrained fn get_player1(game_id: Field) -> pub AztecAddress {
        self.storage.games.at(game_id).read().player1
    }

    /// Get player2 address for a game
    #[external("utility")]
    unconstrained fn get_player2(game_id: Field) -> pub AztecAddress {
        self.storage.games.at(game_id).read().player2
    }

    /// Get game status
    #[external("utility")]
    unconstrained fn get_game_status(game_id: Field) -> pub u8 {
        self.storage.games.at(game_id).read().status
    }

    /// Get current turn player
    #[external("utility")]
    unconstrained fn get_current_turn(game_id: Field) -> pub AztecAddress {
        self.storage.games.at(game_id).read().current_turn
    }

    /// Get treasures found by player1
    #[external("utility")]
    unconstrained fn get_player1_treasures_found(game_id: Field) -> pub u8 {
        self.storage.games.at(game_id).read().player1_found
    }

    /// Get treasures found by player2
    #[external("utility")]
    unconstrained fn get_player2_treasures_found(game_id: Field) -> pub u8 {
        self.storage.games.at(game_id).read().player2_found
    }

    /// Get the winner of a finished game
    #[external("utility")]
    unconstrained fn get_winner(game_id: Field) -> pub AztecAddress {
        self.storage.games.at(game_id).read().winner
    }

    /// Check if both players have completed setup
    #[external("utility")]
    unconstrained fn is_game_ready(game_id: Field) -> pub bool {
        let game = self.storage.games.at(game_id).read();
        game.player1_setup_done & game.player2_setup_done
    }

    /// Get pending action info
    #[external("utility")]
    unconstrained fn get_pending_action(game_id: Field) -> pub (u8, u8, u8) {
        let game = self.storage.games.at(game_id).read();
        (game.pending_action, game.pending_x, game.pending_y)
    }

    /// Get power counts for a player
    /// Returns (detector_count, compass_count, shovel_count, trap_count)
    #[external("utility")]
    unconstrained fn get_my_powers(game_id: Field, player: AztecAddress) -> pub (u8, u8, u8, u8) {
        let power_notes = self.storage.powers.at(game_id).at(player).view_notes(NoteViewerOptions::new());

        let mut detector_count: u8 = 0;
        let mut compass_count: u8 = 0;
        let mut shovel_count: u8 = 0;
        let mut trap_count: u8 = 0;

        for i in 0..8 {
            if i < power_notes.len() {
                let power = power_notes.get(i);
                if power.power_type == POWER_DETECTOR {
                    detector_count += 1;
                } else if power.power_type == POWER_COMPASS {
                    compass_count += 1;
                } else if power.power_type == POWER_SHOVEL {
                    shovel_count += 1;
                } else if power.power_type == POWER_TRAP {
                    trap_count += 1;
                }
            }
        }

        (detector_count, compass_count, shovel_count, trap_count)
    }

    /// Get dig result at a specific position
    /// Returns: 0=not dug, 1=empty, 2=treasure found, 3=hit trap
    #[external("utility")]
    unconstrained fn get_dig_result(game_id: Field, x: u8, y: u8) -> pub u8 {
        let position = (y as Field) * 8 + (x as Field);
        self.storage.dig_results.at(game_id).at(position).read()
    }

    /// Get all dig results for a game as a flat array of 64 values
    /// Index = y * 8 + x, value = 0 (not dug), 1 (empty), 2 (treasure), 3 (trap)
    #[external("utility")]
    unconstrained fn get_all_dig_results(game_id: Field) -> pub [u8; 64] {
        let mut results: [u8; 64] = [0; 64];
        for i in 0..64 {
            results[i] = self.storage.dig_results.at(game_id).at(i as Field).read();
        }
        results
    }
}
