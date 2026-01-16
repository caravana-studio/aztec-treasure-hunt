use crate::TreasureHunt;
use crate::test::utils::setup;
use crate::test::helpers::{
    create_game_and_get_id, setup_two_player_game, place_player_treasures, setup_complete_game,
    sample_treasures_player1
};
use crate::game::{
    STATUS_CREATED, STATUS_SETUP, STATUS_PLAYING, STATUS_AWAITING,
    ACTION_NONE, ACTION_DIG
};
use dep::aztec::protocol_types::address::AztecAddress;
use dep::aztec::protocol_types::storage::map::derive_storage_slot_in_map;

// ============================================================================
// STORAGE LAYOUT OFFSETS FOR GAME STRUCT
// ============================================================================
// Game struct fields in order:
// 0: player1 (AztecAddress)
// 1: player2 (AztecAddress)
// 2: player1_setup_done (bool)
// 3: player2_setup_done (bool)
// 4: player1_found (u8)
// 5: player2_found (u8)
// 6: current_turn (AztecAddress)
// 7: pending_action (u8)
// 8: pending_x (u8)
// 9: pending_y (u8)
// 10: status (u8)
// 11: winner (AztecAddress)
// 12: skip_turn (AztecAddress)

global OFFSET_PLAYER1: Field = 0;
global OFFSET_PLAYER2: Field = 1;
global OFFSET_P1_SETUP_DONE: Field = 2;
global OFFSET_P2_SETUP_DONE: Field = 3;
global OFFSET_P1_FOUND: Field = 4;
global OFFSET_P2_FOUND: Field = 5;
global OFFSET_CURRENT_TURN: Field = 6;
global OFFSET_PENDING_ACTION: Field = 7;
global OFFSET_PENDING_X: Field = 8;
global OFFSET_PENDING_Y: Field = 9;
global OFFSET_STATUS: Field = 10;
global OFFSET_WINNER: Field = 11;
global OFFSET_SKIP_TURN: Field = 12;

// ============================================================================
// CONTRACT DEPLOYMENT TESTS
// ============================================================================

/// Test: Contract initialization sets admin correctly
#[test]
unconstrained fn test_admin_is_set_correctly() {
    let (mut env, contract_address, admin) = setup();

    env.public_context_at(contract_address, |context| {
        let stored_admin = context.storage_read(TreasureHunt::storage_layout().admin.slot);
        assert_eq(stored_admin, admin);
    });
}

// ============================================================================
// GAME CREATION TESTS
// ============================================================================

/// Test: Creating a new game sets player1 and status correctly
#[test]
unconstrained fn test_create_game_sets_initial_state() {
    let (mut env, contract_address, _admin) = setup();
    let player1 = env.create_light_account();

    let game_id = create_game_and_get_id(&mut env, contract_address, player1);

    env.public_context_at(contract_address, |context| {
        let game_slot = derive_storage_slot_in_map(TreasureHunt::storage_layout().games.slot, game_id);

        // Verify player1 is set
        let stored_player1 = context.storage_read(game_slot + OFFSET_PLAYER1);
        assert_eq(stored_player1, player1);

        // Verify player2 is zero (not joined yet)
        let stored_player2 = context.storage_read(game_slot + OFFSET_PLAYER2);
        assert_eq(stored_player2, AztecAddress::zero());

        // Verify status is CREATED
        let stored_status: Field = context.storage_read(game_slot + OFFSET_STATUS);
        assert_eq(stored_status, STATUS_CREATED as Field);
    });
}

/// Test: Creating multiple games assigns sequential IDs
#[test]
unconstrained fn test_create_multiple_games_sequential_ids() {
    let (mut env, contract_address, _admin) = setup();
    let player1 = env.create_light_account();

    // Create first game
    let game_id_1 = create_game_and_get_id(&mut env, contract_address, player1);
    assert_eq(game_id_1, 1);

    // Create second game
    let game_id_2 = create_game_and_get_id(&mut env, contract_address, player1);
    assert_eq(game_id_2, 2);

    // Create third game
    let game_id_3 = create_game_and_get_id(&mut env, contract_address, player1);
    assert_eq(game_id_3, 3);
}

// ============================================================================
// GAME JOINING TESTS
// ============================================================================

/// Test: Second player can join and state is updated correctly
#[test]
unconstrained fn test_join_game_updates_state() {
    let (mut env, contract_address, _admin) = setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();

    // Player 1 creates game
    let game_id = create_game_and_get_id(&mut env, contract_address, player1);

    // Verify initial status is CREATED
    env.public_context_at(contract_address, |context| {
        let game_slot = derive_storage_slot_in_map(TreasureHunt::storage_layout().games.slot, game_id);
        let status: Field = context.storage_read(game_slot + OFFSET_STATUS);
        assert_eq(status, STATUS_CREATED as Field);
    });

    // Player 2 joins
    env.call_public(player2, TreasureHunt::at(contract_address).join_game(game_id));

    // Verify state after join
    env.public_context_at(contract_address, |context| {
        let game_slot = derive_storage_slot_in_map(TreasureHunt::storage_layout().games.slot, game_id);

        // Verify both players are set
        let stored_player1 = context.storage_read(game_slot + OFFSET_PLAYER1);
        let stored_player2 = context.storage_read(game_slot + OFFSET_PLAYER2);
        assert_eq(stored_player1, player1);
        assert_eq(stored_player2, player2);

        // Verify status changed to SETUP
        let status: Field = context.storage_read(game_slot + OFFSET_STATUS);
        assert_eq(status, STATUS_SETUP as Field);
    });
}

/// Test: Cannot join a non-existent game
#[test(should_fail)]
unconstrained fn test_fail_join_nonexistent_game() {
    let (mut env, contract_address, _admin) = setup();
    let player2 = env.create_light_account();
    let non_existent_game_id = 999;

    // Try to join without game being created (should fail)
    env.call_public(player2, TreasureHunt::at(contract_address).join_game(non_existent_game_id));
}

/// Test: Same player cannot join as both player1 and player2
#[test(should_fail)]
unconstrained fn test_fail_same_player_joins_own_game() {
    let (mut env, contract_address, _admin) = setup();
    let player1 = env.create_light_account();

    let game_id = create_game_and_get_id(&mut env, contract_address, player1);

    // Try to join own game (should fail)
    env.call_public(player1, TreasureHunt::at(contract_address).join_game(game_id));
}

// ============================================================================
// TREASURE PLACEMENT TESTS
// ============================================================================

/// Test: Player can place treasures successfully
#[test]
unconstrained fn test_place_treasures_success() {
    let (mut env, contract_address, _admin) = setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();

    let game_id = setup_two_player_game(&mut env, contract_address, player1, player2);

    // Player 1 places treasures
    place_player_treasures(&mut env, contract_address, player1, game_id, sample_treasures_player1());

    // Verify player1_setup_done is true
    env.public_context_at(contract_address, |context| {
        let game_slot = derive_storage_slot_in_map(TreasureHunt::storage_layout().games.slot, game_id);
        let p1_setup_done: Field = context.storage_read(game_slot + OFFSET_P1_SETUP_DONE);
        assert_eq(p1_setup_done, 1); // true

        // Status should still be SETUP (waiting for player2)
        let status: Field = context.storage_read(game_slot + OFFSET_STATUS);
        assert_eq(status, STATUS_SETUP as Field);
    });
}

/// Test: Both players placing treasures transitions to PLAYING state
#[test]
unconstrained fn test_both_players_place_treasures_starts_game() {
    let (mut env, contract_address, _admin) = setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();

    // Setup complete game (both players place treasures)
    let game_id = setup_complete_game(&mut env, contract_address, player1, player2);

    // Verify game state
    env.public_context_at(contract_address, |context| {
        let game_slot = derive_storage_slot_in_map(TreasureHunt::storage_layout().games.slot, game_id);

        // Both setup_done flags should be true
        let p1_setup_done: Field = context.storage_read(game_slot + OFFSET_P1_SETUP_DONE);
        let p2_setup_done: Field = context.storage_read(game_slot + OFFSET_P2_SETUP_DONE);
        assert_eq(p1_setup_done, 1);
        assert_eq(p2_setup_done, 1);

        // Status should be PLAYING
        let status: Field = context.storage_read(game_slot + OFFSET_STATUS);
        assert_eq(status, STATUS_PLAYING as Field);

        // Current turn should be player1
        let current_turn = context.storage_read(game_slot + OFFSET_CURRENT_TURN);
        assert_eq(current_turn, player1);

        // Treasures found should be 0 for both players
        let p1_found: Field = context.storage_read(game_slot + OFFSET_P1_FOUND);
        let p2_found: Field = context.storage_read(game_slot + OFFSET_P2_FOUND);
        assert_eq(p1_found, 0);
        assert_eq(p2_found, 0);
    });
}

/// Test: Cannot place duplicate treasure positions
#[test(should_fail)]
unconstrained fn test_fail_place_duplicate_positions() {
    let (mut env, contract_address, _admin) = setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();

    let game_id = setup_two_player_game(&mut env, contract_address, player1, player2);

    // Try to place two treasures at the same position
    env.call_private(
        player1,
        TreasureHunt::at(contract_address).place_treasures(
            game_id,
            0, 0,  // First treasure
            0, 0,  // Same position - should fail
            1, 1
        )
    );
}

/// Test: Cannot place treasures outside 8x8 grid
#[test(should_fail)]
unconstrained fn test_fail_place_out_of_bounds() {
    let (mut env, contract_address, _admin) = setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();

    let game_id = setup_two_player_game(&mut env, contract_address, player1, player2);

    // Try to place treasure outside grid (x=10 > 7)
    env.call_private(
        player1,
        TreasureHunt::at(contract_address).place_treasures(
            game_id,
            0, 0,
            10, 10,  // Out of bounds
            1, 1
        )
    );
}

// ============================================================================
// GAME ACTIONS TESTS
// ============================================================================

/// Test: Dig action sets pending action and changes status to AWAITING
#[test]
unconstrained fn test_dig_sets_pending_action() {
    let (mut env, contract_address, _admin) = setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();

    // Setup complete game
    let game_id = setup_complete_game(&mut env, contract_address, player1, player2);

    // Player 1 digs at position (2, 3)
    env.call_public(player1, TreasureHunt::at(contract_address).dig(game_id, 2, 3));

    // Verify pending action state
    env.public_context_at(contract_address, |context| {
        let game_slot = derive_storage_slot_in_map(TreasureHunt::storage_layout().games.slot, game_id);

        // Status should be AWAITING
        let status: Field = context.storage_read(game_slot + OFFSET_STATUS);
        assert_eq(status, STATUS_AWAITING as Field);

        // Pending action should be DIG
        let pending_action: Field = context.storage_read(game_slot + OFFSET_PENDING_ACTION);
        assert_eq(pending_action, ACTION_DIG as Field);

        // Pending coordinates should be (2, 3)
        let pending_x: Field = context.storage_read(game_slot + OFFSET_PENDING_X);
        let pending_y: Field = context.storage_read(game_slot + OFFSET_PENDING_Y);
        assert_eq(pending_x, 2);
        assert_eq(pending_y, 3);
    });
}

/// Test: Using shovel switches turn to opponent
#[test]
unconstrained fn test_use_shovel_switches_turn() {
    let (mut env, contract_address, _admin) = setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();

    // Setup complete game
    let game_id = setup_complete_game(&mut env, contract_address, player1, player2);

    // Verify it's player1's turn initially
    env.public_context_at(contract_address, |context| {
        let game_slot = derive_storage_slot_in_map(TreasureHunt::storage_layout().games.slot, game_id);
        let current_turn = context.storage_read(game_slot + OFFSET_CURRENT_TURN);
        assert_eq(current_turn, player1);
    });

    // Player 1 uses shovel to move treasure from (0,0) to (1,1)
    env.call_private(
        player1,
        TreasureHunt::at(contract_address).use_shovel(game_id, 0, 0, 1, 1)
    );

    // Verify turn switched to player2
    env.public_context_at(contract_address, |context| {
        let game_slot = derive_storage_slot_in_map(TreasureHunt::storage_layout().games.slot, game_id);

        // Current turn should now be player2
        let current_turn = context.storage_read(game_slot + OFFSET_CURRENT_TURN);
        assert_eq(current_turn, player2);

        // Status should still be PLAYING
        let status: Field = context.storage_read(game_slot + OFFSET_STATUS);
        assert_eq(status, STATUS_PLAYING as Field);
    });
}

/// Test: Using trap switches turn to opponent
#[test]
unconstrained fn test_use_trap_switches_turn() {
    let (mut env, contract_address, _admin) = setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();

    // Setup complete game
    let game_id = setup_complete_game(&mut env, contract_address, player1, player2);

    // Player 1 places a trap at (2, 2)
    env.call_private(
        player1,
        TreasureHunt::at(contract_address).use_trap(game_id, 2, 2)
    );

    // Verify turn switched to player2
    env.public_context_at(contract_address, |context| {
        let game_slot = derive_storage_slot_in_map(TreasureHunt::storage_layout().games.slot, game_id);

        // Current turn should now be player2
        let current_turn = context.storage_read(game_slot + OFFSET_CURRENT_TURN);
        assert_eq(current_turn, player2);

        // Status should still be PLAYING
        let status: Field = context.storage_read(game_slot + OFFSET_STATUS);
        assert_eq(status, STATUS_PLAYING as Field);
    });
}

// ============================================================================
// WINNER VERIFICATION TESTS
// ============================================================================

/// Test: Winner is zero address before game ends
#[test]
unconstrained fn test_winner_is_zero_before_game_ends() {
    let (mut env, contract_address, _admin) = setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();

    let game_id = setup_complete_game(&mut env, contract_address, player1, player2);

    env.public_context_at(contract_address, |context| {
        let game_slot = derive_storage_slot_in_map(TreasureHunt::storage_layout().games.slot, game_id);

        // Winner should be zero address
        let winner = context.storage_read(game_slot + OFFSET_WINNER);
        assert_eq(winner, AztecAddress::zero());
    });
}

// ============================================================================
// FULL GAME STATE VERIFICATION
// ============================================================================

/// Test: Verify all game state fields after complete setup
#[test]
unconstrained fn test_full_game_state_after_setup() {
    let (mut env, contract_address, admin) = setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();

    // Complete game setup
    let game_id = setup_complete_game(&mut env, contract_address, player1, player2);

    // Verify ALL game state fields
    env.public_context_at(contract_address, |context| {
        let game_slot = derive_storage_slot_in_map(TreasureHunt::storage_layout().games.slot, game_id);

        // Players
        let stored_player1 = context.storage_read(game_slot + OFFSET_PLAYER1);
        let stored_player2 = context.storage_read(game_slot + OFFSET_PLAYER2);
        assert_eq(stored_player1, player1);
        assert_eq(stored_player2, player2);

        // Setup done flags
        let p1_setup_done: Field = context.storage_read(game_slot + OFFSET_P1_SETUP_DONE);
        let p2_setup_done: Field = context.storage_read(game_slot + OFFSET_P2_SETUP_DONE);
        assert_eq(p1_setup_done, 1);
        assert_eq(p2_setup_done, 1);

        // Treasures found (should be 0)
        let p1_found: Field = context.storage_read(game_slot + OFFSET_P1_FOUND);
        let p2_found: Field = context.storage_read(game_slot + OFFSET_P2_FOUND);
        assert_eq(p1_found, 0);
        assert_eq(p2_found, 0);

        // Current turn (player1 starts)
        let current_turn = context.storage_read(game_slot + OFFSET_CURRENT_TURN);
        assert_eq(current_turn, player1);

        // Pending action (should be NONE)
        let pending_action: Field = context.storage_read(game_slot + OFFSET_PENDING_ACTION);
        assert_eq(pending_action, ACTION_NONE as Field);

        // Status (should be PLAYING)
        let status: Field = context.storage_read(game_slot + OFFSET_STATUS);
        assert_eq(status, STATUS_PLAYING as Field);

        // Winner (should be zero)
        let winner = context.storage_read(game_slot + OFFSET_WINNER);
        assert_eq(winner, AztecAddress::zero());

        // Skip turn (should be zero)
        let skip_turn = context.storage_read(game_slot + OFFSET_SKIP_TURN);
        assert_eq(skip_turn, AztecAddress::zero());
    });

    // Also verify admin is still correct
    env.public_context_at(contract_address, |context| {
        let stored_admin = context.storage_read(TreasureHunt::storage_layout().admin.slot);
        assert_eq(stored_admin, admin);
    });
}
